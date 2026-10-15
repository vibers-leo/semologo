import { NextResponse } from "next/server";
import crypto from "crypto";
import { redis } from "@/lib/redis";

/**
 * 쿠팡 파트너스 골드박스 상품을 받아 온다.
 *
 * 왜 위젯(iframe)이 아니라 API 인가 —
 * 위젯 방식은 파트너스 대시보드에서 발급한 **위젯 ID + 트래킹 코드**가 있어야
 * 하는데 그 값이 없었고(서버 .env 에 키만 있고 값이 비어 있었다), 그래서
 * 컴포넌트가 조용히 null 을 반환해 배너가 아예 안 나왔다.
 * 오픈 API 키는 이미 보유하고 있고, API 가 돌려주는 productUrl 에는
 * 제휴 태그(lptag=AF…)가 이미 박혀 있어 수수료 집계에 문제가 없다.
 *
 * ⚠️ 키는 서버에서만 쓴다. NEXT_PUBLIC_ 으로 내보내면 번들에 구워져 공개된다.
 */

const HOST = "https://api-gateway.coupang.com";
const PATH = "/v2/providers/affiliate_open_api/apis/openapi/v1/products/goldbox";
const SEARCH_PATH = "/v2/providers/affiliate_open_api/apis/openapi/products/search";
const BRAND_ORIGIN = "https://kr.object.ncloudstorage.com/vibers-bucket/_clients";

// The current Partners Search API docs cap this endpoint at 50 calls/minute.
// Keep a shared rolling budget below that limit, including across deploys.
let lookupWindowStart = 0;
let lookupCount = 0;
const SEARCHES_PER_MINUTE = 40;

function lookupBudgetAvailable() {
  const now = Date.now();
  if (now - lookupWindowStart >= 60_000) { lookupWindowStart = now; lookupCount = 0; }
  if (lookupCount >= 60) return false;
  lookupCount += 1;
  return true;
}

async function searchBudgetAvailable() {
  const client = redis();
  if (!client) return false;
  try {
    const now = Date.now();
    const allowed = await client.eval(
      "redis.call('ZREMRANGEBYSCORE',KEYS[1],'-inf',ARGV[1]-60000); if redis.call('ZCARD',KEYS[1])>=tonumber(ARGV[2]) then return 0 end; redis.call('ZADD',KEYS[1],ARGV[1],ARGV[3]); redis.call('PEXPIRE',KEYS[1],60000); return 1",
      1, "coupang:search:rolling-minute", now, SEARCHES_PER_MINUTE, `${now}:${crypto.randomUUID()}`,
    );
    return allowed === 1;
  } catch (error) {
    console.error("[coupang-budget]", (error as Error).name);
    return false;
  }
}

async function brandForAd(id: string): Promise<{ name_ko: string; category: string } | null> {
  const response = await fetch(`${BRAND_ORIGIN}/${id}/brand.json`, { next: { revalidate: 43_200 } });
  if (!response.ok) return null;
  const brand = await response.json();
  return brand?.id === id && typeof brand.name_ko === "string" ? brand : null;
}

// 쿠팡이 정한 CEA 서명 규격. signed-date 는 UTC yyMMddTHHmmssZ 형식이어야 한다.
function authHeader(accessKey: string, secretKey: string, path = PATH, query = ""): string {
  const dt = new Date().toISOString().replace(/[-:]/g, "").replace(/\..*/, "Z").slice(2);
  const signature = crypto.createHmac("sha256", secretKey).update(dt + "GET" + path + query).digest("hex");
  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${dt}, signature=${signature}`;
}

// ⚠️ revalidate 만 두면 Next.js 가 이 라우트를 **빌드 시점에 미리 실행**해
//    결과를 굳혀버린다. 빌드 컨테이너에는 키가 없으므로 영원히
//    reason=no_credentials 가 캐시된다(실제로 그렇게 나왔다).
//    force-dynamic 으로 런타임 실행을 보장하고, 상류 호출 캐시는 아래
//    fetch 의 next.revalidate 가 담당한다 — 쿠팡 API 는 30분에 한 번만 친다.
export const dynamic = "force-dynamic";
const UPSTREAM_TTL = 1800;

export async function GET(request: Request) {
  const ak = process.env.COUPANG_ACCESS_KEY;
  const sk = process.env.COUPANG_SECRET_KEY;
  // 키가 없으면 빈 목록을 준다 — 화면에 깨진 상자를 남기지 않는다.
  // 다만 실패와 구분되게 reason 을 실어 보낸다(빈 결과로 실패를 삼키지 않는다).
  if (!ak || !sk) {
    return NextResponse.json({ products: [], reason: "no_credentials" });
  }
  try {
    const id = new URL(request.url).searchParams.get("brand") || "";
    const validBrandId = /^[a-z0-9][a-z0-9-]{1,90}$/.test(id);
    const cacheKey = `coupang:related:v2:${id}`;
    const client = validBrandId ? redis() : null;
    let cached: string | null = null;
    if (client) try { cached = await client.get(cacheKey); } catch { /* Goldbox remains available. */ }
    if (cached && cached !== "none") {
      try { return NextResponse.json(JSON.parse(cached)); } catch { /* Refresh below. */ }
    }
    if (validBrandId && lookupBudgetAvailable()) {
      const brand = await brandForAd(id);
      const name = brand?.name_ko?.split("/")[0]?.trim() || "";
      const publicCategory = /공공|기관|교육|의료|도시|국가|국기/.test(brand?.category || "");
      const isTodayHouse = id === "ohou-se" || id === "ohouse" || name.replace(/\s/g, "") === "오늘의집";
      const keyword = isTodayHouse ? "인테리어 소품" : id === "puma" ? "푸마" : name;
      if (brand && !publicCategory && !cached && keyword.length >= 2 && keyword.length <= 30 && await searchBudgetAvailable()) {
        try {
        const query = new URLSearchParams({ keyword, limit: "10" }).toString();
        const response = await fetch(`${HOST}${SEARCH_PATH}?${query}`, {
          headers: { Authorization: authHeader(ak, sk, SEARCH_PATH, query), "Content-Type": "application/json" },
          next: { revalidate: 1_800 },
        });
        if (response.ok) {
          const json = await response.json();
          const candidates = Array.isArray(json?.data?.productData) ? json.data.productData : [];
          const compactName = keyword.replace(/\s/g, "").toLowerCase();
          const seenProducts = new Set<string>();
          const matches = candidates.filter((p: Record<string, unknown>) => {
            if (!p.productId || !p.productUrl || !p.productImage) return false;
            const productId = String(p.productId);
            if (seenProducts.has(productId)) return false;
            seenProducts.add(productId);
            return true;
          }).sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
            const aExact = String(a.productName || "").replace(/\s/g, "").toLowerCase().includes(compactName) ? 1 : 0;
            const bExact = String(b.productName || "").replace(/\s/g, "").toLowerCase().includes(compactName) ? 1 : 0;
            return bExact - aExact;
          }).slice(0, 5);
          if (matches.length) {
            const hasExact = matches.some((product: Record<string, unknown>) => String(product.productName || "").replace(/\s/g, "").toLowerCase().includes(compactName));
            const result = { mode: "related", label: isTodayHouse ? "집 꾸미기 상품" : hasExact ? `${name} 관련 상품` : `${name}에서 떠오르는 상품`, products: matches.map((product: Record<string, unknown>) => ({
              id: product.productId, name: product.productName, price: product.productPrice,
              image: product.productImage, url: product.productUrl, rocket: product.isRocket,
            })) };
            if (client) try { await client.set(cacheKey, JSON.stringify(result), "EX", 1_800); } catch { /* Optional cache. */ }
            return NextResponse.json(result);
          }
          if (client) try { await client.set(cacheKey, "none", "EX", 300); } catch { /* Optional cache. */ }
        }
        } catch (error) {
          console.error("[coupang-search]", (error as Error).name);
        }
      }
    }
    const res = await fetch(HOST + PATH, {
      headers: { Authorization: authHeader(ak, sk), "Content-Type": "application/json" },
      next: { revalidate: UPSTREAM_TTL },
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("[coupang]", res.status, body.slice(0, 160));
      return NextResponse.json({ products: [], reason: `http_${res.status}` }, { status: 200 });
    }
    const json = await res.json();
    const products = (json?.data ?? []).map((p: Record<string, unknown>) => ({
      id: p.productId,
      name: p.productName,
      price: p.productPrice,
      image: p.productImage,
      url: p.productUrl,          // 제휴 태그(lptag)가 이미 포함돼 있다
      rocket: p.isRocket,
    }));
    return NextResponse.json({ products });
  } catch (e) {
    console.error("[coupang]", (e as Error).name, (e as Error).message.slice(0, 120));
    return NextResponse.json({ products: [], reason: "fetch_failed" }, { status: 200 });
  }
}

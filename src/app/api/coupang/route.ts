import { NextResponse } from "next/server";
import crypto from "crypto";

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

// 쿠팡이 정한 CEA 서명 규격. signed-date 는 UTC yyMMddTHHmmssZ 형식이어야 한다.
function authHeader(accessKey: string, secretKey: string): string {
  const dt = new Date().toISOString().replace(/[-:]/g, "").replace(/\..*/, "Z").slice(2);
  const signature = crypto.createHmac("sha256", secretKey).update(dt + "GET" + PATH).digest("hex");
  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${dt}, signature=${signature}`;
}

export const revalidate = 1800;   // 30분. 골드박스는 자주 안 바뀌고, 매 요청 호출은 낭비다

export async function GET() {
  const ak = process.env.COUPANG_ACCESS_KEY;
  const sk = process.env.COUPANG_SECRET_KEY;
  // 키가 없으면 빈 목록을 준다 — 화면에 깨진 상자를 남기지 않는다.
  // 다만 실패와 구분되게 reason 을 실어 보낸다(빈 결과로 실패를 삼키지 않는다).
  if (!ak || !sk) {
    return NextResponse.json({ products: [], reason: "no_credentials" });
  }
  try {
    const res = await fetch(HOST + PATH, {
      headers: { Authorization: authHeader(ak, sk), "Content-Type": "application/json" },
      next: { revalidate },
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

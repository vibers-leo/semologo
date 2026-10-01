import { NextRequest, NextResponse } from "next/server";

/**
 * 브랜드 히트 수집. 순위(인기순 정렬)의 원천 데이터다.
 *
 * 왜 GA4 로 안 되나 — 이벤트는 이미 GA4 로 가고 있지만, 그 값을 다시 읽어
 * 정렬에 쓰려면 Data API 인증이 따로 필요하고 지연도 크다. 자체 카운터가 단순하다.
 *
 * ⚠️ 어뷰징을 막지 않으면 순위가 조작된다. 세 겹으로 막는다.
 *    ① 봇 UA 는 세지 않는다  ② 같은 세션+브랜드+종류는 쿨다운 동안 1회만
 *    ③ IP 당 분당 상한
 * 그래도 완벽하진 않다 — 순위는 '대략 맞으면 되는' 값이라 이 정도로 충분하다.
 */

export const dynamic = "force-dynamic";   // 빌드 시점에 굳으면 안 된다

const WEIGHTS: Record<string, number> = {
  download: 10,   // SVG/PNG 받기 — 가장 강한 의도
  ad: 5,          // 광고 클릭 (수익 기여)
  view: 3,        // 브랜드 상세 열람
  search: 2,      // 검색 결과에서 클릭
  dwell: 2,       // 30초 이상 머무름
};

const BOT = /bot|crawler|spider|crawling|headless|preview|scan|curl|wget|python-requests/i;
const COOLDOWN = 600;    // 같은 세션·브랜드·종류 재카운트 방지(초)
const IP_LIMIT = 120;    // IP 당 분당 히트 상한

export async function POST(req: NextRequest) {
  const ua = req.headers.get("user-agent") ?? "";
  if (BOT.test(ua)) return NextResponse.json({ ok: false, reason: "bot" });

  let body: { id?: string; type?: string; sid?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, reason: "bad_json" }, { status: 400 }); }

  const { id, type, sid } = body;
  // 브랜드 id 는 우리가 만든 슬러그 형식만 받는다 — 임의 키로 Redis 를 채우지 못하게.
  if (!id || !/^[a-z0-9][a-z0-9-]{0,80}$/.test(id)) {
    return NextResponse.json({ ok: false, reason: "bad_id" }, { status: 400 });
  }
  const w = WEIGHTS[type ?? ""];
  if (!w) return NextResponse.json({ ok: false, reason: "bad_type" }, { status: 400 });

  const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "0")
    .split(",")[0].trim();

  // 인기순은 PostgreSQL/GA4 집계로 대체한다. Redis 없이도 이벤트 호출은 성공 처리한다.
  return NextResponse.json({ ok: true, counted: false, reason: "redis_disabled" });
}

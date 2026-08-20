import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";

/**
 * 히트 기반 인기 점수를 내려준다. 그리드가 이 값으로 정렬한다.
 *
 * 콜드스타트 —
 * 히트가 하나도 없는 초기에는 순위를 매길 수 없다. 그래서 이 값이 비어 있으면
 * 클라이언트는 brands-slim.json 의 fame(위키백과 언어판 수)로 정렬한다.
 * 히트가 쌓일수록 실제 사용 데이터가 baseline 을 밀어낸다.
 *
 * 응답은 { id: score } 맵이다. 상위 N 개만 보낸다 — 3.8만개를 다 보내면
 * 목록 JSON 만큼 무거워진다. 하위권은 어차피 fame 으로 정렬해도 차이가 없다.
 */

export const dynamic = "force-dynamic";   // 빌드 시점에 굳으면 영원히 빈 값이 캐시된다
const TOP_N = 3000;
const TTL = 600;                          // 10분 — 순위는 실시간일 필요가 없다

let cache: { at: number; data: Record<string, number> } | null = null;

export async function GET() {
  if (cache && Date.now() - cache.at < TTL * 1000) {
    return NextResponse.json({ scores: cache.data, cached: true });
  }
  const r = redis();
  if (!r) return NextResponse.json({ scores: {}, reason: "no_redis" });
  try {
    // 점수 높은 순 상위 N — WITHSCORES 로 한 번에 받는다
    const flat = await r.zrevrange("fame:total", 0, TOP_N - 1, "WITHSCORES");
    const scores: Record<string, number> = {};
    for (let i = 0; i < flat.length; i += 2) scores[flat[i]] = Number(flat[i + 1]);
    cache = { at: Date.now(), data: scores };
    return NextResponse.json({ scores, count: Object.keys(scores).length });
  } catch (e) {
    console.error("[popularity]", (e as Error).message.slice(0, 120));
    // 빈 결과와 실패를 구분해서 보낸다 — 클라이언트는 어느 쪽이든 fame 으로 폴백한다
    return NextResponse.json({ scores: {}, reason: "redis_error" });
  }
}

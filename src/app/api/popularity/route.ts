import { NextResponse } from "next/server";
import { Pool } from "pg";

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
let pool: Pool | null = null;
function getPool() {
  if (!process.env.DB_VIBERS_MAIN_URL) return null;
  pool ??= new Pool({ connectionString: process.env.DB_VIBERS_MAIN_URL, max: 2, idleTimeoutMillis: 10_000 });
  return pool;
}

export async function GET() {
  if (cache && Date.now() - cache.at < TTL * 1000) {
    return NextResponse.json({ scores: cache.data, cached: true });
  }
  const db = getPool();
  if (!db) return NextResponse.json({ scores: {}, reason: "fame_fallback" });
  try {
    const result = await db.query(`SELECT brand_id,
      SUM(hit_count * CASE hit_type WHEN 'download' THEN 10 WHEN 'ad' THEN 5
        WHEN 'view' THEN 3 WHEN 'search' THEN 2 WHEN 'dwell' THEN 2 ELSE 0 END)::bigint AS score
      FROM semologo.logo_hits GROUP BY brand_id
      ORDER BY score DESC LIMIT $1`, [TOP_N]);
    const scores = Object.fromEntries(result.rows.map(row => [row.brand_id, Number(row.score)]));
    cache = { at: Date.now(), data: scores };
    return NextResponse.json({ scores, cached: false });
  } catch (error) {
    console.error("logo popularity read failed", error);
    return NextResponse.json({ scores: {}, reason: "fame_fallback" });
  }
}

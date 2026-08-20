import Link from "next/link";
import { assetUrl } from "@/lib/cdn";
import type { Brand } from "@/lib/brands";

/**
 * '오늘의 로고' — 등록된 로고 중 무작위로 골라 보여준다.
 *
 * 왜 완전 무작위가 아니라 **날짜 시드**인가 (둘 다 실제 위험이다):
 *
 *  ① 캐시 — 요청마다 다른 로고를 서버에서 그리면 Next.js 페이지 캐시
 *     (x-nextjs-cache: HIT)가 매번 빗나가 오리진이 전부 렌더한다.
 *     4만 개 목록을 파싱하는 페이지라 부하가 실제로 늘어난다.
 *  ② 하이드레이션 — 서버와 클라이언트가 다른 값을 뽑으면 React 가 화면을
 *     통째로 갈아끼운다. 이 프로젝트는 이미 정렬 순서로 같은 사고를 겪었다
 *     (2026-08-17, sortForGrid 주석 참고).
 *
 * 날짜를 시드로 쓰면 하루 동안 결과가 고정돼 둘 다 피하면서도 매일 바뀐다.
 * 뽑기 비용은 실측 0.005ms 라 무시해도 된다 — 비싼 건 뽑기가 아니라 캐시 손실이다.
 */

/** mulberry32 — 짧고 분포가 고른 시드 PRNG. 외부 의존성을 안 쓰려고 인라인한다. */
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** KST 기준 오늘 날짜(YYYYMMDD)를 시드로. 서버가 UTC 라도 한국 날짜로 맞춘다. */
export function todaySeed(now = new Date()): number {
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  return kst.getUTCFullYear() * 10000 + (kst.getUTCMonth() + 1) * 100 + kst.getUTCDate();
}

/**
 * 로고가 있는 브랜드 중 count 개를 시드 기반으로 중복 없이 고른다.
 *
 * ⚠️ 전체 4만개에서 그냥 뽑으면 안 된다. 위키미디어 대량수집분이 대부분이라
 *    'margaret-thatcher-foundation'·'바티칸 약국' 같은 무명 항목만 나와
 *    쇼케이스로서 가치가 없다(실측 확인).
 *    별칭이나 변형이 달린 브랜드는 사람이 손댄 흔적이라 인지도 대리 지표가
 *    된다 — 이 풀(약 2,000개)에서 뽑으면 토스·유튜브·KT·Epson 처럼
 *    알아볼 만한 것이 나온다. 풀이 비면 전체로 자동 폴백한다.
 */
export function pickDaily(brands: Brand[], count: number, seed: number): Brand[] {
  const withLogo = brands.filter(b => !b.variant_of && (b.has_svg || b.has_png));
  const curated = withLogo.filter(b => (b.aliases?.length ?? 0) > 0 || (b.variants_n ?? 0) > 1);
  const pool = curated.length >= count * 4 ? curated : withLogo;
  if (pool.length <= count) return pool;
  const rand = rng(seed);
  const seen = new Set<number>();
  const out: Brand[] = [];
  // 부분 샘플링 — 전체 셔플(4만개 6.2ms)을 피한다
  while (out.length < count && seen.size < pool.length) {
    const i = Math.floor(rand() * pool.length);
    if (seen.has(i)) continue;
    seen.add(i);
    out.push(pool[i]);
  }
  return out;
}

export default function DailyPicks({ brands }: { brands: Brand[] }) {
  const picks = pickDaily(brands, 12, todaySeed());
  if (picks.length === 0) return null;

  return (
    <section className="pt-5 pb-1">
      <div className="flex items-baseline gap-2 mb-3">
        <h2 className="text-xs font-semibold text-gray-500 tracking-wider uppercase">
          오늘의 로고
        </h2>
        <span className="text-xs text-gray-400">매일 바뀝니다</span>
      </div>
      {/* 가로 스크롤 — 모바일에서 다음 장이 살짝 보이게 해 스크롤 가능함을 알린다 */}
      <div
        className="flex gap-3 overflow-x-auto pb-2"
        style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}
      >
        {picks.map(b => (
          <Link
            key={b.id}
            href={`/brand/${b.id}/`}
            className="shrink-0 flex flex-col items-center justify-center gap-2 rounded-xl transition-transform"
            style={{
              width: 116, height: 104, scrollSnapAlign: "start",
              background: b.light ? "#1a1a1a" : "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            <img
              src={assetUrl(b.id, b.has_svg ? "logo.svg" : "logo.png")}
              alt={b.name_ko || b.name_en}
              loading="lazy"
              style={{ maxWidth: 72, maxHeight: 40, objectFit: "contain" }}
            />
            <span
              className="text-[11px] px-2 text-center leading-tight line-clamp-1"
              style={{ color: b.light ? "#e5e5e5" : "var(--text-secondary)" }}
            >
              {b.name_ko || b.name_en}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

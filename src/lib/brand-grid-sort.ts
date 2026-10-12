import type { Brand, SortMode } from "./brands";

/** Sort server-reviewed catalog records without bundling every asset manifest. */
export function sortPreparedBrands(
  brands: Brand[],
  mode: SortMode = "fame",
  /** 실제 히트 점수 {id: score}. 비어 있으면 fame 만 쓴다(콜드스타트). */
  hits: Record<string, number> = {},
  /** '교체 필요'로 신고된 id. 인기순에서만 뒤로 보낸다(목록에선 계속 보인다). */
  flagged: Set<string> = new Set(),
): Brand[] {
  const hasLogo = (b: Brand) => !!(b.logo_svg || b.has_svg || b.logo_png || b.has_png);
  // ⚠️ 보조 기준으로 **넘겨받은 배열의 위치를 쓰면 안 된다.** 이미 정렬된 목록을
  //    다시 정렬하면 순서가 통째로 뒤집힌다 — 서버가 정렬한 60장을 클라이언트가
  //    재정렬해 kspo 가 맨 뒤로 가고 balderton 이 앞으로 왔다(2026-08-17).
  //    brands-slim.json 이 실어 보내는 seq(추가 순서)를 쓰면 몇 번을 정렬해도 같다.
  const fallback = new Map(brands.map((b, i) => [b.id, i]));
  const seqOf = (b: Brand) => b.seq ?? fallback.get(b.id) ?? 0;
  return brands
    .filter((b) => !b.variant_of && !b.hidden && hasLogo(b))
    .sort((a, b) => {
      // 인기순 — fame 은 위키백과 언어판 수(Wikidata sitelinks). 인지도 대리 지표다.
      // 기본값을 최신순으로 두면 첫 화면이 위키미디어 대량수집분(무명 기관·단체)
      // 으로 채워진다. 랜덤으로 바꿔도 38,000개 중 대부분이 무명이라 해결이 안 된다.
      // fame 이 없으면 0 — 중간값으로 채우면 무명이 앞으로 올라온다.
      if (mode === "fame") {
        // 품질이 나쁘다고 신고된 로고는 인기순 상위를 차지하면 안 된다.
        // 지우거나 숨기지는 않는다 — 목록·검색에는 남겨 더 나은 버전을
        // 제보받을 통로를 유지한다. 순위에서만 맨 뒤로 보낸다.
        const fa = flagged.has(a.id) ? 1 : 0, fb = flagged.has(b.id) ? 1 : 0;
        if (fa !== fb) return fa - fb;
        // Measured popularity plus an explicit editorial boost determines discovery.
        // The boost never modifies stored traffic or analytics counts.
        const ha = (hits[a.id] ?? 0) + (a.discovery_boost ?? 0), hb = (hits[b.id] ?? 0) + (b.discovery_boost ?? 0);
        if (ha !== hb) return hb - ha;
        const byFame = (b.fame ?? 0) - (a.fame ?? 0);
        if (byFame !== 0) return byFame;
      }
      const byDate = (b.logo_published_at ?? b.added_at ?? "").localeCompare(a.logo_published_at ?? a.added_at ?? "");
      return byDate !== 0 ? byDate : seqOf(b) - seqOf(a);
    });
}


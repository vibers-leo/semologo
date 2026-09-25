"use client";

import { useLocale, T } from "@/lib/locale-context";
import { useMemo, useState, useEffect, useRef, useDeferredValue } from "react";
import dynamic from "next/dynamic";
import { Brand, sortForGrid, type CatalogStats, type SortMode } from "@/lib/brands";
import { CDN, VERSION } from "@/lib/cdn";
import { sendHit } from "@/lib/hit";
import { loadFlaggedIds } from "@/lib/logo-quality";
import { trackEvent } from "@/lib/analytics";
import BrandModal from "./BrandModal";
import { useSearch } from "@/lib/search-context";

const AdSlot = dynamic(() => import("./AdSlot"), { ssr: false });

// 카테고리 아이콘 매핑
const CAT_EMOJI: Record<string, string> = {
  "IT·테크": "💻", "AI·머신러닝": "🤖", "금융·결제": "💳", "미디어·엔터": "🎬",
  "뷰티·패션": "👗", "식품·음료": "🍱", "의료·바이오": "🏥", "유통·쇼핑": "🛍️",
  "자동차": "🚗", "건설·부동산": "🏗️", "제조·그룹": "🏭", "철강·중공업": "⚙️",
  "에너지·화학": "⚡", "물류·교통": "🚚", "게임": "🎮", "통신": "📡",
  "숙박·여행": "✈️", "공공·기관": "🏛️", "반려동물": "🐾", "스포츠": "⚽",
  "라이프스타일": "🎨", "개발도구": "🔧", "전자/IT": "💻", "금융/보험": "💳",
  "미디어/광고": "📺", "뷰티/패션": "👗", "식품/음료": "🍱", "제약/의료": "💊",
  "유통/쇼핑": "🛍️", "건설/부동산": "🏗️", "에너지/화학": "⚡", "엔터테인먼트": "🎬",
  "소셜미디어": "📱", "숙박/여행": "✈️", "공공/기관": "🏛️", "암호화폐·블록체인": "🪙",
  "국가·지역": "🌍", "Vibers 생태계": "🔷",
  "기타": "📦",
};

// 한 번에 붙는 카드 수 = 동시에 나가는 이미지 요청 수.
// 60이면 스크롤 한 번에 60장이 한꺼번에 요청돼 CDN 이 끊는다.
// 한 번에 붙이는 카드 수. 6,800여 개를 30개씩 늘리면 바닥에 닿을 때마다
// 조금씩만 자라서 '무한스크롤이 안 된다'고 느껴진다(실측: 5번 스크롤에 180개).
// 이미지는 loading="lazy" 라 DOM 카드를 더 붙여도 즉시 요청되지 않는다.
const PAGE_SIZE = 60;

/** 빌드 시점에 서버가 넘겨주는 첫 화면 카드. 이게 없으면 클라이언트가
 *  1.15MB JSON 을 받아 파싱할 때까지 그리드가 비어 있다(실측 1,000ms). */
export default function BrandGrid({
  initialBrands = [],
  initialCatalogStats = null,
}: {
  initialBrands?: Brand[];
  initialCatalogStats?: CatalogStats | null;
}) {
  const {en, t, path} = useLocale();
  const { query, selectedCats, toggleCat, clearCats } = useSearch();
  const [brands, setBrands] = useState<Brand[]>(initialBrands);
  const [loading, setLoading] = useState(initialBrands.length === 0);
  const [loadError, setLoadError] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogStats, setCatalogStats] = useState<CatalogStats | null>(initialCatalogStats);
  const [resultTotal, setResultTotal] = useState(initialCatalogStats?.visible ?? initialBrands.length);
  const allCatalogCount = catalogStats?.visible ?? resultTotal;
  const [selected, setSelected] = useState<Brand | null>(null);
  const [page, setPage] = useState(1);
  const [showAllCats, setShowAllCats] = useState(false);
  // 국내/해외 필터. Wikidata P17(국가) 근거인 origin 필드를 본다.
  // null = 전체. 한글명 유무로 대체하면 안 된다 — '스타벅스'는 한글명이 있어도 미국이다.
  const [origin, setOrigin] = useState<"KR" | "GLOBAL" | null>(null);
  // 파일형식 필터. PNG 만 있는 브랜드가 10,800건이라 벡터가 필요한 사람에게는
  // 목록 절반이 헛걸음이다. 숨기지 않고 **거를 수 있게** 한다.
  const [fmt, setFmt] = useState<"svg" | null>(null);
  // 그리드 정렬. 기본은 인기순 — 최신순이면 첫 화면이 위키미디어 대량수집분
  // (무명 기관·단체)으로 채워진다. 서버(page.tsx)와 같은 기본값이어야
  // 하이드레이션 때 화면이 안 튄다.
  const [sortMode, setSortMode] = useState<SortMode>("fame");
  // 실제 히트 기반 인기 점수. 없으면 빈 객체 → fame(위키백과 언어판 수)로 정렬한다.
  // 초기에는 히트가 0 이라 baseline 이 필요하고, 쌓일수록 실제 사용이 앞선다.
  const [hits, setHits] = useState<Record<string, number>>({});
  // '교체 필요'로 신고된 브랜드 — 인기순에서만 뒤로 보낸다(목록엔 남는다)
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  useEffect(() => {
    let alive = true;
    loadFlaggedIds()
      .then(s => { if (alive) setFlagged(s); })
      .catch(() => {});          // 실패해도 정렬은 계속된다
    return () => { alive = false; };
  }, []);
  // 작은 통계 파일로 필터 수치를 먼저 채운다. 전체 18만 건 목록을
  // 내려받기 전에도 카테고리·국내외·SVG 건수를 정확히 보여줄 수 있다.
  useEffect(() => {
    let alive = true;
    fetch(`${CDN}/stats.json?v=${VERSION}`, { cache: "force-cache" })
      .then(r => r.ok ? r.json() : null)
      .then(s => { if (alive && s && typeof s === "object") setCatalogStats(s); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  const requestIdRef = useRef(0);
  const busyRef = useRef(false);
  const nextPageRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/popularity/")
      .then(r => r.json())
      .then(d => { if (alive) setHits(d.scores ?? {}); })
      .catch(() => {});      // 실패해도 fame 으로 동작한다
    return () => { alive = false; };
  }, []);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const deferredQuery = useDeferredValue(query);
  const apiParams = new URLSearchParams();
  if (deferredQuery.trim()) apiParams.set("q", deferredQuery.trim());
  for (const category of Array.from(selectedCats).sort()) apiParams.append("category", category);
  if (origin) apiParams.set("origin", origin);
  if (fmt === "svg") apiParams.set("svg", "1");
  apiParams.set("sort", sortMode);
  const queryKey = apiParams.toString();

  const fetchPage = async (offset: number, replace: boolean, requestId: number) => {
    setCatalogLoading(true);
    setLoadError(false);
    try {
      const response = await fetch(`/api/catalog/?${queryKey}&offset=${offset}&limit=${PAGE_SIZE}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as { brands: Brand[]; total: number };
      if (requestId !== requestIdRef.current) return;
      setBrands(current => replace ? data.brands : [
        ...current,
        ...data.brands.filter(brand => !current.some(existing => existing.id === brand.id)),
      ]);
      setResultTotal(data.total);
      // 다음 스크롤에서 보일 첫 카드들을 브라우저 캐시에 미리 넣어
      // 카드가 화면에 들어오는 순간 빈 체커가 보이지 않게 한다.
      // 전체 60장을 한꺼번에 요청하지 않고 18장만 선예약해 네트워크 폭주를 막는다.
      if (typeof window !== "undefined") {
        for (const brand of data.brands.slice(0, 18)) {
          const src = typeof brand.logo_png === "string" && brand.logo_png.startsWith("/")
            ? brand.logo_png
            : `${CDN}/${brand.id}/${brand.logo_svg || brand.has_svg ? "logo.svg" : "logo-transparent.png"}?v=${VERSION}`;
          const warm = new window.Image();
          warm.decoding = "async";
          warm.src = src;
        }
      }
    } catch {
      if (requestId === requestIdRef.current) setLoadError(true);
    } finally {
      if (requestId === requestIdRef.current) {
        setCatalogLoading(false);
        setLoading(false);
        busyRef.current = false;
      }
    }
  };

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    busyRef.current = false;
    setPage(1);
    // SSR된 첫 60개는 API 응답 전까지 그대로 보여준다.
    const timer = window.setTimeout(() => fetchPage(0, true, requestId), deferredQuery.trim() ? 250 : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => window.clearTimeout(timer);
  }, [queryKey]);

  nextPageRef.current = () => {
    if (busyRef.current || brands.length >= resultTotal) return;
    busyRef.current = true;
    const requestId = requestIdRef.current;
    const offset = brands.length;
    setPage(current => current + 1);
    fetchPage(offset, false, requestId);
  };

  // 카테고리별 카운트 (실제 데이터 기반, 내림차순)
  const categoryStats = useMemo(() => {
    if (catalogStats?.categories) {
      return Object.entries(catalogStats.categories).sort((a, b) => {
        if (a[0] === "기타") return 1;
        if (b[0] === "기타") return -1;
        return b[1] - a[1];
      });
    }
    const map = new Map<string, number>();
    brands.forEach(b => {
      const cat = b.category || "기타";
      map.set(cat, (map.get(cat) || 0) + 1);
    });
    // '기타'는 개수가 가장 많아서(전체의 37%) 그냥 내림차순으로 두면 필터 맨 앞을
    // 차지한다. 분류가 안 된 묶음이지 사용자가 먼저 찾을 카테고리가 아니므로
    // 개수와 무관하게 항상 끝으로 보낸다.
    return Array.from(map.entries()).sort((a, b) => {
      if (a[0] === "기타") return 1;
      if (b[0] === "기타") return -1;
      return b[1] - a[1];
    });
  }, [brands, catalogStats]);

  const SHOW_LIMIT = 14; // 초기 노출 카테고리 수
  const visibleCats = showAllCats ? categoryStats : categoryStats.slice(0, SHOW_LIMIT);

  // 정렬은 brands 가 바뀔 때만 한다.
  // 예전엔 이 정렬이 filtered 안에 있어서 키 입력 한 번마다 6,800개 배열을
  // 복사·정렬(localeCompare 약 8.5만 회)했고, 그동안 메인 스레드가 막혀
  // 한글 IME 조합이 끊겼다("자음 입력 시 뚝뚝 끊김").
  // 서버(빌드 시 첫 화면)와 **같은 규칙**을 쓴다 — 어긋나면 하이드레이션 때 화면이 튄다
  const sorted = useMemo(
    () => sortForGrid(brands, sortMode, hits, flagged),
    [brands, sortMode, hits, flagged],
  );

  const filtered = sorted;

  // 버튼에 실제 개수를 보여줘야 신뢰가 간다 (0개인데 버튼만 있으면 고장으로 보인다)
  const localSvgCount = useMemo(
    () => brands.reduce((n, b) => n + (b.logo_svg || b.has_svg ? 1 : 0), 0),
    [brands]);
  const svgCount = catalogStats?.svg ?? localSvgCount;

  const originStats = useMemo(() => {
    let kr = 0, gl = 0;
    for (const b of brands) {
      if (b.origin === "KR") kr++;
      else if (b.origin === "GLOBAL") gl++;
    }
    return { kr, gl };
  }, [brands]);
  const originCounts = {
    kr: catalogStats?.kr ?? originStats.kr,
    gl: catalogStats?.global ?? originStats.gl,
  };

  const trackedSearches = useRef(new Set<string>());
  useEffect(() => {
    const term = deferredQuery.trim();
    if (!term || trackedSearches.current.has(term)) return;
    const timer = window.setTimeout(() => {
      trackedSearches.current.add(term);
      // 한 세션에서 지나치게 많은 이벤트가 쌓이지 않도록 상한을 둔다.
      if (trackedSearches.current.size > 50) trackedSearches.current.clear();
      trackEvent("search_submitted", { search_term: term, result_count: resultTotal });
      if (resultTotal === 0) trackEvent("search_no_result", { search_term: term });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [deferredQuery, resultTotal]);

  const visible = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = visible.length < resultTotal;

  useEffect(() => {
    if (!sentinelRef.current || !hasMore || catalogLoading) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting) nextPageRef.current?.();
    }, { rootMargin: "550px" });
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [hasMore, catalogLoading, visible.length]);

  // URL hash로 브랜드 모달 자동 열기 (링크 공유 지원)
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      const b = brands.find(x => x.id === hash);
      if (b) setSelected(b);
    }
  }, [brands]);

  if (loading) {
    return (
      <div style={{ padding: "80px 0", textAlign: "center", color: "#a1a1aa" }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>⏳</div>
        <div style={{ fontSize: 14 }}><T>{"로고 데이터 로딩 중..."}</T></div>
      </div>
    );
  }

  // 첫 화면 카드가 이미 있으면 전체 카탈로그만 다시 시도하게 둔다. 첫 60개까지
  // 숨겨 버리면 일시적인 CDN 오류가 곧 서비스 전체 오류 화면으로 보인다.
  if (loadError && brands.length === 0) {
    return (
      <div style={{ padding: "80px 0", textAlign: "center", color: "var(--text-secondary)" }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>⚠️</div>
        <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}><T>{"로고 목록을 불러오지 못했어요"}</T></p>
        <p style={{ fontSize: 13, marginTop: 6 }}><T>{"잠시 후 다시 시도해 주세요."}</T></p>
        <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 rounded-full text-sm font-semibold border" style={{ borderColor: "var(--border)" }}><T>{"다시 시도"}</T></button>
      </div>
    );
  }

  return (
    <>
      {/* 넓은 화면에서만 콘텐츠를 가리지 않는 우측 고정 세로 광고 */}
      <aside className="hidden 2xl:block fixed right-6 top-28 z-30" aria-label="광고">
        <AdSlot />
      </aside>

      {/* ── 국내/해외 필터 ── */}
      {(originCounts.kr > 0 || originCounts.gl > 0) && (
        <div className="pt-5 pb-1">
          <div className="text-xs font-semibold text-gray-500 tracking-wider uppercase mb-3"><T>{"지역"}</T></div>
          <div className="flex flex-wrap gap-2">
            {([
              [null, "전체", allCatalogCount],
              ["KR", "🇰🇷 국내", originCounts.kr],
              ["GLOBAL", "🌏 해외", originCounts.gl],
            ] as const).map(([val, label, count]) => {
              const on = origin === val;
              return (
                <button key={t(label)} onClick={() => setOrigin(val)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all"
                  style={on
                    ? { background: "#111", color: "#fff", border: "1.5px solid #111", transform: "scale(1.02)" }
                    : { background: "var(--surface)", color: "var(--text-secondary)", border: "1.5px solid var(--border)" }
                  }>
                  {t(label)}
                  <span className="text-xs opacity-60">{count.toLocaleString()}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 파일형식 필터 ── */}
      {svgCount > 0 && (
        <div className="pt-5 pb-1">
          <div className="text-xs font-semibold text-gray-500 tracking-wider uppercase mb-3"><T>{"파일형식"}</T></div>
          <div className="flex flex-wrap gap-2">
            {([
              [null, "전체", allCatalogCount],
              ["svg", "SVG 있음", svgCount],
            ] as const).map(([val, label, count]) => {
              const on = fmt === val;
              return (
                <button key={t(label)} onClick={() => setFmt(val)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all"
                  style={on
                    ? { background: "#111", color: "#fff", border: "1.5px solid #111", transform: "scale(1.02)" }
                    : { background: "var(--surface)", color: "var(--text-secondary)", border: "1.5px solid var(--border)" }
                  }>
                  {t(label)}
                  <span className="text-xs opacity-60">{count.toLocaleString()}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 태그 클라우드 카테고리 필터 ── */}
      <div className="py-5">
        {/* 선택 상태 헤더 */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-semibold text-gray-500 tracking-wider uppercase"><T>{"카테고리"}</T>{selectedCats.size > 0 && (
              <span className="ml-2 text-indigo-600">{selectedCats.size}<T>{"개 선택됨"}</T></span>
            )}
          </div>
          {selectedCats.size > 0 && (
            <button onClick={clearCats}
              className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1 transition-colors">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg><T>{"전체 초기화"}</T></button>
          )}
        </div>

        {/* 태그 클라우드 */}
        <div className="flex flex-wrap gap-2">
          {visibleCats.map(([cat, count]) => {
            const isSelected = selectedCats.has(cat);
            const emoji = CAT_EMOJI[cat] || "📦";
            return (
              <button key={t(cat)} onClick={() => toggleCat(cat)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all"
                style={isSelected
                  ? { background: "#111", color: "#fff", border: "1.5px solid #111", transform: "scale(1.02)" }
                  : { background: "var(--surface)", color: "var(--text-secondary)", border: "1.5px solid var(--border)" }
                }>
                <span style={{ fontSize: 13 }}>{emoji}</span>
                {t(cat)}
                <span className="text-xs opacity-60 ml-0.5">{count.toLocaleString()}</span>
              </button>
            );
          })}

          {/* 더보기 / 접기 */}
          {categoryStats.length > SHOW_LIMIT && (
            <button onClick={() => setShowAllCats(v => !v)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
              style={{ border: "1.5px dashed var(--border)", color: "var(--text-secondary)" }}>
              {showAllCats
                ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m18 15-6-6-6 6"/></svg><T>{"접기"}</T></>
                : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6"/></svg> +{categoryStats.length - SHOW_LIMIT}<T>{"개 더보기"}</T></>
              }
            </button>
          )}
        </div>

        {/* 선택된 카테고리 요약 칩 */}
        {selectedCats.size > 0 && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
            <span className="text-xs text-gray-400 shrink-0"><T>{"선택:"}</T></span>
            <div className="flex flex-wrap gap-1.5">
              {Array.from(selectedCats).map(cat => (
                <button key={t(cat)} onClick={() => toggleCat(cat)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{ background: "rgba(99,102,241,.1)", color: "#6366f1", border: "1px solid rgba(99,102,241,.2)" }}>
                  {t(cat)}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 6 6 18M6 6l12 12"/>
                  </svg>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 결과 카운트 ── */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          <span className="font-semibold text-gray-900">{resultTotal.toLocaleString()}</span><T>{"개 브랜드"}</T>{/* 정렬 토글 — 기본 인기순. 최신순도 남겨 새로 들어온 로고를 볼 수 있게 한다. */}
          <span style={{ marginLeft: 12, display: "inline-flex", gap: 4 }}>
            {([["fame", "인기순"], ["recent", "최신순"]] as const).map(([m2, label]) => (
              <button key={m2} onClick={() => { setSortMode(m2); setPage(1); }}
                style={{
                  fontSize: 12, padding: "3px 10px", borderRadius: 999, cursor: "pointer",
                  border: "1px solid var(--border)",
                  background: sortMode === m2 ? "#111" : "transparent",
                  color: sortMode === m2 ? "#fff" : "var(--text-secondary)",
                }}>
                {t(label)}
              </button>
            ))}
          </span>
          {query && <span className="ml-2 text-indigo-500">"{query}<T>{"\" 검색 결과"}</T></span>}
          {selectedCats.size > 0 && !query && (
            <span className="ml-2 text-indigo-500"><T>{"필터 적용됨"}</T></span>
          )}
        </p>
        {(query || selectedCats.size > 0) && (
          <button onClick={() => { clearCats(); }}
            className="text-xs text-gray-400 hover:text-gray-700 transition-colors"><T>{"필터 해제"}</T></button>
        )}
      </div>

      {/* ── 카드 그리드 ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-6 gap-3">
        {visible.map((brand, i) => (
            <BrandCard
              key={brand.id}
              brand={brand}
              onClick={() => {
                setSelected(brand);
                history.replaceState(null, "", path(`/brand/${brand.id}`));
              }}
              priority={i < 24}
            />
        ))}
      </div>

      {hasMore && (
        <div ref={sentinelRef} className="flex flex-col items-center gap-2 pt-6">
          <button type="button" disabled={catalogLoading} onClick={() => nextPageRef.current?.()}
            className="rounded-full border px-5 py-2 text-sm font-semibold transition-colors hover:bg-gray-50"
            style={{ borderColor: "var(--border)", color: "var(--text)", opacity: catalogLoading ? 0.6 : 1 }}>
            {catalogLoading ? <T>{"로고를 불러오고 있어요"}</T> : <T>{"로고 60개 더 보기"}</T>}
          </button>
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {visible.length.toLocaleString()} / {resultTotal.toLocaleString()}<T>{"개 표시 중"}</T></span>
        </div>
      )}

      {loadError && (
        <div role="status" className="flex justify-center pt-5">
          <button type="button" onClick={() => {
            const requestId = ++requestIdRef.current;
            busyRef.current = false;
            fetchPage(0, true, requestId);
          }} className="rounded-full border px-4 py-2 text-sm font-medium"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}>
            <T>{"로고를 불러오지 못했어요. 다시 불러오기"}</T>
          </button>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-24" style={{ color: "var(--text-secondary)" }}>
          <p className="text-4xl mb-3">🔍</p>
          <p className="font-medium"><T>{"검색 결과가 없어요"}</T></p>
          <p className="text-sm mt-1"><T>{"다른 키워드로 검색하거나 필터를 해제해보세요"}</T></p>
          {(query || selectedCats.size > 0) && (
            <button onClick={() => clearCats()}
              className="mt-4 px-4 py-2 rounded-full text-sm font-medium text-white"
              style={{ background: "#111" }}><T>{"필터 모두 해제"}</T></button>
          )}
        </div>
      )}

      {selected && (
        <BrandModal
          brand={selected}
          onClose={() => {
            setSelected(null);
            history.replaceState(null, "", path("/"));
          }}
          allBrands={brands}
          onSelectBrand={b => {
            setSelected(b);
            history.replaceState(null, "", path(`/brand/${b.id}`));
          }}
        />
      )}
    </>
  );
}

function BrandCard({ brand, onClick, priority }: { brand: Brand; onClick: () => void; priority: boolean }) {
  const {en, t} = useLocale();
  const svgUrl = `${CDN}/${brand.id}/${brand.svg_transparent || "logo.svg"}?v=${VERSION}`;
  const pngUrl = `${CDN}/${brand.id}/logo.png?v=${VERSION}`;
  const transparentUrl = `${CDN}/${brand.id}/logo-transparent.png?v=${VERSION}`;
  const hasSvg = !!(brand.logo_svg || brand.has_svg);
  const hasPng = !!(brand.logo_png || brand.has_png);
  const directPng = typeof brand.logo_png === "string" && brand.logo_png.startsWith("/")
    ? brand.logo_png : pngUrl;
  // PNG 원본은 기관 배포물의 흰 캔버스를 포함하는 경우가 많다.
  // 카드에서는 자동으로 여백·흰 배경을 제거한 파생물을 먼저 보여주고,
  // 원본 파일은 상세 화면의 다운로드 카드에서 그대로 제공한다.
  const initSrc = hasSvg ? svgUrl : (typeof brand.logo_png === "string" && brand.logo_png.startsWith("/") ? directPng : transparentUrl);

  return (
    <div className="logo-card" onClick={() => { trackEvent("brand_opened", { brand_id: brand.id, category: brand.category || "기타" }); sendHit(brand.id, "view"); onClick(); }}>
      {/* 흰색 로고는 밝은 체커 배경에서 안 보여 '빈 카드'처럼 된다 → 어두운 배경 */}
      <div className="card-preview" style={(brand.light || brand.light_logo || brand.dark_variant === "white") ? { background: "#18181b", backgroundImage: "none" } : undefined}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={initSrc} alt={en ? brand.name_en || brand.name_ko : brand.name_ko} width={320} height={180}
          decoding="async" fetchPriority={priority ? "high" : "auto"} loading={priority ? "eager" : "lazy"}
          onLoad={e => {
            // 재시도로 살아났으면 자리표시자를 걷어낸다
            const img = e.currentTarget as HTMLImageElement;
            img.style.display = "";
              // 실제로 그려진 것만 보이게 한다 — 로딩 전엔 브라우저가
              // '깨진 아이콘 + alt 텍스트'를 그려 화면이 지저분해진다
              img.dataset.loaded = "1";
            img.parentElement?.querySelector(".card-fallback")?.remove();
          }}
          onError={e => {
            const img = e.currentTarget as HTMLImageElement;
            if (hasPng && img.src !== directPng) {
              img.src = directPng;
              return;
            }
            // 일부 레거시 항목은 metadata에는 PNG가 있지만 기본 파일 대신
            // 투명/다크 변형만 CDN에 남아 있다. 카드가 빈칸이 되지 않도록 한 번 더 시도한다.
            if (img.src !== transparentUrl) {
              img.src = transparentUrl;
              return;
            }
            // 한 번은 다시 시도한다.
            // 빠르게 스크롤하면 요청이 몰려 CDN rate-limit·취소로 실패하는데,
            // 그건 파일이 없는 게 아니라 일시적인 것이다. 잠깐 뒤 재시도하면
            // 대부분 복구된다 (실측: 전량 실패 → 전량 복구).
            // 실패는 대부분 '파일 없음'이 아니라 요청 폭주로 CDN 이 끊은 것이다.
            // 스로틀이 풀릴 때까지 지수 백오프로 기다렸다 다시 시도한다.
            // (2회·최대 1.2초로는 부족해 자리표시자가 그대로 남았다)
            const tries = Number(img.dataset.retry ?? 0);
            if (tries < 4) {
              img.dataset.retry = String(tries + 1);
              const src = img.src;
              const wait = 500 * Math.pow(2, tries) + Math.random() * 400;
              setTimeout(() => { img.src = ""; img.src = src; }, wait);
              return;
            }
            // 카드를 숨기면 안 된다.
            // 빠르게 스크롤하면 lazy 이미지가 한꺼번에 요청되면서 CDN
            // rate-limit·브라우저 취소로 onError 가 무더기로 난다. 그때 카드를
            // display:none 하면 그리드가 계속 줄어들어(실측: 1,500장 중 1,260장
            // 숨김) 스크롤 위치 아래가 텅 비어 보인다.
            // 일시적 실패와 진짜 없는 파일은 구분할 수 없으므로, 카드는 그대로
            // 두고 자리표시자만 띄운다.
            img.style.display = "none";
            const box = img.parentElement;
            if (box && !box.querySelector(".card-fallback")) {
              const ph = document.createElement("div");
              ph.className = "card-fallback";
              ph.textContent = (brand.name_en || brand.name_ko || "?").charAt(0).toUpperCase();
              ph.style.cssText =
                "position:absolute;inset:0;display:flex;align-items:center;" +
                "justify-content:center;font-size:44px;font-weight:800;color:#d4d4d8";
              box.appendChild(ph);
            }
          }} />
      </div>
      {/* 이름은 한 줄을 통째로 쓴다. 예전엔 이름과 SVG/PNG 배지가 같은 줄에
            나란히 있어서 배지가 이름을 밀어냈고 긴 브랜드명이 대부분 잘렸다.
            카테고리와 배지를 아래 줄에 함께 두면 둘 다 온전히 보인다. */}
        <div className="card-info">
          <div className="card-name truncate">
            {en ? brand.name_en || brand.name_ko : brand.name_ko}
            {!en && brand.name_en && brand.name_en !== brand.name_ko && (
              <span className="card-name-en"> / {brand.name_en}</span>
            )}
          </div>
          <div className="card-meta">
            <span className="card-category truncate">{t(brand.category || "기타")}</span>
            <span className="card-tags">
              {hasSvg && <span className="card-tag tag-svg">SVG</span>}
              {hasPng && <span className="card-tag tag-png">PNG</span>}
            </span>
          </div>
        </div>
    </div>
  );
}

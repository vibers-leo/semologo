"use client";

import { useMemo, useState, useEffect, useRef, useDeferredValue } from "react";
import dynamic from "next/dynamic";
import { Brand } from "@/lib/brands";
import BrandModal from "./BrandModal";
import { useSearch } from "@/lib/search-context";
import { isChoseongQuery, choseongIndex } from "@/lib/hangul";

const AdSlot = dynamic(() => import("./AdSlot"), { ssr: false });
const AD_INTERVAL = 12;

const CDN = process.env.NEXT_PUBLIC_CDN_URL || "https://logo.vibers.co.kr/_clients";
const VERSION = "1786450862";

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
const PAGE_SIZE = 30;

export default function BrandGrid() {
  const { query, selectedCats, toggleCat, clearCats } = useSearch();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Brand | null>(null);
  const [page, setPage] = useState(1);
  const [showAllCats, setShowAllCats] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // ?v= 없이 force-cache 로 받으면 브랜드 목록이 영구히 갱신되지 않는다
    // (신규 브랜드를 추가해도 기존 방문자에게 안 보임)
    fetch(`${CDN}/brands-slim.json?v=${VERSION}`, { cache: "force-cache" })
      .then(r => r.json())
      .then(d => {
        const list = Array.isArray(d) ? d : (d.brands ?? []);
        setBrands(list);
      })
      .finally(() => setLoading(false));
  }, []);

  // 카테고리별 카운트 (실제 데이터 기반, 내림차순)
  const categoryStats = useMemo(() => {
    const map = new Map<string, number>();
    brands.forEach(b => {
      const cat = b.category || "기타";
      map.set(cat, (map.get(cat) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [brands]);

  const SHOW_LIMIT = 14; // 초기 노출 카테고리 수
  const visibleCats = showAllCats ? categoryStats : categoryStats.slice(0, SHOW_LIMIT);

  // 정렬은 brands 가 바뀔 때만 한다.
  // 예전엔 이 정렬이 filtered 안에 있어서 키 입력 한 번마다 6,800개 배열을
  // 복사·정렬(localeCompare 약 8.5만 회)했고, 그동안 메인 스레드가 막혀
  // 한글 IME 조합이 끊겼다("자음 입력 시 뚝뚝 끊김").
  const sorted = useMemo(() => {
    const hasLogo = (b: Brand) => !!(b.logo_svg || b.has_svg || b.logo_png || b.has_png);
    // variant_of = 부모로 흡수된 중복 항목(예: adobe-icon). 목록에는 안 띄운다.
    // 페이지는 살아 있어서 기존 링크는 그대로 동작한다.
    // 로고가 아예 없는 항목도 여기서 뺀다 — 빈 카드가 되기 때문.
    return [...brands].filter(b => !b.variant_of && hasLogo(b)).sort((a, b) => {
      const la = hasLogo(a) ? 1 : 0;
      const lb = hasLogo(b) ? 1 : 0;
      if (lb !== la) return lb - la;          // 로고 있는 것 우선
      return (b.added_at ?? "").localeCompare(a.added_at ?? "");  // 그 다음 최신순
    });
  }, [brands]);

  // 검색용 소문자 문자열을 미리 만들어 둔다 (매 입력마다 toLowerCase 2만 회 방지)
  const haystack = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of sorted) {
      m.set(b.id, `${b.name_ko} ${b.name_en} ${b.id} ${(b.aliases ?? []).join(" ")}`.toLowerCase());
    }
    return m;
  }, [sorted]);

  // 입력은 즉시 반영하되 무거운 필터링은 한 박자 미룬다 → 타이핑이 끊기지 않는다
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    let list = sorted;
    const raw = deferredQuery.trim();
    const q = raw.toLowerCase();
    if (q) {
      // 자음 낱자가 섞였으면 초성 검색 — "ㅅㅅ" 으로 삼성을 찾을 수 있어야 한다.
      // 일반 부분일치도 함께 시도해 "삼성" 같은 기존 입력을 깨지 않는다.
      // 초성이든 일반 입력이든 같은 규칙으로 순위를 매긴다.
      //   ① 정확히 일치      "삼성" → 삼성  (없으면 삼성중공업·삼성물산이 위로 온다)
      //   ② 앞글자 매치      "ㅅㅅ" → 삼성…  (없으면 골드만'삭스'가 위로 온다)
      //   ③ 중간 매치
      // 예전엔 초성일 때만 순위를 매기고 일반 입력은 그냥 필터라, 브랜드
      // 이름을 정확히 쳐도 본체가 상위에 안 나왔다.
      const cho = isChoseongQuery(raw);
      const scored: { b: Brand; rank: number }[] = [];
      for (const b of list) {
        const alias = b.aliases ?? [];
        // 별칭도 초성 대상에 넣는다 — 'ㅇㅈ' 로 '엘지'를 찾을 수 있어야 한다
        const idx = cho
          ? Math.max(choseongIndex(raw, b.name_ko), ...alias.map(a => choseongIndex(raw, a)))
          : -1;
        const hay = haystack.get(b.id) ?? "";
        const textAt = hay.indexOf(q);
        if (idx < 0 && textAt < 0) continue;

        const exact =
          b.id.toLowerCase() === q ||
          (b.name_en ?? "").toLowerCase() === q ||
          (b.name_ko ?? "").toLowerCase() === q ||
          alias.some(a => a.toLowerCase() === q);

        const at = idx === 0 || textAt === 0
          ? 0
          : Math.min(...[idx, textAt].filter(x => x >= 0)) + 1;
        // 같은 순위면 이름이 짧은 쪽을 위로. "ㅅㅅ" 에 삼성중공업·삼성 모바일이
        // 삼성보다 먼저 나오던 걸 잡는다 (짧은 이름일수록 본체일 확률이 높다).
        scored.push({ b, rank: (exact ? -1000 : 0) + at * 100 + (b.name_ko?.length ?? 99) });
      }
      scored.sort((x, y) => x.rank - y.rank);
      list = scored.map(x => x.b);
    }
    if (selectedCats.size > 0) {
      list = list.filter(b => selectedCats.has(b.category || "기타"));
    }
    return list;
  }, [sorted, haystack, deferredQuery, selectedCats]);

  // 렌더 중 setState 금지 — 예전엔 useMemo 안에서 setPage(1) 를 불러
  // 입력마다 렌더가 두 번씩 돌았다.
  useEffect(() => { setPage(1); }, [deferredQuery, selectedCats]);

  const visible = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = visible.length < filtered.length;

  // 무한스크롤 — 페이지 추가에 쿨다운을 둔다.
  // 없으면 빠르게 스크롤할 때 관찰자가 연달아 발화해 한 번에 여러 페이지가
  // 붙고, 이미지 수백 개가 동시에 요청돼 CDN 이 끊어버린다(실측 실패 700건+).
  const lastGrow = useRef(0);
  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const obs = new IntersectionObserver(
      entries => {
        if (!entries[0].isIntersecting) return;
        const now = Date.now();
        if (now - lastGrow.current < 500) return;
        lastGrow.current = now;
        setPage(p => p + 1);
      },
      { rootMargin: "200px" }
    );
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [hasMore, visible.length]);

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
        <div style={{ fontSize: 14 }}>로고 데이터 로딩 중...</div>
      </div>
    );
  }

  return (
    <>
      {/* ── 태그 클라우드 카테고리 필터 ── */}
      <div className="py-5">
        {/* 선택 상태 헤더 */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-semibold text-gray-500 tracking-wider uppercase">
            카테고리
            {selectedCats.size > 0 && (
              <span className="ml-2 text-indigo-600">{selectedCats.size}개 선택됨</span>
            )}
          </div>
          {selectedCats.size > 0 && (
            <button onClick={clearCats}
              className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1 transition-colors">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
              전체 초기화
            </button>
          )}
        </div>

        {/* 태그 클라우드 */}
        <div className="flex flex-wrap gap-2">
          {visibleCats.map(([cat, count]) => {
            const isSelected = selectedCats.has(cat);
            const emoji = CAT_EMOJI[cat] || "📦";
            return (
              <button key={cat} onClick={() => toggleCat(cat)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all"
                style={isSelected
                  ? { background: "#111", color: "#fff", border: "1.5px solid #111", transform: "scale(1.02)" }
                  : { background: "var(--surface)", color: "var(--text-secondary)", border: "1.5px solid var(--border)" }
                }>
                <span style={{ fontSize: 13 }}>{emoji}</span>
                {cat}
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
                ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m18 15-6-6-6 6"/></svg> 접기</>
                : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6"/></svg> +{categoryStats.length - SHOW_LIMIT}개 더보기</>
              }
            </button>
          )}
        </div>

        {/* 선택된 카테고리 요약 칩 */}
        {selectedCats.size > 0 && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
            <span className="text-xs text-gray-400 shrink-0">선택:</span>
            <div className="flex flex-wrap gap-1.5">
              {Array.from(selectedCats).map(cat => (
                <button key={cat} onClick={() => toggleCat(cat)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{ background: "rgba(99,102,241,.1)", color: "#6366f1", border: "1px solid rgba(99,102,241,.2)" }}>
                  {cat}
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
          <span className="font-semibold text-gray-900">{filtered.length.toLocaleString()}</span>개 브랜드
          {query && <span className="ml-2 text-indigo-500">"{query}" 검색 결과</span>}
          {selectedCats.size > 0 && !query && (
            <span className="ml-2 text-indigo-500">필터 적용됨</span>
          )}
        </p>
        {(query || selectedCats.size > 0) && (
          <button onClick={() => { clearCats(); }}
            className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
            필터 해제
          </button>
        )}
      </div>

      {/* ── 카드 그리드 ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-6 gap-3">
        {visible.map((brand, i) => (
          <>
            <BrandCard
              key={brand.id}
              brand={brand}
              onClick={() => {
                setSelected(brand);
                history.replaceState(null, "", `/brand/${brand.id}`);
              }}
              priority={i < 12}
            />
            {(i + 1) % AD_INTERVAL === 0 && (
              // 미노출 광고가 자리를 잡았다 사라지면 스크롤 중 문서 높이가
              // 계속 줄어 화면이 밀린다. minHeight 를 주지 않고, AdSlot 이
              // 채워졌다고 판단했을 때만 스스로 공간을 잡게 한다.
              <div key={`ad-${i}`} style={{ gridColumn: "1 / -1" }}>
                <AdSlot slot="2847591036" format="horizontal" />
              </div>
            )}
          </>
        ))}
      </div>

      {hasMore && <div ref={sentinelRef} style={{ height: 1 }} />}

      {filtered.length === 0 && (
        <div className="text-center py-24" style={{ color: "var(--text-secondary)" }}>
          <p className="text-4xl mb-3">🔍</p>
          <p className="font-medium">검색 결과가 없어요</p>
          <p className="text-sm mt-1">다른 키워드로 검색하거나 필터를 해제해보세요</p>
          {(query || selectedCats.size > 0) && (
            <button onClick={() => clearCats()}
              className="mt-4 px-4 py-2 rounded-full text-sm font-medium text-white"
              style={{ background: "#111" }}>
              필터 모두 해제
            </button>
          )}
        </div>
      )}

      {selected && (
        <BrandModal
          brand={selected}
          onClose={() => {
            setSelected(null);
            history.replaceState(null, "", "/");
          }}
          allBrands={brands}
          onSelectBrand={b => {
            setSelected(b);
            history.replaceState(null, "", `/brand/${b.id}`);
          }}
        />
      )}
    </>
  );
}

function BrandCard({ brand, onClick, priority }: { brand: Brand; onClick: () => void; priority: boolean }) {
  const svgUrl = `${CDN}/${brand.id}/logo.svg?v=${VERSION}`;
  const pngUrl = `${CDN}/${brand.id}/logo.png?v=${VERSION}`;
  const hasSvg = !!(brand.logo_svg || brand.has_svg);
  const hasPng = !!(brand.logo_png || brand.has_png);
  const initSrc = hasSvg ? svgUrl : pngUrl;

  return (
    <div className="logo-card" onClick={onClick}>
      {/* 흰색 로고는 밝은 체커 배경에서 안 보여 '빈 카드'처럼 된다 → 어두운 배경 */}
      <div className="card-preview" style={brand.light ? { background: "#18181b", backgroundImage: "none" } : undefined}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={initSrc} alt={brand.name_ko} loading={priority ? "eager" : "lazy"}
          onLoad={e => {
            // 재시도로 살아났으면 자리표시자를 걷어낸다
            const img = e.currentTarget as HTMLImageElement;
            img.style.display = "";
            img.parentElement?.querySelector(".card-fallback")?.remove();
          }}
          onError={e => {
            const img = e.currentTarget as HTMLImageElement;
            if (hasPng && img.src !== pngUrl) {
              img.src = pngUrl;
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
      <div className="card-info">
        <div style={{ minWidth: 0 }}>
          <div className="card-name truncate">
            {brand.name_ko}
            {brand.name_en && brand.name_en !== brand.name_ko && (
              <span className="card-name-en"> / {brand.name_en}</span>
            )}
          </div>
          <div className="card-category">{brand.category}</div>
        </div>
        <div className="card-tags">
          {hasSvg && <span className="card-tag tag-svg">SVG</span>}
          {hasPng && <span className="card-tag tag-png">PNG</span>}
        </div>
      </div>
    </div>
  );
}

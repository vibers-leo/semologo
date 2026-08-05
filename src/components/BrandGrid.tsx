"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Brand } from "@/lib/brands";
import BrandModal from "./BrandModal";
import { useSearch } from "@/lib/search-context";

const AdSlot = dynamic(() => import("./AdSlot"), { ssr: false });
const AD_INTERVAL = 12;

const CDN = process.env.NEXT_PUBLIC_CDN_URL || "https://logo.vibers.co.kr/_clients";
const VERSION = "1785932285";

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
  "기타": "📦",
};

interface Props { brands: Brand[] }
const PAGE_SIZE = 60;

export default function BrandGrid({ brands }: Props) {
  const { query, selectedCats, toggleCat, clearCats } = useSearch();
  const [selected, setSelected] = useState<Brand | null>(null);
  const [page, setPage] = useState(1);
  const [showAllCats, setShowAllCats] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

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

  // 필터링
  const filtered = useMemo(() => {
    setPage(1);
    let list = [...brands].sort((a, b) => {
      const da = a.added_at ?? "";
      const db = b.added_at ?? "";
      return db.localeCompare(da);
    });
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(b =>
        b.name_ko.toLowerCase().includes(q) ||
        b.name_en.toLowerCase().includes(q) ||
        b.id.toLowerCase().includes(q)
      );
    }
    if (selectedCats.size > 0) {
      list = list.filter(b => selectedCats.has(b.category || "기타"));
    }
    return list;
  }, [brands, query, selectedCats]);

  const visible = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = visible.length < filtered.length;

  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const obs = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) setPage(p => p + 1); },
      { rootMargin: "400px" }
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
              <div key={`ad-${i}`} style={{ gridColumn: "1 / -1" }}>
                <AdSlot slot="2847591036" format="horizontal" style={{ minHeight: "90px" }} />
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
  const lightSrc = brand.logo_svg ? svgUrl : pngUrl;

  return (
    <div className="logo-card" onClick={onClick}>
      <div className="card-preview">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={lightSrc} alt={brand.name_ko} loading={priority ? "eager" : "lazy"}
          onError={e => { (e.currentTarget as HTMLImageElement).src = pngUrl; }} />
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
          {brand.logo_svg && <span className="card-tag tag-svg">SVG</span>}
          {brand.logo_png && <span className="card-tag tag-png">PNG</span>}
        </div>
      </div>
    </div>
  );
}

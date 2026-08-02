"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Brand } from "@/lib/brands";
import BrandModal from "./BrandModal";

const AdSlot = dynamic(() => import("./AdSlot"), { ssr: false });
const AD_INTERVAL = 12; // 12번째 카드마다 광고 삽입

const CDN = process.env.NEXT_PUBLIC_CDN_URL || "https://logo.vibers.co.kr/_clients";
const VERSION = "1785636800";

const CATEGORIES = [
  "전체",
  "금융",
  "식품·음료",
  "IT·테크",
  "패션·뷰티",
  "자동차",
  "유통·쇼핑",
  "건설·중공업",
  "엔터테인먼트",
  "통신",
  "의료·바이오",
];

interface Props {
  brands: Brand[];
  query?: string;
  category?: string;
}

export default function BrandGrid({ brands, query, category }: Props) {
  const [search, setSearch] = useState(query ?? "");
  const [cat, setCat] = useState(category ?? "전체");
  const [selected, setSelected] = useState<Brand | null>(null);

  const filtered = useMemo(() => {
    let list = [...brands].sort((a, b) => {
      const da = a.added_at ?? "";
      const db = b.added_at ?? "";
      return db.localeCompare(da);
    });
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (b) =>
          b.name_ko.toLowerCase().includes(q) ||
          b.name_en.toLowerCase().includes(q) ||
          b.id.toLowerCase().includes(q)
      );
    }
    if (cat && cat !== "전체") {
      list = list.filter((b) => b.category === cat);
    }
    return list;
  }, [brands, search, cat]);

  return (
    <>
      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto py-4 scrollbar-none">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className="shrink-0 px-3 py-1.5 text-sm rounded-full transition-colors"
            style={
              cat === c
                ? { background: "#111", color: "#fff" }
                : {
                    background: "var(--surface)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border)",
                  }
            }
          >
            {c}
          </button>
        ))}
      </div>

      {/* Count */}
      <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
        {filtered.length.toLocaleString()}개 브랜드
      </p>

      {/* Grid with ads every AD_INTERVAL cards */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
        {filtered.map((brand, i) => (
          <>
            <BrandCard
              key={brand.id}
              brand={brand}
              onClick={() => setSelected(brand)}
              priority={i < 12}
            />
            {(i + 1) % AD_INTERVAL === 0 && (
              <div
                key={`ad-${i}`}
                style={{ gridColumn: "1 / -1" }}
              >
                <AdSlot
                  slot="2847591036"
                  format="horizontal"
                  style={{ minHeight: "90px" }}
                />
              </div>
            )}
          </>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-24" style={{ color: "var(--text-secondary)" }}>
          <p className="text-4xl mb-3">🔍</p>
          <p className="font-medium">검색 결과가 없어요</p>
          <p className="text-sm mt-1">다른 키워드로 검색해보세요</p>
        </div>
      )}

      {selected && (
        <BrandModal brand={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

function BrandCard({
  brand,
  onClick,
  priority,
}: {
  brand: Brand;
  onClick: () => void;
  priority: boolean;
}) {
  const svgUrl = `${CDN}/${brand.id}/logo.svg?v=${VERSION}`;
  const pngUrl = `${CDN}/${brand.id}/logo.png?v=${VERSION}`;
  const darkUrl = `${CDN}/${brand.id}/logo-transparent.png?v=${VERSION}`;
  const lightSrc = brand.logo_svg ? svgUrl : pngUrl;

  return (
    <div className="logo-card" onClick={onClick}>
      <div className="card-preview">
        <div className="preview-light">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightSrc}
            alt={brand.name_ko}
            loading={priority ? "eager" : "lazy"}
            onError={(e) => { e.currentTarget.src = pngUrl; }}
          />
          <span className="preview-label">라이트</span>
        </div>
        <div className="preview-dark">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={darkUrl}
            alt={brand.name_ko}
            loading={priority ? "eager" : "lazy"}
            onError={(e) => {
              const t = e.currentTarget;
              t.src = brand.logo_svg ? svgUrl : pngUrl;
            }}
          />
          <span className="preview-label">다크</span>
        </div>
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

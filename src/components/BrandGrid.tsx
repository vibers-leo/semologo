"use client";

import { useMemo, useState } from "react";
import { Brand, logoUrl } from "@/lib/brands";
import BrandModal from "./BrandModal";

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

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {filtered.map((brand, i) => (
          <BrandCard
            key={brand.id}
            brand={brand}
            onClick={() => setSelected(brand)}
            priority={i < 12}
          />
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
  const imgSrc = brand.logo_svg
    ? `${CDN}/${brand.id}/logo.svg?v=${VERSION}`
    : `${CDN}/${brand.id}/logo.png?v=${VERSION}`;

  return (
    <div className="logo-card" onClick={onClick}>
      <div className="logo-img-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imgSrc}
          alt={brand.name_ko}
          loading={priority ? "eager" : "lazy"}
          style={{ maxWidth: "100%", maxHeight: "100px", objectFit: "contain" }}
          onError={(e) => {
            const t = e.currentTarget;
            if (!t.src.includes("logo.png")) {
              t.src = `${CDN}/${brand.id}/logo.png?v=${VERSION}`;
            }
          }}
        />
      </div>
      <div className="px-3 py-2 border-t" style={{ borderColor: "var(--border)" }}>
        <p className="text-sm font-medium truncate">{brand.name_ko}</p>
        <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-secondary)" }}>
          {brand.category}
        </p>
      </div>
    </div>
  );
}

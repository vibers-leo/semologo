export interface Brand {
  id: string;
  name_ko: string;
  name_en: string;
  category: string;
  logo_svg?: string | boolean | null;
  logo_png?: string | boolean | null;
  has_svg?: boolean;
  has_png?: boolean;
  /** 흰색 로고 — 밝은 배경에서 안 보이므로 어두운 배경에 그린다 */
  light?: boolean;
  variants_n?: number;
  /** 부모 브랜드로 흡수된 중복 항목 — 목록에서 제외하고 canonical 을 부모로 건다 */
  variant_of?: string;
  dark_variant?: boolean;
  lang_en?: boolean;
  added_at?: string;
  sources?: { provider: string; file: string; label: string }[];
  original_ai_url?: string;
  domain?: string;
}

import { CDN, VERSION, looksLikeHtml } from "./cdn";

export { CDN };

/**
 * 정적 빌드 중 brands.json(2.9MB)을 브랜드마다 다시 받지 않도록 모듈 스코프에
 * 캐시한다. brand/[id]/page.tsx 는 브랜드당 generateStaticParams·
 * generateMetadata·본문에서 각각 호출하므로, 6,800개 × 2~3회 = 약 13,600회
 * 파싱이 발생하고 있었다.
 */
let brandsCache: Promise<Brand[]> | null = null;

export async function fetchBrands(): Promise<Brand[]> {
  if (!brandsCache) {
    brandsCache = (async () => {
      const res = await fetch(`${CDN}/brands.json`, { next: { revalidate: 60 } });
      if (!res.ok) return [];
      const data = await res.json();
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.brands)) return data.brands;
      return [];
    })().catch(() => []);
  }
  return brandsCache;
}

/** id → Brand 조회용. 브랜드마다 선형 find 를 돌던 것을 대체한다. */
let brandMapCache: Promise<Map<string, Brand>> | null = null;

export async function getBrandMap(): Promise<Map<string, Brand>> {
  if (!brandMapCache) {
    brandMapCache = fetchBrands().then(
      list => new Map(list.map(b => [b.id, b]))
    );
  }
  return brandMapCache;
}

// ── 로고 변형 매니페스트 ─────────────────────────────────────────────────────

export type VariantForm = "symbol" | "horizontal" | "vertical" | "wordmark" | "unknown";

export interface VariantRecord {
  key: string;
  form: VariantForm;
  lang: "ko" | "en" | "none" | "unknown";
  color: string;
  label: string;
  files: { svg?: string; png?: string };
  aspect?: number | null;
  provider?: string;
  origin: "collected" | "derived" | "manual";
  order: number;
  derived_from?: string;
  confidence?: number;
  alts?: { provider: string; file: string }[];
}

export interface VariantManifest {
  schema: number;
  algo_v: number;
  id: string;
  primary: string;
  variants: VariantRecord[];
}

/**
 * 브랜드별 변형 매니페스트. 없으면 null 을 돌려주고, 호출부는 기존 고정
 * 변형 목록으로 폴백한다 — 그래야 매니페스트가 아직 없는 브랜드도
 * 지금과 똑같이 동작한다.
 */
export async function fetchVariants(id: string): Promise<VariantManifest | null> {
  try {
    const res = await fetch(`${CDN}/${id}/variants.json?v=${VERSION}`, {
      cache: "force-cache",
    });
    if (!res.ok) return null;
    // GitHub Pages 는 없는 경로에 200 으로 SPA 폴백 HTML 을 주기도 한다
    if (looksLikeHtml(res.headers.get("content-type"))) return null;
    const data = await res.json();
    if (!data || !Array.isArray(data.variants) || data.variants.length === 0) return null;
    return data as VariantManifest;
  } catch {
    return null;
  }
}

export function logoUrl(brand: Brand, file: string): string {
  return `${CDN}/${brand.id}/${file}`;
}

export function primaryLogoUrl(brand: Brand): string {
  if (brand.logo_svg) return logoUrl(brand, "logo.svg");
  return logoUrl(brand, "logo.png");
}

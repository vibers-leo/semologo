export interface Brand {
  id: string;
  name_ko: string;
  name_en: string;
  category: string;
  logo_svg: string | null;
  logo_png: string | null;
  dark_variant?: boolean;
  lang_en?: boolean;
  added_at?: string;
  sources?: string[];
  original_ai_url?: string;
}

const CDN = process.env.NEXT_PUBLIC_CDN_URL || "https://logo.vibers.co.kr/_clients";

let cachedBrands: Brand[] | null = null;
let cacheTime = 0;

export async function fetchBrands(): Promise<Brand[]> {
  if (cachedBrands && Date.now() - cacheTime < 3600_000) return cachedBrands;
  const res = await fetch(`${CDN}/brands.json`, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error("brands.json fetch failed");
  const data = await res.json();
  cachedBrands = data;
  cacheTime = Date.now();
  return data;
}

export function logoUrl(brand: Brand, file: string): string {
  return `${CDN}/${brand.id}/${file}`;
}

export function primaryLogoUrl(brand: Brand): string {
  if (brand.logo_svg) return logoUrl(brand, "logo.svg");
  return logoUrl(brand, "logo.png");
}

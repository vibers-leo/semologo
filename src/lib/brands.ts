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
  sources?: { provider: string; file: string; label: string }[];
  original_ai_url?: string;
  domain?: string;
}

const CDN =
  process.env.NEXT_PUBLIC_CDN_URL || "https://logo.vibers.co.kr/_clients";

export async function fetchBrands(): Promise<Brand[]> {
  const res = await fetch(`${CDN}/brands.json`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.brands)) return data.brands;
  return [];
}

export function logoUrl(brand: Brand, file: string): string {
  return `${CDN}/${brand.id}/${file}`;
}

export function primaryLogoUrl(brand: Brand): string {
  if (brand.logo_svg) return logoUrl(brand, "logo.svg");
  return logoUrl(brand, "logo.png");
}

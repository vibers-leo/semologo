import type { MetadataRoute } from "next";
import { fetchBrands } from "@/lib/brands";

export const dynamic = "force-static";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://semo.vibers.co.kr";

  let brands: Awaited<ReturnType<typeof fetchBrands>> = [];
  try {
    brands = await fetchBrands();
  } catch {
    brands = [];
  }

  // 부모로 흡수된 중복 항목(variant_of)은 사이트맵에서 뺀다 — canonical 이
  // 부모를 가리키므로 색인 대상으로 올릴 이유가 없다.
  const brandUrls = Array.isArray(brands)
    ? brands.filter((b) => !b.variant_of).map((b) => ({
        url: `${base}/brand/${b.id}`,
        lastModified: b.added_at ? new Date(b.added_at) : new Date(),
        changeFrequency: "monthly" as const,
        priority: 0.7,
      }))
    : [];

  return [
    { url: base, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    ...brandUrls,
  ];
}

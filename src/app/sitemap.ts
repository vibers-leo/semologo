import type { MetadataRoute } from "next";
import { fetchBrands } from "@/lib/brands";

export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://semo.vibers.co.kr";

  let brands: Awaited<ReturnType<typeof fetchBrands>> = [];
  try {
    brands = await fetchBrands();
  } catch {
    brands = [];
  }

  const brandUrls = Array.isArray(brands)
    ? brands.map((b) => ({
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

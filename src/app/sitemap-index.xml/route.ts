import { fetchBrandsSlim } from "@/lib/brands";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

const BASE = "https://semologo.com";
const CHUNK = 20000;
const esc = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");

export async function GET() {
  const brands = (await fetchBrandsSlim()).filter((b) => !b.variant_of && !b.hidden);
  const count = Math.max(1, Math.ceil(brands.length / CHUNK));
  const urls = [
    ...Array.from({ length: count }, (_, i) => `${BASE}/sitemaps/ko-${i}`),
    ...Array.from({ length: count }, (_, i) => `${BASE}/sitemaps/en-${i}`),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<sitemap><loc>${esc(u)}</loc></sitemap>`).join("")}</sitemapindex>`;
  return new Response(body, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" } });
}

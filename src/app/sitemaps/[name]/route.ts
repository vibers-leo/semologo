import { fetchBrandsSlim, isIndexableBrand } from "@/lib/brands";

export const dynamic = "force-dynamic";
export const revalidate = 3600;
const BASE = "https://semologo.com";
const CHUNK = 20000;
const esc = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
const core = ["/", "/logo-collection", "/ai-logo-download", "/faq", "/blog"];

export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const name = (await params).name;
  const m = /^(ko|en)-(\d+)$/.exec(name);
  if (!m) return new Response("Not found", { status: 404 });
  const locale = m[1];
  const page = Number(m[2]);
  const brands = (await fetchBrandsSlim()).filter(isIndexableBrand);
  const entries = brands.slice(page * CHUNK, (page + 1) * CHUNK);
  if (!entries.length && page !== 0) return new Response("Not found", { status: 404 });
  const prefix = locale === "en" ? "/en" : "";
  const fixed = page === 0 ? core.map((p) => `${BASE}${prefix}${p}`) : [];
  const urls = entries.map((b) => `<url><loc>${esc(`${BASE}${prefix}/brand/${encodeURIComponent(b.id)}`)}</loc>${b.added_at ? `<lastmod>${esc(b.added_at.slice(0, 10))}</lastmod>` : ""}</url>`);
  const fixedUrls = fixed.map((u) => `<url><loc>${esc(u)}</loc></url>`);
  const body = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[...fixedUrls, ...urls].join("")}</urlset>`;
  return new Response(body, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" } });
}

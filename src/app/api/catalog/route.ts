import { createCatalogMerger } from "@/lib/catalog-merge";
import { cmsBrand } from "@/lib/cms-brand";
import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { fetchBrandsSlim, sortForGrid, type Brand } from "@/lib/brands";
import { isChoseongQuery, choseongIndex } from "@/lib/hangul";
import { VERSION, CATALOG_VERSION } from "@/lib/cdn";
import { SUBMITTED_BRANDS } from "@/lib/submissions";
import { SIMPLE_ICONS_BRANDS } from "@/lib/simple-icons-submissions";
import { STREAMING_SUBMISSIONS } from "@/lib/streaming-submissions";
import { INDEX_REVIEW_BRANDS } from "@/lib/index-candidate-review-submissions";


export const dynamic = "force-dynamic";

const mergeCatalog = createCatalogMerger(SUBMITTED_BRANDS, [...SIMPLE_ICONS_BRANDS, ...STREAMING_SUBMISSIONS, ...INDEX_REVIEW_BRANDS]);

const PAGE_SIZE_MAX = 120;
const POPULARITY_TTL = 60_000;
const PAGE_CACHE_TTL_SECONDS = 60;
const PREFETCH_PAGE_COUNT = 20;

let scoreCache: { at: number; scores: Record<string, number> } | null = null;
const sortedCache = new Map<string, { at: number; brands: Brand[] }>();
let pool: Pool | null = null;
function getPool() {
  if (!process.env.DB_VIBERS_MAIN_URL) return null;
  pool ??= new Pool({ connectionString: process.env.DB_VIBERS_MAIN_URL, max: 2, idleTimeoutMillis: 10_000 });
  return pool;
}

let cmsCache: { at: number; brands: Brand[] } | null = null;
async function recentCmsBrands(): Promise<Brand[]> {
  if (cmsCache && Date.now() - cmsCache.at < POPULARITY_TTL) return cmsCache.brands;
  const db = getPool();
  if (!db) return [];
  try {
    const result = await db.query(`SELECT id,payload FROM semologo.logo_posts
      WHERE status='published' AND payload ? 'logo_published_at'
      UNION SELECT id,payload FROM (SELECT id,payload FROM semologo.logo_posts
      WHERE status='published' ORDER BY updated_at DESC LIMIT 1000) recent`);
    const brands = result.rows.map(row => cmsBrand(row.id, row.payload))
      .filter(brand => !brand.hidden && !brand.variant_of);
    cmsCache = { at: Date.now(), brands };
    return brands;
  } catch (error) {
    console.error("catalog CMS supplement failed", error);
    return cmsCache?.brands ?? [];
  }
}

async function popularityScores(): Promise<Record<string, number>> {
  if (scoreCache && Date.now() - scoreCache.at < POPULARITY_TTL) return scoreCache.scores;
  const db = getPool();
  if (!db) return {};
  try {
    const result = await db.query(`SELECT brand_id,
      SUM(hit_count * CASE hit_type WHEN 'download' THEN 10 WHEN 'ad' THEN 5
        WHEN 'view' THEN 3 WHEN 'search' THEN 2 WHEN 'dwell' THEN 2 ELSE 0 END)::bigint AS score
      FROM semologo.logo_hits GROUP BY brand_id ORDER BY score DESC LIMIT 3000`);
    const scores = Object.fromEntries(result.rows.map(row => [row.brand_id, Number(row.score)]));
    scoreCache = { at: Date.now(), scores };
    return scores;
  } catch (error) {
    console.error("logo popularity query failed", error);
    return {};
  }
}

function pageCacheKey(input: {
  mode: "fame" | "recent";
  offset: number;
  limit: number;
  categories: Set<string>;
  origin: string;
  svgOnly: boolean;
}): string {
  const fingerprint = createHash("sha1").update(JSON.stringify({
    version: VERSION,
    catalogVersion: CATALOG_VERSION,
    mode: input.mode,
    offset: input.offset,
    limit: input.limit,
    categories: [...input.categories].sort(),
    origin: input.origin,
    svgOnly: input.svgOnly,
  })).digest("hex");
  return `semologo:catalog-page:v2:${fingerprint}`;
}

function sortedCatalog(brands: Brand[], mode: "fame" | "recent", scores: Record<string, number>) {
  const cacheKey = `${mode}:${scoreCache?.at ?? 0}:${cmsCache?.at ?? 0}`;
  const cached = sortedCache.get(cacheKey);
  if (cached && Date.now() - cached.at < POPULARITY_TTL) return cached.brands;
  const sorted = sortForGrid(brands, mode, scores);
  sortedCache.clear();
  sortedCache.set(cacheKey, { at: Date.now(), brands: sorted });
  return sorted;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const offset = Math.max(0, Number.parseInt(params.get("offset") ?? "0", 10) || 0);
  const limit = Math.min(PAGE_SIZE_MAX, Math.max(1, Number.parseInt(params.get("limit") ?? "60", 10) || 60));
  const mode = params.get("sort") === "recent" ? "recent" : "fame";
  const query = (params.get("q") ?? "").trim().toLocaleLowerCase();
  const categories = new Set(params.getAll("category"));
  const origin = params.get("origin") ?? "";
  const svgOnly = params.get("svg") === "1";
  // Search terms are user-entered text, so cache only catalog browsing pages.
  // VERSION in the key invalidates the cache whenever the published catalog changes.
  const cacheablePage = !query && offset <= 5_000;
  const pageKey = cacheablePage
    ? pageCacheKey({ mode, offset, limit, categories, origin, svgOnly })
    : null;

  try {
    const catalog = await fetchBrandsSlim();
    const all = mergeCatalog(catalog, await recentCmsBrands());
    const scores = mode === "fame" ? await popularityScores() : {};
    const sorted = sortedCatalog(all, mode, scores);
    let matches = sorted;
    if (query) {
      const choseong = isChoseongQuery(query);
      const ranked: { brand: Brand; order: number; rank: number }[] = [];
      matches = matches.filter((brand) => {
        const haystack = `${brand.id} ${brand.name_ko} ${brand.name_en} ${(brand.aliases ?? []).join(" ")}`.toLocaleLowerCase();
        return haystack.includes(query) || (choseong && Math.max(choseongIndex(query, brand.name_ko), ...(brand.aliases ?? []).map(name => choseongIndex(query, name))) >= 0);
      });
      matches.forEach((brand, order) => {
        const names = [brand.name_ko, brand.name_en, brand.id, ...(brand.aliases ?? [])].filter(Boolean);
        const exactId = brand.id.toLocaleLowerCase() === query;
        const exact = names.some((name) => name.toLocaleLowerCase() === query);
        const starts = names.some((name) => name.toLocaleLowerCase().startsWith(query));
        const initials = choseong ? Math.max(choseongIndex(query, brand.name_ko), ...(brand.aliases ?? []).map(name => choseongIndex(query, name))) : -1;
        ranked.push({ brand, order, rank: exactId ? 0 : exact ? 1 : starts || initials === 0 ? 2 : 3 });
      });
      ranked.sort((a, b) => a.rank - b.rank || a.order - b.order);
      matches = ranked.map(item => item.brand);
    }
    if (categories.size) matches = matches.filter((brand) => categories.has(brand.category || "기타"));
    if (origin === "KR" || origin === "GLOBAL") matches = matches.filter((brand) => brand.origin === origin);
    if (svgOnly) matches = matches.filter((brand) => brand.logo_svg || brand.has_svg);

    const payload = {
      brands: matches.slice(offset, offset + limit),
      total: matches.length,
      offset,
      limit,
      hasMore: offset + limit < matches.length,
    };
    // Catalog pages are immutable for the current VERSION and safe to cache at
    // the edge. Search results remain short-lived, while browse pages avoid
    // repeatedly parsing the 34 MB slim catalog on every scroll request.
    const cacheControl = query
      ? "private, max-age=15, stale-while-revalidate=30"
      : "public, max-age=30, s-maxage=60, stale-while-revalidate=30";
    return NextResponse.json(payload, { headers: { "Cache-Control": cacheControl } });
  } catch (error) {
    console.error("[catalog]", error instanceof Error ? error.message.slice(0, 160) : "unknown error");
    return NextResponse.json({ error: "catalog_unavailable" }, { status: 503 });
  }
}

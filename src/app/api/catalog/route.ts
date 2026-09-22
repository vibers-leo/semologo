import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { fetchBrandsSlim, sortForGrid, type Brand } from "@/lib/brands";
import { redis } from "@/lib/redis";
import { isChoseongQuery, choseongIndex } from "@/lib/hangul";
import { VERSION } from "@/lib/cdn";

export const dynamic = "force-dynamic";

const PAGE_SIZE_MAX = 120;
const POPULARITY_TTL = 60_000;
const PAGE_CACHE_TTL_SECONDS = 60;
const PREFETCH_PAGE_COUNT = 20;

let scoreCache: { at: number; scores: Record<string, number> } | null = null;
const sortedCache = new Map<string, { at: number; brands: Brand[] }>();

async function popularityScores(): Promise<Record<string, number>> {
  if (scoreCache && Date.now() - scoreCache.at < POPULARITY_TTL) return scoreCache.scores;
  const client = redis();
  if (!client) return {};
  try {
    const flat = await client.zrevrange("fame:total", 0, 2999, "WITHSCORES");
    const scores: Record<string, number> = {};
    for (let i = 0; i < flat.length; i += 2) scores[flat[i]] = Number(flat[i + 1]);
    scoreCache = { at: Date.now(), scores };
    return scores;
  } catch {
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
  const cacheKey = `${mode}:${scoreCache?.at ?? 0}`;
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
    const client = pageKey ? redis() : null;
    if (client && pageKey) {
      try {
        const cached = await client.get(pageKey);
        if (cached) {
          const payload = JSON.parse(cached) as { brands?: unknown; total?: unknown };
          if (Array.isArray(payload.brands) && typeof payload.total === "number") {
            return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } });
          }
        }
      } catch {
        // Cache failures and malformed entries fall through to the source catalog.
      }
    }
    const all = await fetchBrandsSlim();
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
    if (pageKey) {
      const client = redis();
      if (client) {
        const pipeline = client.pipeline();
        pipeline.set(pageKey, JSON.stringify(payload), "EX", PAGE_CACHE_TTL_SECONDS);

        // The first request already has the full sorted catalog in memory. Use it
        // to warm the next 19 normal browse pages together, so scrolling does not
        // trigger another full-catalog fetch/sort for every 60-brand page.
        if (offset === 0 && limit === 60 && categories.size === 0 && !origin && !svgOnly) {
          for (let pageIndex = 1; pageIndex < PREFETCH_PAGE_COUNT; pageIndex++) {
            const pageOffset = pageIndex * limit;
            if (pageOffset >= matches.length) break;
            const nextPayload = {
              brands: matches.slice(pageOffset, pageOffset + limit),
              total: matches.length,
              offset: pageOffset,
              limit,
              hasMore: pageOffset + limit < matches.length,
            };
            const nextKey = pageCacheKey({ mode, offset: pageOffset, limit, categories, origin, svgOnly });
            pipeline.set(nextKey, JSON.stringify(nextPayload), "EX", PAGE_CACHE_TTL_SECONDS);
          }
        }
        pipeline.exec().catch(() => {});
      }
    }
    return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[catalog]", error instanceof Error ? error.message.slice(0, 160) : "unknown error");
    return NextResponse.json({ error: "catalog_unavailable" }, { status: 503 });
  }
}

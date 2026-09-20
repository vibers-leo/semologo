import { NextRequest, NextResponse } from "next/server";
import { fetchBrandsSlim, sortForGrid, type Brand } from "@/lib/brands";
import { redis } from "@/lib/redis";
import { isChoseongQuery, choseongIndex } from "@/lib/hangul";

export const dynamic = "force-dynamic";

const PAGE_SIZE_MAX = 120;
const POPULARITY_TTL = 60_000;

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

  try {
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

    return NextResponse.json({
      brands: matches.slice(offset, offset + limit),
      total: matches.length,
      offset,
      limit,
      hasMore: offset + limit < matches.length,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[catalog]", error instanceof Error ? error.message.slice(0, 160) : "unknown error");
    return NextResponse.json({ error: "catalog_unavailable" }, { status: 503 });
  }
}

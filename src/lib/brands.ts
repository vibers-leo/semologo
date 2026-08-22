export interface Brand {
  /** brands-slim.json 이 싣는 추가 순서. 같은 날 추가분의 정렬 기준. */
  seq?: number;
  /** 검색 전용 별칭 — LG 를 '엘지'로도 찾게 한다 */
  aliases?: string[];
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
  /** 인지도 — 위키백과 언어판 수(Wikidata sitelinks). 그리드 기본 정렬 기준.
   *  값이 없으면 0 으로 본다(중간값으로 채우면 무명이 앞으로 온다). */
  fame?: number;
  /** 국내/해외 구분. Wikidata P17(국가) 근거이며 확보된 브랜드만 값이 있다.
   *  한글명 유무로 대체 불가 — '스타벅스'는 한글명이 있어도 미국 브랜드다. */
  origin?: "KR" | "GLOBAL";
  /** brands.json 쪽 이름 (slim 은 light) */
  light_logo?: boolean;
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
import { hasUsableBrandData, parseBrandList } from "./brand-data";

export { CDN };

/**
 * logo.vibers.co.kr 앞단이 일시적으로 차단돼도 목록 자체가 사라지지 않게 하는
 * 읽기 전용 비상 경로다. 로고 이미지 URL에는 쓰지 않는다. 이미지 트래픽은 계속
 * CDN을 통과시켜 핫링크 보호·버킷 서빙 정책을 그대로 유지한다.
 */
const BRAND_DATA_FALLBACK =
  "https://raw.githubusercontent.com/vibers-leo/brand-logos/main/_clients";

async function fetchBrandData(file: string): Promise<unknown> {
  const sources = [CDN, BRAND_DATA_FALLBACK];
  let lastError: unknown;

  for (const source of sources) {
    try {
      const res = await fetch(`${source}/${file}?v=${VERSION}`, {
        next: { revalidate: 21600 },
      });
      if (!res.ok) throw new Error(`브랜드 데이터 응답 오류: HTTP ${res.status}`);
      if (looksLikeHtml(res.headers.get("content-type"))) {
        throw new Error("브랜드 데이터가 JSON 대신 HTML을 반환했어요.");
      }
      return await res.json();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("브랜드 데이터 CDN과 비상 경로 모두 응답하지 않아요.");
}

/**
 * 정적 빌드 중 brands.json(2.9MB)을 브랜드마다 다시 받지 않도록 모듈 스코프에
 * 캐시한다. brand/[id]/page.tsx 는 브랜드당 generateStaticParams·
 * generateMetadata·본문에서 각각 호출하므로, 6,800개 × 2~3회 = 약 13,600회
 * 파싱이 발생하고 있었다.
 */
let brandsCache: Promise<Brand[]> | null = null;

export async function fetchBrands(): Promise<Brand[]> {
  if (!brandsCache) {
    brandsCache = (async (): Promise<Brand[]> => {
      // ?v=VERSION 필수. Cloudflare 가 이 경로의 JSON 을 1시간 엣지 캐시하므로,
      // 캐시버스터가 없으면 **빌드가 최대 1시간 묵은 목록으로 페이지를 만든다.**
      // 실제로 애터미를 등록한 날 브랜드 페이지가 404 로 나왔다(2026-08-13).
      // CDN 을 갱신했으면 cdn.ts 의 VERSION 도 같이 올려야 이 방어가 작동한다.
      // revalidate 를 짧게 두면 안 된다. brands.json 은 2MB 를 넘어 Next 데이터
      // 캐시에 **안 들어가므로**(경고: items over 2MB can not be cached) 만료될
      // 때마다 통째로 다시 받는다. 게다가 fetch 의 revalidate 가 라우트의
      // revalidate 보다 짧으면 브랜드 페이지 전체가 그 주기로 재생성된다.
      // 신선도는 ?v=VERSION 이 보장한다 — CDN 이 갱신되면 URL 자체가 바뀐다.
      const data = await fetchBrandData("brands.json");
      const brands = parseBrandList(data);
      if (!hasUsableBrandData(brands)) {
        throw new Error("브랜드 CDN 데이터가 비었거나 형식이 올바르지 않아요.");
      }
      return brands;
    })();
  }
  return brandsCache;
}

/** id → Brand 조회용. 브랜드마다 선형 find 를 돌던 것을 대체한다. */
let brandMapCache: Promise<Map<string, Brand>> | null = null;

let slimCache: Promise<Brand[]> | null = null;

/**
 * 목록 경량판. id·이름·카테고리·추가일 등 **목록에 필요한 것만** 담겨 있다.
 *
 * 사이트맵·사전생성 목록·연관 브랜드는 전부 이걸로 충분하다. 예전엔 세 곳
 * 모두 brands.json(4만 개면 18MB)을 받았다 — 필요한 건 id 와 카테고리뿐인데.
 */
export async function fetchBrandsSlim(): Promise<Brand[]> {
  if (!slimCache) {
    slimCache = (async (): Promise<Brand[]> => {
      const list = parseBrandList(await fetchBrandData("brands-slim.json"));
      if (!hasUsableBrandData(list)) {
        throw new Error("브랜드 CDN 데이터가 비었거나 형식이 올바르지 않아요.");
      }
      return list;
    })();
  }
  return slimCache;
}

/**
 * 브랜드 한 건만 CDN 에서 받는다 (약 1KB).
 *
 * 상세 페이지가 brands.json 전체를 쓰면 4만 개 기준 18MB 다 — Next 데이터
 * 캐시는 2MB 초과를 저장하지 않아 렌더마다 다시 받고, 파싱만으로 램다 힙이
 * 수백 MB 로 뛴다. 그래서 브랜드별 파일을 따로 둔다.
 *
 * 파일이 아직 없는 브랜드(생성 전)는 null 이 아니라 전체 목록으로 폴백한다 —
 * 없다고 404 를 내면 이관 도중에 멀쩡한 페이지가 사라진다.
 */
export async function fetchBrand(id: string): Promise<Brand | null> {
  try {
    const b = (await fetchBrandData(`${id}/brand.json`)) as Brand;
    if (b && b.id) return b;
  } catch {
    // 폴백으로 넘어간다
  }
  return (await getBrandMap()).get(id) ?? null;
}

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


/**
 * 목록 정렬 — 서버(빌드 시 첫 화면)와 클라이언트가 **같은 규칙**을 써야 한다.
 * 어긋나면 하이드레이션 직후 카드가 갈아끼워지며 화면이 튄다.
 *
 * added_at 은 날짜 단위라 같은 날 추가분끼리는 순서가 없다. brands.json 은
 * 새 항목을 뒤에 덧붙이므로 배열 순서가 곧 추가 순서다 — 그걸 보조 기준으로 쓴다.
 */
export type SortMode = "fame" | "recent";

export function sortForGrid(
  brands: Brand[],
  mode: SortMode = "fame",
  /** 실제 히트 점수 {id: score}. 비어 있으면 fame 만 쓴다(콜드스타트). */
  hits: Record<string, number> = {},
): Brand[] {
  const hasLogo = (b: Brand) => !!(b.logo_svg || b.has_svg || b.logo_png || b.has_png);
  // ⚠️ 보조 기준으로 **넘겨받은 배열의 위치를 쓰면 안 된다.** 이미 정렬된 목록을
  //    다시 정렬하면 순서가 통째로 뒤집힌다 — 서버가 정렬한 60장을 클라이언트가
  //    재정렬해 kspo 가 맨 뒤로 가고 balderton 이 앞으로 왔다(2026-08-17).
  //    brands-slim.json 이 실어 보내는 seq(추가 순서)를 쓰면 몇 번을 정렬해도 같다.
  const fallback = new Map(brands.map((b, i) => [b.id, i]));
  const seqOf = (b: Brand) => b.seq ?? fallback.get(b.id) ?? 0;
  return brands
    .filter((b) => !b.variant_of && hasLogo(b))
    .sort((a, b) => {
      // 인기순 — fame 은 위키백과 언어판 수(Wikidata sitelinks). 인지도 대리 지표다.
      // 기본값을 최신순으로 두면 첫 화면이 위키미디어 대량수집분(무명 기관·단체)
      // 으로 채워진다. 랜덤으로 바꿔도 38,000개 중 대부분이 무명이라 해결이 안 된다.
      // fame 이 없으면 0 — 중간값으로 채우면 무명이 앞으로 올라온다.
      if (mode === "fame") {
        // 실제 히트가 있으면 그게 우선이다 — 사용자가 실제로 찾는 것이 정답이다.
        // 히트가 없는 브랜드끼리는 fame(위키백과 언어판 수)으로 가른다.
        const ha = hits[a.id] ?? 0, hb = hits[b.id] ?? 0;
        if (ha !== hb) return hb - ha;
        const byFame = (b.fame ?? 0) - (a.fame ?? 0);
        if (byFame !== 0) return byFame;
      }
      const byDate = (b.added_at ?? "").localeCompare(a.added_at ?? "");
      return byDate !== 0 ? byDate : seqOf(b) - seqOf(a);
    });
}

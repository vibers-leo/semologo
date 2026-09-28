import type { Brand } from "./brands";

/**
 * Streaming services requested for the subscription-logo intake.
 * Assets are copied from the pinned Simple Icons snapshot after SVG safety
 * validation; the original provider URL is retained for review/attribution.
 */
export const STREAMING_SUBMISSIONS: Brand[] = [
  {
    id: "streaming-apple-tv",
    seq: 1200100,
    added_at: "2026-09-28",
    name_ko: "Apple TV",
    name_en: "Apple TV",
    aliases: ["애플TV", "애플 TV"],
    category: "미디어·엔터",
    logo_svg: "/submissions/streaming/apple-tv.svg",
    has_svg: true,
    origin: "GLOBAL",
    asset_origin: "Simple Icons pinned upstream · trademark review required",
    sources: [{ provider: "simple-icons", file: "submissions/streaming/apple-tv.svg", label: "검수된 오픈소스 SVG", source_url: "https://en.wikipedia.org/wiki/File:Apple_TV_(logo).svg" }],
  },
  {
    id: "streaming-tidal",
    seq: 1200101,
    added_at: "2026-09-28",
    name_ko: "TIDAL",
    name_en: "TIDAL",
    aliases: ["타이달"],
    category: "미디어·엔터",
    logo_svg: "/submissions/streaming/tidal.svg",
    has_svg: true,
    origin: "GLOBAL",
    asset_origin: "Simple Icons pinned upstream · replaced broken remote asset",
    sources: [{ provider: "simple-icons", file: "submissions/streaming/tidal.svg", label: "검수된 오픈소스 SVG", source_url: "https://tidal.com/press" }],
  },
  {
    id: "streaming-max",
    seq: 1200102,
    added_at: "2026-09-28",
    name_ko: "Max",
    name_en: "Max",
    aliases: ["맥스", "HBO Max"],
    category: "미디어·엔터",
    logo_svg: "/submissions/streaming/max.svg",
    has_svg: true,
    origin: "GLOBAL",
    asset_origin: "Simple Icons pinned upstream · trademark review required",
    sources: [{ provider: "simple-icons", file: "submissions/streaming/max.svg", label: "검수된 오픈소스 SVG", source_url: "https://cycling74.com" }],
  },
  {
    id: "streaming-hbo-max",
    seq: 1200103,
    added_at: "2026-09-28",
    name_ko: "HBO Max",
    name_en: "HBO Max",
    aliases: ["Max 스트리밍"],
    category: "미디어·엔터",
    logo_svg: "/submissions/streaming/hbo-max.svg",
    has_svg: true,
    origin: "GLOBAL",
    asset_origin: "Simple Icons pinned upstream · trademark review required",
    sources: [{ provider: "simple-icons", file: "submissions/streaming/hbo-max.svg", label: "검수된 오픈소스 SVG", source_url: "https://commons.wikimedia.org/wiki/File:Max_2025_logo.svg" }],
  },
  {
    id: "streaming-kocowa",
    seq: 1200104,
    added_at: "2026-09-28",
    name_ko: "KOCOWA+",
    name_en: "KOCOWA+",
    aliases: ["코코와", "KOCOWA"],
    category: "미디어·엔터",
    logo_png: "/submissions/streaming/kocowa-KOCOWA_BI_Black.png",
    has_png: true,
    origin: "GLOBAL",
    asset_origin: "KOCOWA official brand assets · trademark review required",
    sources: [{ provider: "KOCOWA / wavve Americas", file: "submissions/streaming/kocowa-KOCOWA_BI_Black.png", label: "공식 브랜드 자산", source_url: "https://corp.kocowa.com/brand-assets/" }],
  },
];

];

/** Names still awaiting an official downloadable/press asset. */
export const STREAMING_PENDING = [
  { name_ko: "쿠팡플레이", name_en: "Coupang Play", website: "https://www.coupangplay.com/", reason: "공식 다운로드 가능한 검증 SVG 미확보" },
  { name_ko: "쿠팡 로켓와우", name_en: "Coupang Rocket Wow", website: "https://www.coupang.com/", reason: "선택 항목 · 공식 전용 로고 확인 필요" },
] as const;

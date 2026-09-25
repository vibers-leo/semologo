import type { Brand } from "./brands";
export const SUBMITTED_BRANDS: Brand[] = [
  ...[
    ["사천시미생물발효재단","사천시미생물발효재단"],["시흥시도시재생지원센터","시흥시도시재생지원센터"],["영양군인재육성장학회","영양군인재육성장학회"],["성주군별고을장학회","성주군별고을장학회"],["발효미생물산업진흥원","발효미생물산업진흥원"],
  ].map(([id,name]) => ({ id, name_ko:name, name_en:name, category:"공공·기관", seq: 999900, added_at: "2026-09-25", logo_png:`/submissions/official-ci/${name}.png`, has_png:true, origin:"KR", kr_kind:"공식 CI 검수 후보", asset_origin:"공식 CI 수집 후보" } as Brand)),
  {
  id: "spursmtech", seq: 1000000, added_at: "2026-09-25", name_ko: "스펄스엠텍", name_en: "Spurs Mtech",
  aliases: ["스펄스", "Spurs M Tech", "spursmtech"], category: "서비스·기업",
  logo_png: "/submissions/spursmtech/spursmtech-logo-color.png", has_png: true,
  origin: "KR", kr_kind: "제보 브랜드", asset_origin: "내부 프로젝트 제보 자산",
  sources: [{ provider: "revibe-submission", file: "spursmtech-logo-color.png", label: "내부 프로젝트 제보", source_url: "내부 검토 자산" }],
  },
];

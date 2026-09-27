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
  ...[
    ["spursmtech-partner-navis-ams", "NAVIS-AMS", 8],
    ["spursmtech-partner-busan-tourism", "부산관광공사", 11],
    ["spursmtech-partner-tmap", "티맵", 9],
  ].map(([id, name, fileNo]) => ({
    id: id as string, seq: 1000010 + Number(fileNo), added_at: "2026-09-26",
    name_ko: name as string, name_en: name as string, aliases: ["T map", "T맵", "티맵", "스펄스엠텍", "파트너"],
    category: "서비스·기업", logo_png: `/submissions/spursmtech/partners/ai_partner_${fileNo}.png`, has_png: true,
    origin: "KR", kr_kind: "제보 파트너 로고", asset_origin: "스펄스엠텍 내부 제보 파트너 자산",
    sources: [{ provider: "revibe-submission", file: `ai_partner_${fileNo}.png`, label: "파트너 로고 제보", source_url: "내부 검토 자산" }],
  } as Brand)),

  { id: "osan-cultural-foundation", seq: 1000301, added_at: "2026-09-27", name_ko: "오산문화재단", name_en: "Osan Cultural Foundation", category: "공공·기관", logo_png: "/submissions/official-ci-osan.png", has_png: true, origin: "KR", kr_kind: "공공기관 공식 CI", asset_origin: "공식 CI 수집 자산", official_source_page: "https://www.osan.go.kr/arts/contents.do?mId=0701050000", sources: [{ provider: "official-ci-page", file: "ci5.jpg", label: "공식 CI 원본", source_url: "https://www.osan.go.kr/arts/contents.do?mId=0701050000" }] },  ...[
    ["official-ci-next-01", '(재)창원시상권활성화재단', "ci-01.png", 'https://www.ccpa.kr/page_NZXu24'],
    ["official-ci-next-02", '(재)청주복지재단', "ci-02.png", 'https://www.cjwf.or.kr/home/sub.php?menukey=91'],
    ["official-ci-next-03", '(재)충주시장학회', "ci-03.png", 'https://www.chungju.go.kr/www/contents.do?key=475'],
    ["official-ci-next-04", '(사)남북교류협력지원협회', "ci-04.png", 'https://sonosa.or.kr/?menuno=10'],
    ["official-ci-next-05", '(사)한국경영혁신중소기업협회', "ci-05.png", 'http://mainbiz.or.kr/mainbizinfo/CI.asp'],
    ["official-ci-next-06", '(재)APEC기후센터', "ci-06.png", 'https://apcc21.org/content/ci?lang=ko'],
    ["official-ci-next-07", '(재)거창군장학회', "ci-07.png", 'https://www.geochang.go.kr/00314/00317/00329.web'],
    ["official-ci-next-08", '(재)경기도수원월드컵경기장관리재단', "ci-08.png", 'https://suwonworldcup.gg.go.kr/gg_worldcup_office/ci'],
    ["official-ci-next-09", '(재)경상북도농식품유통교육진흥원', "ci-09.png", 'https://www.gbfood.or.kr/bbs/content.php?co_id=6_6'],
    ["official-ci-next-10", '(재)경주문화재단', "ci-10.png", 'https://garts.kr/index.do?menuId=00000390'],
  ].map(([id, name, file, source]) => ({
    id: id as string, seq: 1000400, added_at: "2026-09-27", name_ko: name as string, name_en: name as string, category: "공공·기관",
    logo_png: `/submissions/official-ci-next/${file}`, has_png: true, origin: "KR", kr_kind: "공공기관 공식 CI", asset_origin: "공식 CI 수집 자산", official_source_page: source as string,
    sources: [{ provider: "official-ci-page", file: file as string, label: "공식 CI 원본", source_url: source as string }],
  } as Brand)),

];

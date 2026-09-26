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
  ...[
    ["official-ci-", '(재)발효미생물산업진흥원', '.png', 'https://www.mifi.re.kr/ko/page/sub/sub01_06.do'],
    ["official-ci-", '(재)사천시미생물발효재단', '.png', 'https://www.scmicro.or.kr/sub/ci.php'],
    ["official-ci-", '(재)사천시인재육성장학재단', '.png', 'https://www.sacheon.go.kr/intro/01096/02416.web'],
    ["official-ci-", '(재)성주군별고을장학회', '.png', 'https://www.sj.go.kr/page.do?mnu_uid=1014&amp;'],
    ["official-ci-", '(재)시흥시도시재생지원센터', '.png', 'https://www.shurc.or.kr/base/contents/view?contentsNo=81&amp;menuLevel=2&amp;menuNo=109'],
    ["official-ci-", '(재)영양군인재육성장학회', '.png', 'https://www.yyg.go.kr/www/introduce/yyg_symbol/brand_slogan'],
    ["official-ci-", '(재)영주시인재육성장학회', '.png', 'https://www.yeongju.go.kr/open_content/main/page.do?mnu_uid=3742&amp;'],
    ["official-ci-", '(재)오산문화재단', '.png', 'https://www.osan.go.kr/arts/contents.do?mId=0701050000'],
    ["official-ci-", '(재)우체국금융개발원', '.svg', 'https://www.posid.or.kr/introduction/ci.do'],
    ["official-ci-", '(재)우체국물류지원단', '.png', 'https://www.pola.or.kr/web/content.do?proFn=ci'],
    ["official-ci-", '(재)우체국시설관리단', '.svg', 'https://www.poma.or.kr/poma/ci.do'],
    ["official-ci-", '(재)울진군장학재단', '.png', 'https://www.uljin.go.kr/index.uljin?menuCd=DOM_000000104003001000'],
    ["official-ci-", '(재)원덕읍향토장학회', '.png', 'https://www.samcheok.go.kr/intro/00362/01658.web'],
    ["official-ci-", '(재)원주의료기기산업진흥원', '.png', 'https://www.wmit.or.kr/contents/contents.do?ciIdx=1113&amp;menuId=2915'],
    ["official-ci-", '(재)일제강제동원피해자지원재단', '.png', 'https://www.fomo.or.kr/kor/contents/7'],
    ["official-ci-", '(재)임실치즈앤식품연구소', '.png', 'http://www.icf.re.kr/'],
    ["official-ci-", '(재)진주바이오산업진흥원', '.png', 'https://www.jbio.or.kr/contents.do?sub=07_01_5'],
    ["official-ci-", '(재)진주시상권활성화재단', '.png', 'https://www.jinjumr.or.kr/sub1_4'],
    ["official-ci-", '(재)차세대수치예보모델개발사업단', '.png', 'https://www.kiaps.org/prCenter/ci.do'],
    ["official-ci-", '(재)창원시상권활성화재단', '.png', 'https://www.ccpa.kr/page_NZXu24'],
  ].map(([id, name, file, source]) => ({
    id: id as string, seq: 1000100, added_at: "2026-09-26", name_ko: name as string, name_en: name as string,
    category: "공공·기관", logo_png: `/submissions/official-ci-batch/${file}`, has_png: true, origin: "KR",
    kr_kind: "공공기관 공식 CI", asset_origin: "공식 CI 수집 자산",
    official_source_page: source as string, sources: [{ provider: "official-ci-page", file: file as string, label: "공식 CI 원본", source_url: source as string }],
  } as Brand)),

];

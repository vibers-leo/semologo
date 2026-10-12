/**
 * llms.txt — AI 에이전트·LLM 크롤러를 위한 사이트 안내.
 * 세모로고는 로고 자산을 CDN 으로 직접 제공하므로, 에이전트가 페이지를
 * 파싱하지 않고 JSON·파일 URL 을 바로 쓰도록 규격을 명시한다.
 */
// ⚠️ 예전엔 여기 URL 이 하드코딩돼 있었다. cdn.ts 가 단일 소스인데
//    이 파일만 따로 들고 있으면 CDN 주소를 옮길 때 조용히 어긋난다.
import { CDN } from "@/lib/cdn";

export const dynamic = "force-static";


import { fetchCatalogStats } from "@/lib/brands";
import { CATALOG_SNAPSHOT, siteCopy } from "@/lib/site-copy";

export async function GET() {
  const stats = await fetchCatalogStats();
  const total = stats?.visible || CATALOG_SNAPSHOT.visible;
  const count = total.toLocaleString("ko-KR") + "개";
  const body = `# 세모로고 (SemoLogo)

> ${siteCopy("ko", total).description}

공개 카탈로그: ${count} 콘텐츠. 파일 형식과 베리에이션은 콘텐츠별로 다르며, 모든 콘텐츠가 SVG·PNG·AI·캐릭터를 함께 제공하는 것은 아니다.

## 주요 기능

- 국내외 기업·기관·대학·스포츠·미디어 등 브랜드 로고 검색
- 확보된 SVG·PNG 다운로드와 심볼·워드마크·시그니처·캐릭터 베리에이션
- 로고월 제작·미리보기·ZIP 내보내기: PNG, HTML·CSS·JavaScript, JSON 설정과 미리보기 이미지
- 카테고리별 수집현황과 아카이브
- 로고 요청 및 제보
- AI·ZIP 등 배포 원본은 확보된 콘텐츠에서만 제공

## 에이전트가 바로 쓸 수 있는 데이터

- 브랜드 목록(경량): ${CDN}/brands-slim.json
  필드: id, name_ko, name_en, category, has_svg, has_png, variants_n, variant_of, light, origin, fame
- 브랜드 전체 메타: ${CDN}/brands.json
- 브랜드별 로고 변형: ${CDN}/{id}/variants.json
- 실제 파일 경로: 브랜드 메타데이터와 variants.json의 files, preview_png 필드 참조. sources/ 아래의 검수 파일도 사용한다.
- 예전 고정 파일명 logo.svg·logo.png가 항상 존재하거나 최신 대표 파일이라고 가정하지 말 것.

## 사용 규칙

- \`variant_of\` 가 있는 항목은 부모 브랜드로 흡수된 중복이다. 목록에는 쓰지 말 것.
- \`origin\`의 KR은 국내, GLOBAL 또는 다른 국가 코드는 해외다. 값이 없으면 국적 미확인이다.
- \`fame\` 은 인지도 지표(해당 브랜드의 위키백과 언어판 수). 클수록 널리 알려진 브랜드다.
- \`light: true\` 는 흰색 계열 로고 — 밝은 배경에서 보이지 않으므로 어두운 배경에 배치할 것.
- 파일이 없을 수 있다. 응답이 \`text/html\` 이면 404 폴백이므로 이미지로 쓰지 말 것.
- CDN에는 접근 보호 정책이 있다. 이미지 응답의 HTTP 상태와 Content-Type을 확인할 것.

## 언어와 파일 형식

- 한국어: https://semologo.com/ · English: https://semologo.com/en
- SVG is a vector format supported by Illustrator. An SVG download is not an original .ai file.
- AI·SVG 안내: https://semologo.com/ai-logo-download
- 로고 모음: https://semologo.com/logo-collection

## 페이지

- 홈(브랜드 검색·목록): https://semologo.com/
- 브랜드 상세: https://semologo.com/brand/{id}
- 로고 제보: https://semologo.com/submit
- 로고 요청: https://semologo.com/request
- 자주 묻는 질문: https://semologo.com/faq
- 로고월 제작: https://semologo.com/logo-walls/
- 수집현황: https://semologo.com/blog/collection-status/

## 저작권

로고는 각 브랜드의 자산이다. 세모로고는 식별·참조 목적의 사용을 돕는 디렉터리이며,
상표권은 각 권리자에게 있다. 상업적 사용 전 각 브랜드의 가이드라인을 확인할 것.

## 연락

운영: 주식회사 계발자들 · https://semologo.com/request
`;
  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      // ⚠️ force-static 만 두면 Next.js 가 s-maxage=31536000(1년)을 붙인다.
      //    브랜드 수가 본문에 들어가므로 1년 캐시는 치명적이다 — 실제로
      //    '6,800여 개'가 CF 엣지에 1년짜리로 박혀 있었다(실제의 1/6).
      //    퍼지 권한이 없어 헤더로 수명을 직접 제한한다.
      "cache-control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

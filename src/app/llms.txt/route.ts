/**
 * llms.txt — AI 에이전트·LLM 크롤러를 위한 사이트 안내.
 * 세모로고는 로고 자산을 CDN 으로 직접 제공하므로, 에이전트가 페이지를
 * 파싱하지 않고 JSON·파일 URL 을 바로 쓰도록 규격을 명시한다.
 */
export const dynamic = "force-static";

const CDN = "https://logo.vibers.co.kr/_clients";

/**
 * 브랜드 수를 빌드 시점에 실제 데이터에서 읽는다.
 * 예전엔 "6,800여"로 하드코딩돼 있었는데, 브랜드가 7,343 → 40,274개로
 * 늘었는데도 6,800 그대로였다(6배 차이). layout.tsx 와 같은 방식으로 맞춘다.
 */
async function brandCount(): Promise<string> {
  try {
    const res = await fetch(`${CDN}/brands-slim.json`, { next: { revalidate: 3600 } });
    if (!res.ok) return "4만여";
    const list = await res.json();
    const n = Array.isArray(list) ? list.filter((b) => !b?.variant_of).length : 0;
    return n > 0 ? `${n.toLocaleString("ko-KR")}개` : "4만여";
  } catch {
    return "4만여";
  }
}

export async function GET() {
  const count = await brandCount();
  const body = `# 세모로고 (SemoLogo)

> 세상 모든 로고. 브랜드 로고를 SVG·PNG로 무료 다운로드하는 서비스.
> ${count} 브랜드의 벡터·래스터 로고를 형태별(심볼형·가로조합형·세로조합형·워드마크형)로 제공한다.

## 에이전트가 바로 쓸 수 있는 데이터

- 브랜드 목록(경량): ${CDN}/brands-slim.json
  필드: id, name_ko, name_en, category, has_svg, has_png, variants_n, variant_of, light, origin, fame
- 브랜드 전체 메타: ${CDN}/brands.json
- 브랜드별 로고 변형: ${CDN}/{id}/variants.json
- 로고 파일: ${CDN}/{id}/logo.svg · logo.png · logo-800.png · logo-icon.png · logo-transparent.png · logo-white.png

## 사용 규칙

- \`variant_of\` 가 있는 항목은 부모 브랜드로 흡수된 중복이다. 목록에는 쓰지 말 것.
- \`origin\` 은 "KR"(국내) 또는 "GLOBAL"(해외). 값이 없으면 국적 미확인이다 — 어느 쪽으로도 단정하지 말 것.
- \`fame\` 은 인지도 지표(해당 브랜드의 위키백과 언어판 수). 클수록 널리 알려진 브랜드다.
- \`light: true\` 는 흰색 계열 로고 — 밝은 배경에서 보이지 않으므로 어두운 배경에 배치할 것.
- 파일이 없을 수 있다. 응답이 \`text/html\` 이면 404 폴백이므로 이미지로 쓰지 말 것.
- CORS 는 \`*\` 로 열려 있어 브라우저에서 직접 fetch 가능하다.

## 페이지

- 홈(브랜드 검색·목록): https://semologo.com/
- 브랜드 상세: https://semologo.com/brand/{id}
- 로고 제보: https://semologo.com/submit
- 로고 요청: https://semologo.com/request
- 자주 묻는 질문: https://semologo.com/faq

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

/** Public catalog milestone verified against stats.json on 2026-10-12. */
export const CATALOG_SNAPSHOT = { visible: 181_228, checkedAt: '2026-10-12' };
export const SITE_OG_REVISION = '20261012';

export function siteCopy(locale: 'ko' | 'en', count = CATALOG_SNAPSHOT.visible) {
  const en = locale === 'en';
  const n = count.toLocaleString(en ? 'en-US' : 'ko-KR');
  return {
    title: en ? 'SemoLogo — 180K+ Brand Logos & Logo Wall Builder' : '세모로고 — 18만+ 로고 SVG·PNG 다운로드 · 로고월 제작',
    description: en
      ? `Explore ${n} brand logos. Download available SVG and PNG files, build logo walls, browse category archives, and request or contribute logos.`
      : `국내외 ${n}개 브랜드 로고를 한곳에서 찾아보세요. SVG·PNG 다운로드, 심볼·시그니처·캐릭터 베리에이션, 로고월 제작, 카테고리별 수집현황과 로고 요청·제보까지 제공합니다.`,
    intro: en ? '180K+ brand logos, ready for your next project' : '18만+ 브랜드 로고, 한곳에서 찾아보세요',
    introDescription: en ? 'Find SVG & PNG files, explore logo variations, and build your own logo wall.' : 'SVG·PNG 다운로드부터 심볼·시그니처·캐릭터 베리에이션, 나만의 로고월 제작까지.',
    ogImage: `/og/semologo-${SITE_OG_REVISION}-${locale}.png`,
    ogAlt: en ? 'SemoLogo — 180K+ brand logos, SVG & PNG downloads and logo wall builder' : '세모로고 — 18만+ 브랜드 로고, SVG·PNG 다운로드와 로고월 제작',
  };
}

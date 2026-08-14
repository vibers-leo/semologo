/**
 * CDN 주소와 캐시 버스팅 버전의 단일 소스.
 *
 * 이 값이 컴포넌트마다 하드코딩돼 있어서 계속 어긋났다. 게다가 brand-logos
 * 레포에는 **커밋마다 version.txt 를 자동으로 올리는 pre-commit 훅**이 있어서,
 * semologo 를 먼저 맞춰놓고 brand-logos 를 커밋하면 반드시 틀어진다.
 *
 * 갱신 순서 (이 순서를 지켜야 한다):
 *   1. brand-logos 커밋 + 푸시  ← 훅이 version.txt 를 최종값으로 올림
 *   2. curl -s https://logo.vibers.co.kr/version.txt 로 최종값 확인
 *   3. 아래 VERSION 에 그 값을 넣고 semologo 커밋
 */
export const CDN =
  process.env.NEXT_PUBLIC_CDN_URL || "https://logo.vibers.co.kr/_clients";

export const VERSION = "1786667948";

/** 캐시 버스터가 붙은 브랜드 자산 URL */
export function assetUrl(brandId: string, file: string): string {
  return `${CDN}/${brandId}/${file}?v=${VERSION}`;
}

/**
 * CDN 에서 받은 응답이 진짜 파일인지 확인한다.
 * GitHub Pages 는 없는 경로에 404 HTML 을 내려주므로, 그걸 파일로 취급하면
 * 빈 이미지나 HTML 이 저장된 .svg 같은 사고가 난다.
 */
export function looksLikeHtml(contentType: string | null, body?: string): boolean {
  if (contentType?.includes("text/html")) return true;
  if (body && /^\s*<!doctype html/i.test(body)) return true;
  return false;
}

#!/usr/bin/env node

const cdn = process.env.NEXT_PUBLIC_CDN_URL || "https://logo.vibers.co.kr/_clients";
const fallback = "https://raw.githubusercontent.com/vibers-leo/brand-logos/main/_clients";
const minimum = 1_000;

async function fetchCatalog(base) {
  const response = await fetch(`${base}/brands.json`, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`브랜드 CDN 응답 오류: HTTP ${response.status}`);

  const type = response.headers.get("content-type") || "";
  if (type.includes("text/html")) throw new Error("브랜드 CDN이 JSON 대신 HTML을 반환했어요.");
  return response;
}

let response;
let source = cdn;
try {
  response = await fetchCatalog(cdn);
} catch (primaryError) {
  source = fallback;
  try {
    response = await fetchCatalog(fallback);
    console.warn(`⚠️ 기본 CDN 오류로 비상 경로 사용: ${primaryError.message}`);
  } catch (fallbackError) {
    throw new Error(`기본 CDN 및 비상 경로 오류: ${primaryError.message} / ${fallbackError.message}`);
  }
}

const payload = await response.json();
const brands = Array.isArray(payload) ? payload : payload?.brands;
if (!Array.isArray(brands) || brands.length < minimum || brands.some((brand) => !brand?.id)) {
  throw new Error(`브랜드 CDN 데이터 검증 실패: 최소 ${minimum}개 id가 있는 항목이 필요합니다.`);
}

console.log(`✅ CDN 정상: ${brands.length.toLocaleString("ko-KR")}개 브랜드 (${source})`);

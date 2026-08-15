#!/usr/bin/env node

const cdn = process.env.NEXT_PUBLIC_CDN_URL || "https://logo.vibers.co.kr/_clients";
const minimum = 1_000;

const response = await fetch(`${cdn}/brands.json`, { signal: AbortSignal.timeout(30_000) });
if (!response.ok) throw new Error(`브랜드 CDN 응답 오류: HTTP ${response.status}`);

const type = response.headers.get("content-type") || "";
if (type.includes("text/html")) throw new Error("브랜드 CDN이 JSON 대신 HTML을 반환했어요.");

const payload = await response.json();
const brands = Array.isArray(payload) ? payload : payload?.brands;
if (!Array.isArray(brands) || brands.length < minimum || brands.some((brand) => !brand?.id)) {
  throw new Error(`브랜드 CDN 데이터 검증 실패: 최소 ${minimum}개 id가 있는 항목이 필요합니다.`);
}

console.log(`✅ CDN 정상: ${brands.length.toLocaleString("ko-KR")}개 브랜드`);

# 세모로고 검색·AI 노출 자산

- 갱신일: 2026-09-20
- 도메인: https://semologo.com
- 대상: 국내외 브랜드 로고 상세 페이지와 SVG·PNG 다운로드

## 색인 구조

- `robots.txt`가 `https://semologo.com/sitemap-index.xml`을 안내한다.
- 사이트맵 인덱스는 한국어·영문을 각각 20,000 URL 단위로 분할한다.
- 각 브랜드 상세 페이지는 `/brand/{id}` 및 `/en/brand/{id}`로 제공하며, 중복 변형은 `variant_of` 부모 URL을 canonical로 사용한다.
- `hidden` 자산은 검색 색인에서 제외하고, 실제 로고가 있는 공개 브랜드만 사이트맵에 넣는다.

## 구조화 데이터

- 홈: WebSite, Organization, CollectionPage, SearchAction
- 브랜드 상세: Organization, BreadcrumbList, ImageObject
- FAQ: 질문과 답변을 본문에 표시하며, 향후 FAQPage JSON-LD를 추가할 수 있다.

## 데이터 근거

- 브랜드 메타와 파일은 각 브랜드의 공식 사이트·공식 CI 배포 페이지·사용자 제공 원본을 출처 링크와 함께 저장한다.
- 카탈로그 갱신 시 CDN 버전을 바꿔 페이지와 사이트맵의 캐시를 분리한다.

## 제출 운영

Google Search Console과 Naver Search Advisor에 `https://semologo.com/sitemap-index.xml`을 제출한다. 신규 대량 수집 뒤에는 사이트맵 HTTP 200, 분할 파일 20,000개 이하, 대표 신규 URL의 200 응답을 확인한다.

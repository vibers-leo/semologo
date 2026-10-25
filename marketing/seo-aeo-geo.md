# 세모로고 검색·공유 자산

갱신: 2026-10-12

공개 카탈로그 stats.json visible=181228, total=182313 확인. 소개에서는 공개 수치를 기준으로 18만+를 사용한다. 메타 설명과 JSON-LD 및 llms.txt는 fetchCatalogStats를 공유하며, 통계 장애 시 마지막 검증 스냅샷으로 대체한다. 원본과 베리에이션은 콘텐츠별 보유 형식만 제공하며 전체가 공식 배포물 또는 AI 원본이라는 주장을 하지 않는다.

한국어·영문 OG 이미지: public/og/semologo-20261012-ko.png, public/og/semologo-20261012-en.png (1200×630). 날짜가 포함된 새 파일 경로로 공유 이미지 캐시를 분리한다.

갱신 범위: 사이트 제목/설명, Open Graph, Twitter, 홈 소개, PWA description, WebSite/Organization 구조화 데이터, llms.txt. 로고월 ZIP 구성은 기존 내보내기 구현과 일치한다. 브랜드별 OG는 유지한다.

robots.txt·sitemap-index.xml·favicon·검색엔진 인증 태그는 기존 설정을 유지한다. Search Console/서치어드바이저 재등록은 수행하지 않았다. 검색 결과와 기존 SNS 공유물의 갱신 시점은 각 플랫폼 재수집에 따른다.

## 기존 색인·제출 운영 참고 (2026-09-20)

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

2026-10-12 OG 디자인 조정: 기존 로고 콜라주 스타일 복원, 한국어·영문 OG revision 20261012b. 메타 설명과 181,228개 스냅샷 유지.

## 2026-10-13 canonical 및 사이트맵 정비

- Next trailingSlash:true에 맞춰 localePath·언어 대체 주소·주요 내부 링크·사이트맵 loc을 최종 경로로 통일. 파일 확장자와 .well-known 예외 유지.
- 분할 사이트맵이 has_svg/has_png 경량 필드를 인식하도록 수정. hidden/variant_of/merged_into는 제외.
- Search Console 확인: 2026-10-09 보고서 기준 redirect 15,417, 전체 색인 37,215. 표시된 redirect 예시들은 끝 슬래시 없음. 정상 이전 URL 리디렉션은 유지.
- 제출 대상: 기존 robots에 선언된 /sitemap-index.xml. 배포 후 XML·canonical·HTTP 200 확인 후 제출 예정.
- 검증: scripts/check-sitemap-canonical.cjs (locale/query/hash/file exceptions, index children, slim fields, hidden/merged exclusion). 색인 결과는 Google 재크롤링 이후 확인 필요.

배포 검증: DEPLOY OK, restarts=0. 분할 XML 20개와 전체 362,776 URL 형식/중복 검사 PASS. 대표 한·영 6페이지 HTTP 200 및 self canonical 확인. 현대자동차 최종 URL은 Search Console에서 색인됨 확인. sitemap-index.xml 제출 접수 후 최초 가져오기 상태는 추가 확인 중.

Search Console 최종: 제출 접수됨. 14:39:39 실제 URL 테스트에서 크롤링 허용 및 가져오기 성공. 사이트맵 보고서는 아직 가져올 수 없음/발견 0으로 표시되어 Google 처리 결과는 미확정. 한 차례 재제출 접수. 자동 감시 예약 없음.

- 2026-10-25: 로고 이야기 목록·상세·사이트맵을 CMS의 공개 상태에 연결. 초안·보관 글 제외. 관리자 새 화면 noindex, 광고문의 유입 및 lead_id 기반 generate_lead 연결.

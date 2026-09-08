# 유입·재방문·언어 구조 (2026-09-09)

- `/admin/`은 FanEasy의 세모로고 전용 대시보드로 이동한다. 기존 로고 운영 화면은 `/admin/logos/`, 요청 관리는 `/requests/`에 유지한다.
- GA4 속성 548184496. FanEasy 조회 API에서 실제 일별·유입 매체·랜딩 페이지 결과를 확인했다. `totalUsers`는 현재 FanEasy가 일별 사용자 수를 더한 값으로, 기간 내 고유 사용자 수와 다르다.
- UTM 링크 예: `https://semologo.com/?utm_source=instagram&utm_medium=social&utm_campaign=logo_collection`. GA4는 기존 설정으로 캠페인을 수집한다. FanEasy 자체 방문 기록에도 whitelisted UTM만 남긴다. 상세 캠페인 분석은 GA4에서 확인하며 FanEasy의 현재 화면은 유입 매체·랜딩 URL을 제공한다.
- Firebase 방문 기록: 날짜별 세션 ID, landingPath, referrer, dwellMs. sessionStorage 성공 표시를 HTTP 성공 후에만 기록한다. 일반 검색어·임의 쿼리는 자체 방문 기록에서 제외한다.
- 즐겨찾기는 `semologo.favorites.v1` localStorage에 최소 브랜드 정보로 저장. 로그인·서버 동기화 없음, 최대 1,000개. KO/EN 공통. 브라우저 삭제 시 목록 소실 안내.
- `/`와 `/en/`은 독립 root layout으로 SSR html 언어를 정확히 출력한다. 검색·상세·즐겨찾기·다운로드 안내 공유 컴포넌트에 LocaleProvider 사용. UI 카탈로그는 `src/lib/translations/en.ts`.
- 다른 언어 추가 시 locales.ts, 번역 카탈로그, locale route/layout, metadata, 사이트맵을 함께 추가해야 한다. 준비되지 않은 언어에 hreflang을 생성하지 않는다.
- `/sitemap.xml`과 `/en/sitemap.xml`으로 언어별 분리. 현행 각 약 45,000개 URL. 50,000개 전에 추가 분할 필요.
- SVG는 Illustrator 호환 벡터이며 AI 원본을 뜻하지 않는다. 안내 페이지에서 확장자 변경만으로 벡터화되지 않는다는 점과 원본 레이어 구조 차이를 설명한다.
- 공식 참고: https://developers.google.com/search/docs/specialty/international/localized-versions
- 제보·요청·로그인·계정·약관·개인정보 등 보조 화면은 현재 한국어다. 영어 FAQ에서 이 범위를 명시하며, 준비되지 않은 보조 페이지에는 영문 URL을 만들지 않는다.
- 검색 메타데이터·RSS·공유 링크의 공개 도메인은 로컬 공통 환경변수 값에 영향받지 않도록 semologo.com을 사용한다.

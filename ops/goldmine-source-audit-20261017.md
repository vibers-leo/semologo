# 대량 로고 공급원 실측 — 2026-10-17

로고 파일 수, 새 브랜드 수, 공개 게시 수를 구분한다. 이번 회차 신규 게시 34건은 Commons 6건과 공식 홈페이지 SVG 28건(맥 직접 발견 25건, Windows 발견 후 맥 검수 3건)이다. 800만 도메인 샤드는 탐색 후보이며 공개 로고가 아니다.

| 공급원 | 확인한 규모·조건 | 이번 처리 |
|---|---|---|
| [ln-dev7/logos-apps](https://github.com/ln-dev7/logos-apps) | GitHub tree의 SVG 15,017개. 심볼·워드마크 쌍 1,938개와 세모로고 현재 카탈로그를 이름/ID로 대조했다. 쌍은 모두 기존 수록 대상과 겹치고 전체 파일명 중 실질적인 미매칭은 1개뿐이었다. 저장소의 코드 라이선스와 각 로고의 상표 권리는 별개다. | 무차별 재수집을 보류. 기존 콘텐츠의 4종 변형 보강용으로만 다시 대조한다. |
| [Wikimedia Commons API](https://commons.wikimedia.org/wiki/Commons:API/MediaWiki), [categorymembers](https://www.mediawiki.org/wiki/API:Categorymembers) | 한국·일본·대만 기업 카테고리에서 SVG 1,570개를 검색했고 명칭상 636개가 미매칭 후보였다. 역사 로고, 제3자 파일, 내장 비트맵을 제외한다. | 대만 기업의 순수 SVG 6건을 원본·신원·렌더 검토 후 CMS에 게시. 1.45MB 내장 비트맵 1건은 제외. |
| [공공데이터포털 항공사 API](https://www.data.go.kr/data/15095073/openapi.do), [대학 로고 파일데이터](https://www.data.go.kr/data/15150589/fileData.do) | 항공사 API는 로고 이미지 URL과 서비스키가 필요하다. 대학 데이터는 439개 학교의 로고 경로가 있으나 파일 이미지 중심이다. 현재 운영 비밀 저장소에는 해당 API 서비스키가 없다. | 신원/공식 사이트 탐색 명부 후보로 보관. PNG만으로 신규 벡터 브랜드를 자동 게시하지 않는다. |
| Common Crawl·Tranco·Majestic 도메인 | 중복 제거 후보 9,595,297개, 그중 Common Crawl 전용 800만 건을 Windows별 비공개 샤드로 저장. | Mac 2,000도메인 샘플에서 직접 검수한 SVG 25건과 Windows 발견 후 맥에서 검수한 3건 공개. Windows 새 job 2대 왕복 후 1분 주기 공급 시작. |

후속 수집의 우선순위는 새 실체를 식별할 수 있는 공식 사이트 SVG와 Commons 원본이다. Windows 탐색 결과는 URL 후보만 저장하고, 맥 검토 단계에서 파일 원본·브랜드 동일성·중복·렌더·배경 가시성을 확인한 뒤 CMS에 공개한다. API 키 발급이 필요한 데이터는 서비스키를 중앙 비밀 저장소에 넣기 전 자동 연결하지 않는다.

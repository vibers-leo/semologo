# semologo 마케팅

> 표준: macminim4/ops/marketing/marketing-standard.md / 생성: 2026-08-08

- 📢 **이 사이트는 광고 지면입니다** → [ADS.md](ADS.md) (현재 게재 광고·동작 방식)

## 현재 자산 (최신만)
- screenshots/20260809_v1/ — home·brand × desktop·mobile 4장
- (og-image·favicon 원본은 public/ 에 있음 — 추후 meta/ 로 이관 검토)

## 과업 로그 (최신이 위)

- 2026-10-12: 공개 181,228개 통계 기준 소개 갱신. 한국어·영문 OG 1200×630, 검색/공유 메타·PWA·JSON-LD·llms.txt에 다운로드/베리에이션/로고월/수집현황/요청·제보 반영. 구형 4만대 fallback 제거.
- 2026-10-10 | 상세 로고 구성·다운로드 갤러리 통합, 중복 파일 제외 및 1:1 미리보기 적용. 데스크톱·모바일 운영 검증.
- 2026-08-15 | CDN 실패 시 정적 페이지 누락 배포를 차단하고, 검색·다운로드·요청 행동 이벤트를 GA4에 추가.
- 2026-08-13 | 키엔AI에 세모로고 브랜드 소개 매거진 발행 → https://keyenai.com/articles/vbs-semologo-intro
  (실측 기준: 사이트맵 브랜드 6,392 · CDN 인덱스 6,835 · SVG 6,321 · 다크변형 6,820 · 카테고리 40)
- 2026-08-09 | 풀케어 8단계 완주 — FULLCARE_REPORT.md 참조 (폰트 하한·메타 동적화·llms.txt·보안패치·모바일 푸터)
- 2026-08-08 | marketing/ 표준 구조 생성

## 연계
- 모노페이지: / SNS:
- 2026-08-09 소개 스크린샷 캡처(desktop/mobile) → screenshots/20260809_intro/ (semologo.com)
- 2026-08-09 크몽·앱마켓 listings 규격 캡처 4종 → listings/{kmong,app-store,play-store}/20260809/
- 2026-08-09 | 홈 상단 슬롯을 Vibers 광고 서버로 전환 (VibersAdSlot) — 첫 캠페인 디어스

- 2026-08-11 — 브랜드 페이지 공유 UI 통합 후 재캡처 → `screenshots/20260811_share/{desktop,mobile}.png`
  (쿠팡 파트너스 배너 게시 상태 포함 — 파트너스 최종 승인 스크린샷으로 사용 가능)

- 2026-08-13 | MCP 공개 준비 — 캠페인 노트 `campaigns/2026-08_mcp-launch.md`, SNS 문안 `sns/2026-08_mcp-launch.md`
  (npm publish 는 `npm login` 이 브라우저 인증이라 사람이 해야 함 — 그 전엔 링크 배포 금지)
- 2026-08-13 | 브랜드 추가: 애터미(공식 CI .ai) · 세모로고(자체) · 당근(공식 CI, 옛 karrotmarket 흡수)
- 2026-08-13 | 캡처 → `screenshots/20260813_mcp/{desktop,mobile,brand-daangn}.png`
- 2026-08-13 | 로고 원본(.ai) 보관소 신설 — brand-logos `_sources/` (git 미추적, 로컬+드라이브 백업)

- 2026-09-08 OG 커버 리디자인 — 밝은 크림·피치 배경 + 브랜드 로고 타일(귀여운 톤). 원본 HTML/PNG: marketing/assets/og-cover-20260908/, 배포본 public/og-cover.jpg
- 2026-09-08 OG 커버의 16개 브랜드 카탈로그 노출·상세 페이지·SVG/PNG 실파일 확인. `scripts/check-cdn.mjs`에 OG 브랜드 필수 검증 추가. 아트웨이 갤러리는 잘못 수집된 SVG를 제외하고 사용자 제공 PNG(256×37)를 공용 원본으로 교체.

- 2026-09-08: 검수 로고 507개(CDN), 신규 브랜드 63개 서비스 반영. 검수 기록: data/collection/published-review-20260908.json.

- 2026-09-08: Lobe Icons·SVGL 검수 520종, 신규 77브랜드와 기존 278브랜드 연결. 검수 시트: artifacts/ai-svg-collection/publish-*.jpg.
- 2026-09-09 FanEasy 어드민 진입 정리, 세션·UTM·체류 기록 보강, 브라우저 즐겨찾기, 한영 카탈로그 및 Illustrator/로고모음 검색 안내 구현.
- 2026-09-09 영어 보조 화면(로그인·제보·요청·마이페이지·약관·개인정보) 추가: `src/app/en/`, 실제 제출·인증 흐름 연결.
- 2026-09-09 검색 유입 기반 로고 사용법·Illustrator·패션 검색 블로그 3편과 블로그 목록/상세 SEO 경로 추가.
- 2026-09-09 블로그를 발행 데이터·카테고리·태그·읽기 시간·Article JSON-LD 구조로 확장.
- 2026-09-10 세션 기록 기반 블로그 초안 5편과 키엔AI 후처리 입력 가이드 추가.
- 2026-09-10 블로그 초안에 원 세션 날짜·근거 커밋·권장 발행일 메타데이터 추가.
- 2026-09-10 키엔AI 원문·세모로고 해설판 2단계 배포 지침과 동반 글 템플릿 추가.

- 2026-09-20: 대량 브랜드 색인을 위해 2만 URL 단위 사이트맵 인덱스(`/sitemap-index.xml`, `/sitemaps/{locale}-{page}.xml`)와 robots 연결을 추가함.

- 2026-10-06: 로고월 베타 메뉴·등록 안내·추천 스타일/간격/크기/이름 표시/로고월만 보기 개발. 대표 PNG 및 CMS 메타데이터 복원 점검. 브라우저 관리자 정책 확인 오류로 최신 화면 캡처는 보류.

- 2026-10-07: 해외 지수 미수집 주소 232항목 처리, 원본19개·PNG19개·검수 시트/manifest를 assets/index-collection-20261007에 저장. 자동 공개 없음.

- 2026-10-07: 로고이야기에 수집 현황판 콘텐츠 추가. 운영 PostgreSQL 명부 연결·공개·PNG 검증률을 구분하며 60초 자동 갱신.
- 2026-10-07: 기초자치단체 227곳 명부 연결 및 PNG 검수 100%; 봉화/거창 공식 출처·투명 PNG 추가(자산은 marketing/assets/local-government-ci-review-20261007).
- 2026-10-07: 로고 컬렉션 현황을 전국 지자체/공공기관/지방공사·공단으로 묶어 개편; 중앙342·지방공사공단167·출자출연892 공식 명부와 후보 집계 추가, H&M 중복 통합.

- 2026-10-07: yahwa 방식의 익명 세션·UTM·검색·로고 열람·다운로드 선택 분석을 PostgreSQL에 연결. /admin/traffic 어드민, 관리자 토큰 서버 검증, 90일 보관, 원본 IP·회원정보 미저장. 과거 GA 행동은 소급하지 않음.

- 2026-10-08: 흰 배경 전후 검수 226개, 바깥 배경 제거 222개, 혼합 SVG 4개 PNG 전환, 중복 7쌍 통합(기존 주소·버전 보존). 근거: `data/collection/background-merge-release-20261008.json`, 원본·전후 이미지: `marketing/assets/background-merge-review-20261008/`.

- 2026-10-09: 구글 계열 13개에서 투명 SVG 대신 불투명 PNG를 우선 노출하던 문제 수정. 벡터 기반 고해상도 투명 PNG·그라데이션·내부 흰색 보존 검수; `data/collection/google-transparent-release-20261009.json`, 전후 검수 시트 `marketing/assets/google-background-review-20261009/comparison-sharp.jpg`.

- 2026-10-09: 서버 정리 후보·Cloudflare/NCP 이미지 서빙·Vercel 비용 비교 조사; 공식 기관 4곳 신규 검수 및 공식 ZIP 3곳 다운로드 확인. 근거: `marketing/assets/server-audit-20261009/`, `marketing/assets/institution-batch-20261009/`.

- 2026-10-09: 운영 서버 구형 빌드 캐시 약19.2GB·journal 약3GB 정리, idle builder 중지, cold swap 배포 가드 보완 및 서비스 정상 검증. 근거: `marketing/assets/server-audit-20261009/cleanup-result-20261009.md`.

- 2026-10-09: Vibers 러너 작업·DB 백업 11개 경로 데이터 디스크 이관 및 OS 재적재 차단 검증. 상세: `assets/server-audit-20261009/data-move-result-20261009.md`.

- 2026-10-09: 레인보우로보틱스 공식 AI 3종과 투명 배경 로고 17항목 검수·CMS 반영, BTS(방탄소년단) 명칭 정리. 로고월 변형 선택·드래그·개별 크기 및 자동 맞춤·카드 배경 개선. 근거: `assets/rainbow-20261009/`, `assets/requested-background-20261009/`.

- 2026-10-09: Netflix 공식 Logo/Symbol ZIP 확보 및 EPS 기반 SVG·투명 PNG 검수. 잘못된 세로조합형 분류와 깨진 변형 PNG, 불투명 다크 미리보기 교체. 원본·검수: `assets/netflix-20261009/`.

- 2026-10-09: 사용자 SVG 4개를 대한항공(2025/이전), 삼성페이, 카카오뱅크 CMS 및 프론트에 연결. 카탈로그 전용 항목 대표 지정 시 CMS 누락 404와 절대 CDN PNG 경로 미인식 수정. 검수: `assets/user-svg-20261009/`.

- 2026-10-10: 로고 구성 카드에 공통 연회색 그리드 적용, 배경 약5% 진하게 조정. 노트북 광고 전용 열 및 모바일 상세 제목 줄바꿈 수정. TypeScript/로컬 화면1366·1440·390px 확인, 운영 미배포. 캡처: screenshots/20261010_layout/.

- 2026-10-10: 모바일 상세를 바텀시트로 변경, 고정 X·단일 스크롤·safe area 적용. 네이버 등 인앱 구글 로그인은 외부 브라우저 안내로 전환. 브라우저 캡처는 관리 정책 확인 불가로 수행하지 못함.

- 2026-10-10: 로고월 ZIP·HTML/OG 미리보기, 공통 본문 폭, 수집현황 세트 확장과 가공 아이콘 작업. App Store 준비 상태는 listings/app-store/RELEASE_READINESS.md에 기록.

- 2026-10-10: 로고월 미리보기 중앙 배치·화면 비율 최적화·개별 크기 저장, 방송/언론 국내·해외 요약, 카드 배경 밝기 조정. 국가/지역 591개 카테고리 백업 및 재분류(국기197개 유지).

- 2026-10-10: 다운로드 제공 원본 프론트 반영 대조. 후속 부분 패치가 기존 대표 자산 경로를 소실시키는 병합 수정. 광고·일반 문의 이메일을 vibers@vibers.co.kr로 통일.

- 2026-10-10: 수집현황 카드의 대상/남은 대상 내부 이동 버튼 제거. 수집 수치·집계일·공식 명부 링크는 유지.

- 2026-10-10: 제공 원본 대조 12개 콘텐츠·283 PNG/SVG 정상 확인. 원본21개를 8개 콘텐츠 ZIP 다운로드로 보완(평택·연수·한국전력·충북·청주복지·성주·배민·배민라이더스), 기존 버전 manifest 보존. 감사: assets/supplied-source-live-audit-20261010/REPORT.md.

- 2026-10-10: 네이버 블로그6종·공식NAVER3색과이전2종·스마트스토어2종 통합, SVG/2000pxPNG/AI·PDF원본ZIP. 별칭·노출가중치와신규검수콘텐츠사이트맵보강. 미진행원본검수·영문PNG·은행추출작업재개.

- 2026-10-10: 시중은행 SVG시트에서7은행21구성분리,56객체CDN해시확인. 커뮤니티출처표시·공식배지구분,공식자료보존. 공식원본batch6은8기관32종87객체검수게시(누계55기관). 영문PNGbatch4는127개508객체추가준비.

- 2026-10-10: 공식원본batch7 3기관18조합43객체CDN해시검증게시, 누계58기관.

- 2026-10-10: 영어 SVG 4차 127개 투명 PNG·640px 미리보기·2000px 다운로드를 게시하고 공개 CDN 508객체 SHA256 검증 완료. 근거: `assets/svg-transparent-batch4-20261010/`, 통합 검증 `assets/cdn-proof20261010/report.json`. 5차 123개는 별도 시트 검수 및 게시 진행.

- 2026-10-10: 사용자 제공 글로벌 Community SVG 1,408컴포넌트 분리·PNG 렌더 및 22시트 준비, 기존 아트 비교 후 추가 가치 8개/24객체 후보 release 준비(`assets/figma-global-sample-release-20261010`). S&P Community는 별도 321컴포넌트·6시트와 기존 명부 51기업 매칭 후보로 분리 보존(`assets/figma-sp500-collection-20261010`), 현재 명부/verified 미변경.

- 2026-10-10: Community 6개 묶음 검수: 102개 브랜드·283개 CDN 파일 게시, 자동차/베트남 수록 목록과 S&P 37/500 PNG 검수 반영. 배포 8faaf76 SUCCESS·6개 상세/목록 경로 200. 근거: assets/figma-export-intake-20261010/REPORT.md 및 deploy-verification.json.

- 2026-10-10: Better Logos community color variants reviewed; user-original AI/ZIP downloads and variation counts exposed, eight visually reviewed representative recommendations applied. Evidence: assets/figma-better-collection-20261010/, assets/representative-votes-20261010/.

- 2026-10-11: 공식 8기관 34변형·SVG PNG 미리보기 118브랜드·Better 보류해소 10그룹 게시 근거 보존. 네이티브 검색·기기 즐겨찾기·OS 공유 구현 및 스토어 문안 갱신; 실제 빌드·스토어 등록은 검증 대기.

- 2026-10-11: 스토어 사전 제출 자료 작성. marketing/listings/SUBMISSION_KIT_20261011.md에 심사 메모·개인정보/등급 근거·촬영/검수 계획 정리. Play 1024×500 피처 그래픽 및512px 아이콘 생성, 실제 캡처 입력용 제작 도구 추가. 실제 앱 스크린샷·서명 빌드·제출은 미완료.

- 2026-10-11: 스포츠 공식 아이덴티티 병렬 수집 시작. KBO/KT 마스코트, K리그/FC서울, KBL/KOVO, NBA를 분담하고 ops/sports-collection-20261011.md에 수집/검수/게시 단계를 구분해 기록. 9ff 및 KOREHA 후속 변형은 게시 완료·프론트 배포 대상.

- 2026-10-11 스포츠 첫 배포 묶음: KT·FC서울·NBA2·KOVO2 기존6팀/12변형/39객체 CDN·CMS 검증, FC서울 대표 정정. 원본과 QA는 marketing/assets 스포츠 배치, 범위·후속은 ops/sports-collection-20261011.md.

- 2026-10-11 사용자 10/18 글로벌 선두권 목표 접수. ops/global-leadership-sprint-20261011.md에 품질·완결세트·로고월·해외유입·광고5서비스 공식근거·세모위키7주제/첫편 구조 기록, 기존 추적표 G01~G08 연결. 광고가입/영상발행/세계순위달성은 미실행.

- 2026-10-11: 요청 금융·기업 13곳 중 10곳/16개 SVG·투명 PNG 반영. 우아한형제들 기존 ID 복구, 비젠트로 공식 AI/ZIP 보존. 근거: ops/requested-business-collection-20261011.md.

- 2026-10-11: 사용자 요청으로 당근페이·쿠팡페이·지머니트랜스 공식 PNG 5개 우선 공개. 전체 요청 13곳 등록, SVG 대기 별도 기록.

- 2026-10-11: 재부팅 후 iOS/Android 빌드 재개, ASC API 등록 상태 재검증, Play 계정 인증 차단 재확인. `listings/app-store/reboot-progress-20261011.json`에 실행 로그와 사용자 인증 필요 항목 기록.

- 2026-10-12: 사용자 선호에 따라 OG를 기존 따뜻한 배경·로고 콜라주 디자인으로 복원하고 18만+ 수치 반영. 한국어·영문 이미지 revision 20261012b.

- 2026-10-12: cyberpixie SVG의 전체 캔버스 흰 배경 도형 1개 제거, 여백 정리, 2000px 투명 PNG 생성. 원본 보존, CDN 바이트 및 투명도 검증, CMS 대표/베리에이션 적용, 실제 상세 페이지 새 경로 확인. 전체 앱 빌드와 별개로 반영 완료.

- 2026-10-12: 현대자동차 hyundai로 중복 3개 콘텐츠 통합(가로/세로/심볼 등 5종). 원본 SVG·기존 버전·주소 이력 보존, Motorsport와 출처 불명 워드마크 제외. 대표 PNG를 카드·다운로드 공통 경로에 적용하고 관리자가 저장한 대표 선택이 번들 기본값보다 우선하도록 수정. cyberpixie 투명 자산도 검수 오버레이에 추가.

- 2026-10-13: 로컬 Linux 이미지 배포 및 초기 JS 68.5% 감소 검증. intro 캡처: `screenshots/20261013_intro/desktop.png`, `mobile.png`.

- 2026-10-13: 카드 이미지 선로딩·모달 코드/구성 미리 준비 배포(d1f4caa). NBA/NHL 7개 구단 공식 투명본 대표 연결, 기존 구성 보존. intro 캡처: `screenshots/20261013_loading/{desktop,mobile}.png`.

- 2026-10-13: 사이트맵·canonical·주요 내부 링크 최종 주소 통일 배포(0f3528f). 경량 자산 플래그 판정 수정. 실제 분할 XML 20개/362,776 URL 검증 PASS. Search Console sitemap-index.xml 제출 접수, 최초 처리 상태 확인 중. 근거: task-tmp/seo-verification-20261013.json.

- 2026-10-13: Search Console sitemap-index.xml 제출·재제출 접수 및 Google 실제 가져오기 성공 확인. 보고서 상태는 가져올 수 없음/발견 0으로 남아 처리 결과 미확정. 배포 화면 캡처: `screenshots/20261013_seo/{desktop,mobile}.png`.

- 2026-10-13: 나이키 기본 로고 10개 구성, Nike Golf/Nike.com/Nike+iPod/Nike Football 분리 및 중복 통합 준비. 화면의 TK·OMNIKEY·Chernikeeff 흰 배경 검수. 공개 전 SVG 원본·고해상도 PNG·CDN 해시 확인. 전체 SVG 174,619개 진단을 재개하고 기존 95,793개 기록 재사용, 자동 공개 없음.

- 2026-10-14: SVG 전수 점검 결과를 관리자 검토 목록으로 연결. 안전 조건(단일 전체 배경·실제 투명도·기존 PNG 없음)을 통과한 후보는 원본 보존 상태로 투명 SVG·PNG 별도 경로에 게시하고 진행 기록을 남김. 수동 검토·불투명·처리 실패·기존 PNG 항목은 관리자 교체 검토/재수집 요청 대상으로 분류. 상세 로고 구성 카드에도 관리자 전용 교체 표시를 추가함.
- 2026-10-14: 내슈빌 프레더터스·롤렉스의 흰 배경 SVG 투명 파생본을 별도 구성으로 공개하고 내슈빌 공식 팀 마크를 대표로 지정. 중복 수집 시 파일 형식·구성 정보를 보완하는 로직과 4종 구성 감사 보고서를 추가함(`assets/logo-composition-coverage-20261014.json`).
- 2026-10-14: 수집현황의 완성 기준을 대상·PNG 검수와 서로 다른 심볼·글자형·가로·세로 조합 4종으로 강화. 공개/PNG 검수는 별도 수치로 유지하고 명부별 부족한 구성을 표시. 현행 명부에 연결된 고유 콘텐츠 720건 중 6건이 4종 완성, 부족한 항목은 `assets/four-form-recollection-20261014/queue.json`에 공식 출처와 함께 우선순위화. 매일 03시 재집계 LaunchAgent 설치·첫 실행 정상 종료. 자동차손해배상진흥원 공식 CI AI에서 누락된 글자형을 추출해 투명 SVG·2200px PNG로 추가함.
- 2026-10-14: 한국공공조직은행 공식 CI AI에서 잘림 없는 세로형·심볼·글자형을 재추출하고 기존 콘텐츠에 가로·세로·영문·반전 8종 SVG/PNG와 원본 AI를 통합. 기존 PNG는 보존하고 CDN·CMS·상세 페이지 응답을 검증함(`assets/official-next-20261013/kptb-published.json`).
- 2026-10-14: 한국산업은행 2025 공식 CI ZIP 4개에서 국·영문 7종 SVG/PNG를 추출·검수해 기존 콘텐츠에 통합. 원본 AI 묶음과 이전 PNG를 보존하고 CDN·CMS·상세 페이지 응답을 확인함(`assets/official-next-20261013/kdb-extracted/published.json`).
- 2026-10-14: 한국산업은행·한국공공조직은행의 경량/전체 카탈로그 두 항목을 공식 SVG·PNG와 일치하도록 갱신. 사전 백업·해시/ETag 대조·게시 후 바이트 검증은 `assets/catalog-bank-patch-20261014/`, 재현 코드는 `scripts/patch-bank-catalog-20261014.py`와 `scripts/publish-bank-catalog-20261014.py`. 세모로고 재시작 후 배포 검증과 실제 검색 API 확인 완료.
- 2026-10-14: SVG 배경 제거 대량 게시의 초기 실패 5건을 원본 해시·투명도 재검증 후 별도 게시하고 DB 5/5 확인(`assets/svg-background-publish-20261014/retry-five.json`, `scripts/retry-svg-background-five-20261014.py`). 전체 대량 게시 작업은 계속 진행 중.
- 2026-10-14: 충청남도 공식 AI 기반 국문 가로형에서 글자형을 분리해 투명 SVG·2400px PNG로 기존 27종 콘텐츠에 합침(`assets/south-chungcheong-wordmark-20261014/`). CDN 28종 공개 확인, 4형태 완성 집계 7/720으로 갱신.
- 2026-10-14: 81,731건 SVG 투명 파생본 대량 게시 중 Object Storage 요청 제한(`SlowDown`)이 발생해 재실행용 게시 함수에 지수 대기 재시도를 추가. 현재 실행분 완료 후 실패 건을 재처리해 최종 검증 예정.
- 2026-10-14: 미추홀구의 중복 심볼 카드 2개를 공식 AI 기반 대표 콘텐츠로 통합하고 기존 주소는 대표로 연결. 마스코트 미추에는 제공 AI에서 추출한 투명 SVG·2400px PNG를 별도 대표로 지정. 미추홀구시설관리공단은 현재 공식 사이트의 심볼 원본을 기존 가로형 로고에 추가하고 기관명·주소를 최신화. 백업·카탈로그 해시·게시 기록은 `assets/michuhol-review-20261014/`, 게시 코드는 `scripts/publish-michuhol-review-20261014.py`.
- 2026-10-14: 공용 NCP 배포 대기열에 디스크 I/O 압박 검사와 1.5 CPU 빌더 상한을 추가해 세모로고의 조건부 운영서버 빌드를 재개. 미추홀구 이름 수정이 포함된 버전을 배포하고 건강 상태·응답시간을 검증함. 운영 기준은 `ops/deploy-policy-20261014/`.
- 2026-10-14: 미추홀구 마스코트 미추의 오래된 가로형 대표 PNG를 공식 AI 추출 캐릭터 단독 이미지로 교체. 캐시가 남은 기존 파일 대신 새 해시 경로의 투명 SVG·2400px PNG와 중앙 정렬 1024px 아이콘을 게시하고, 관리자 대표 설정·구성 매니페스트·검색 카탈로그를 갱신. 구 가로형 파생물은 화면 구성에서 제외하고 원본은 보존. 게시 코드는 `scripts/publish-michu-crop-20261014.py`, 백업·해시 기록은 `assets/michu-crop-20261014/`.
- 2026-10-14: 사용자 제공 글로벌 Community SVG 금광에서 기존 이미지와 직접 비교해 9개 브랜드의 구별되는 변형을 기존 콘텐츠에 추가. 원본 SVG·2000px 투명 PNG·미리보기 27개 CDN 객체 검증, 운영 DB 및 공개 변형 목록 9/9 확인. 현재 공식 CI로 주장하지 않고 대표 이미지는 보존. `assets/figma-global-next-20261014/` 및 `scripts/prepare-figma-global-next-20261014.cjs`.
- 2026-10-15: 로고 이야기의 컬렉션 현황을 일반 독자용으로 정리. 카드에는 등록된 로고 수와 목록 링크를 중심으로 표시하고, 네 가지 형태·파일 품질 기준은 접어 읽는 설명으로 이동. 목록 페이지도 등록 현황을 우선 표시하며 검색 메타 설명을 갱신.
- 2026-10-15: 4종 구성 재수집 대기열의 LaunchAgent가 DB 터널 없이 실패하던 문제를 `scripts/run-four-form-queue.sh`로 수정하고 재설치·실행 성공 확인. 부산경제진흥원의 공식 로고타입 AI와 과천문화재단의 공식 CI AI에서 각각 글자형을 추출해 기존 콘텐츠에 투명 SVG·PNG·원본 AI로 추가. 기존 대표 이미지와 변형을 보존하고 CDN·CMS·공개 수집현황 확인. 고유 4종 완성 7→9, 지방 출자·출연기관 명단 4→6.
- 2026-10-15: 경제진흥원 검색 결과를 검수해 강원특별자치도경제진흥원의 두 버전이 한 장에 들어간 CI 판을 대표 이미지에서 제외하고 공식 ZIP의 컬러 가로형을 투명 SVG·PNG로 분리. 충남경제진흥원은 공식 AI/PNG 6종에서 심볼·글자형을 추가해 8종 구성, 경남투자경제진흥원은 공식 AI ZIP에서 5종 구성, 서울경제진흥원은 공식 AI에서 심볼·글자형·가로·세로 4종을 제공. 원본·해시·게시 근거는 `assets/economic-promotion-audit-20261015/`, 재현 및 게시 코드는 `scripts/prepare-economic-promotion-20261015.py`와 `scripts/publish-economic-promotion-20261015.py`.
- 2026-10-15: 공통 Windows fleet에 세모로고 공식 SVG 수집 작업을 추가해 win-01·win-02가 각 11건씩 수집, 비공개 vibers 버킷 manifest/원본 해시 22/22를 Mac에서 재검증. Downloads 로고 원본 후보 87개를 재대조하고 공개 CDN 원본 15/15 SHA-256 일치 확인. 검토 대기 원본과 다운로드 누락 후보는 `assets/worker-logo-batch-20261015/` 및 `assets/download-original-audit-20261015/REPORT.md`에 기록.
- 2026-10-15: Windows 수집 22건을 밝고 어두운 배경에서 검수해 기존 기관 콘텐츠 10건에 원본 SVG·투명 PNG 20개를 추가. 이미 게시된 동일 원본은 중복하지 않고, 다른 정체성인 문화도시김해 파일은 김해문화관광재단 대표 로고에서 제외. 쿠팡 파트너스 상품 검색을 상세 페이지 브랜드와 연결하고 오늘의집은 집 꾸미기 상품 1개를 우선 노출하며 검색 실패 시 기존 골드박스로 돌아가게 함. 광고가 실제 보일 때의 노출과 클릭을 브랜드·모드별로 기록해 클릭률을 비교할 수 있게 함.
- 2026-10-15: 브랜드 상세의 자동 생성 다크 PNG에도 구성별 관리자 교체 투표를 제공하고 관리자 검토 목록에서 원본과 자동 생성 구성을 구분. 쿠팡 관련 상품 검색은 한 건에서 최대 다섯 건까지 반환하도록 확장하고 첫 상품을 정사각형 대표 카드, 뒤 상품을 가로형 목록으로 표시.
- 2026-10-15: 브랜드 상세 패널을 좌우 240px로 균형 있게 조정하고 공유 도구를 왼쪽 다운로드 아래로 이동. 프로필 상단의 중복 다크 타일을 제거하고 앱 아이콘 미리보기 이미지를 영역 끝까지 표시. 쿠팡 파트너스 검색은 정확한 브랜드 상품을 우선, 브랜드명이 없어도 검색어와 연결된 상품은 후순위로 표시하며 Redis 캐시와 공식 검색 API의 분당 50회 제한보다 낮은 공유 호출 예산을 적용.
- 2026-10-15: 브랜드 상세의 왼쪽에서 가운데 대표 이미지와 겹치는 미리보기를 제거하고 다운로드를 먼저 표시. 사용 예시·상세 공유 옵션은 접어서 정리하고 아이콘 만들기·로고 이력은 로고 구성 뒤로 이동. 이력 API는 펼칠 때만 조회. 로컬 화면 캡처: `screenshots/detail-panel-20261015.png`, `screenshots/detail-panel-mobile-20261015.png`.
- 2026-10-15: win01·win02 공식 SVG 수집 명부를 22→49개로 확장하고 국내 기관·해외 헬스케어·해외 기업 담당을 분리. 27개 추가 출처의 사전 검사·중복 대조와 서버/Windows 배포 근거를 `ops/worker-logo-expansion-20261015.md`에 기록.
- 2026-10-15: 수집 명부를 68개로 늘리고 win01 5건·win02 14건을 추가 회수해 비공개 버킷 원본 해시 19/19 검증. 앞선 수집분의 기존 콘텐츠 6건에 공식 SVG·PNG 구성을 추가하고, 이번 수집분의 Beta Bionics·Life360·QCR Holdings·ReposiTrak 4개 신규 콘텐츠를 신원·밝고 어두운 배경·CMS 중복 검토 후 공개. 서버 명부와 Windows 패키지, 보류 11건의 20KB 제한은 `ops/worker-logo-cycle-20261015b.md`에 기록.
- 2026-10-18: 로고월 편집기와 ZIP HTML의 카드 폭을 로고 원본 비율에 맞춰 확장하고 가로 스크롤을 지원해, 네이버 클라우드 플랫폼처럼 긴 가로조합형이 좁은 정사각 카드에 갇히지 않도록 개선.
- 2026-10-19: 로고월 편집기에서 확대된 로고가 같은 줄의 중심선에 맞도록 카드 정렬을 조정하고 움직임 미리보기도 줄 높이와 카드 간격을 통일. 자동 맞춤은 면적 대신 보이는 로고 높이 80%를 기준으로 하고 가로 너비와 간격은 원본 비율·설정값을 유지. 전체 '크게'를 104→92px로 낮추고 스타일에 원본·단색 검정·단색 흰색을 추가해 편집·미리보기·HTML·OG에 적용.

# semologo 마케팅

> 표준: macminim4/ops/marketing/marketing-standard.md / 생성: 2026-08-08

- 📢 **이 사이트는 광고 지면입니다** → [ADS.md](ADS.md) (현재 게재 광고·동작 방식)

## 현재 자산 (최신만)
- screenshots/20260809_v1/ — home·brand × desktop·mobile 4장
- (og-image·favicon 원본은 public/ 에 있음 — 추후 meta/ 로 이관 검토)

## 과업 로그 (최신이 위)
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

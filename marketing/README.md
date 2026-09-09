# semologo 마케팅

> 표준: macminim4/ops/marketing/marketing-standard.md / 생성: 2026-08-08

- 📢 **이 사이트는 광고 지면입니다** → [ADS.md](ADS.md) (현재 게재 광고·동작 방식)

## 현재 자산 (최신만)
- screenshots/20260809_v1/ — home·brand × desktop·mobile 4장
- (og-image·favicon 원본은 public/ 에 있음 — 추후 meta/ 로 이관 검토)

## 과업 로그 (최신이 위)
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

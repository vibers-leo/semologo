# 세모로고 풀케어 리포트

- 대상: semologo (https://semologo.com) — GitHub Pages 정적 배포
- 수행: 2026-08-09
- 기준 커밋: `ef1b30a`

---

## Phase 1 — 현재 상태 (변경 전)

### 라우트 인벤토리 (10개)

| 경로 | 성격 | 응답 |
|---|---|---|
| `/` | 브랜드 그리드 (메인) | 200 |
| `/brand/[id]` | 브랜드 상세 — 정적 생성 6,824개 | 200 |
| `/faq` · `/terms` · `/privacy` | 정적 문서 | 200 |
| `/submit` · `/request` | 제보·요청 폼 | 200 |
| `/login` | Google OAuth | 200 |
| `/admin` · `/requests` | 관리자 (클라이언트 인증) | 200 |

TS 파일 28개 / `src` 276KB. **TODO·FIXME·HACK 0건**, "준비 중" 빈 페이지 0건.

### 성능 (프로덕션 실측, Playwright Navigation Timing)

Lighthouse CLI가 이 환경에 없어 설치 대신 실제 브라우저 지표를 측정했다.

| 페이지 / 뷰포트 | TTFB | FCP | Load | 요청 | 전송량 |
|---|---|---|---|---|---|
| 홈 / 데스크톱 | 453ms | 2,140ms | 2,235ms | 40 | 842KB |
| 홈 / 모바일 | 46ms | 108ms | 244ms | 42 | 845KB |
| 브랜드 / 데스크톱 | 454ms | 720ms | 1,328ms | 69 | 1,071KB |
| 브랜드 / 모바일 | 359ms | 488ms | 1,447ms | 64 | 1,063KB |
| FAQ / 데스크톱 | 275ms | 428ms | 495ms | 53 | 1,066KB |

- 가로 스크롤: **전 페이지·전 뷰포트 없음**
- 4xx/5xx: 0건
- 전송량의 대부분은 `brands-slim.json` (996KB) — 목록 데이터

### 발견된 문제

| # | 항목 | 실측 |
|---|---|---|
| 1 | 홈 런타임 에러 `PAGEERROR Y` | AdSense 이중 push (React effect 재실행). 상세·FAQ에는 없음 |
| 2 | 브랜드 수 **6,061로 하드코딩** | 실제 6,824 — `layout.tsx` 3곳 |
| 3 | `canonical` 없음 (홈) | 상세 페이지에는 있음 |
| 4 | `manifest.json` 404 | 앱 아이콘·PWA 메타 부재 |
| 5 | `llms.txt` 404 | AI 크롤러 안내 부재 |
| 6 | Next 템플릿 잔재 5개 | `file/globe/next/vercel/window.svg` — **코드 참조 0건** |
| 7 | 14px 미만 폰트 118건 | BrandInner 60 · admin 18 · Footer 12 · 그 외 28 |
| 8 | 패키지 매니저 미고정 | `packageManager` 없음, `package-lock.json` 사용 (표준은 pnpm) |

Next 16.2.12 / React 19.2.4 — **버전 표준(≥16.2.11) 이미 충족**.

### 디자인 토큰 실태

`globals.css`에 `--bg/--surface/--border/--border-hover/--text/--text-secondary` 6개 정의.
인라인 `style={{}}` 305건 vs CSS 변수 참조 128건 — 인라인 비중이 높지만
색상은 대체로 토큰 또는 일관된 팔레트(`#6366f1`, `#18181b`, `#71717a`)를 쓰고 있다.
**새 색을 발명하지 않고 기존 값으로 수렴시키는 방향**으로 진행한다.

---

## 변경 내역

(Phase 2 이후 채움)

---

## 전/후 지표

(Phase 7에서 채움)

---

## 개선·BM 제안

(Phase 8에서 채움)

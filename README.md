# 세모로고

세모로고는 브랜드 로고를 SVG·PNG와 변형별로 찾고 내려받을 수 있는 정적 웹 서비스입니다.
웹 주소와 로고 CDN 주소는 배포 환경변수로 관리합니다.

## 기술 구성

- Next.js 16 App Router, TypeScript, Tailwind CSS
- `output: "export"` 정적 사이트 → GitHub Pages 배포
- Firebase Authentication / Firestore (요청·품질 피드백)
- GA4 행동 이벤트
- pnpm 11

## 로컬 실행

```bash
pnpm install
pnpm dev
```

필요한 Firebase 공개 환경변수는 `.env.local`에 설정합니다. 값은 저장소에 커밋하지 않습니다.

```bash
pnpm type-check       # TypeScript 검사
pnpm check:cdn        # 로고 CDN과 브랜드 데이터 사전검증
pnpm verify           # 위 두 검증을 함께 실행
pnpm build            # 정적 out/ 생성
pnpm build:webpack    # Turbopack 환경 이슈 시 Webpack 폴백 빌드
```

## 배포 구조

`main` 브랜치 푸시 → GitHub Actions → CDN 사전검증 → 정적 빌드 → `gh-pages` 배포 순서입니다.

브랜드를 추가할 때는 반드시 다음 순서를 따릅니다.

1. `brand-logos` 저장소를 커밋·푸시하고 Pages 배포가 끝날 때까지 기다립니다.
2. 로고 CDN의 `version.txt` 값을 확인합니다.
3. 이 저장소의 `src/lib/cdn.ts` `VERSION`을 같은 값으로 갱신합니다.
4. `pnpm verify` 후 세모로고를 배포합니다.

`check:cdn`과 `fetchBrands`는 모두 최소 1,000개 이상의 유효한 브랜드 ID를 확인합니다. CDN 장애나 HTML 폴백을 빈 목록으로 취급해 정적 페이지 전체가 빠진 채 배포되는 일을 막기 위함입니다.

## Firestore 규칙

[firestore.rules](firestore.rules)에 공개 요청·품질 투표·관리자 데이터의 기본 규칙을 관리합니다. 실제 배포는 Firebase 콘솔의 기존 규칙을 덮어쓰므로, 배포 전에 현재 운영 규칙을 백업하고 Emulator에서 요청·투표·관리자 처리 흐름을 확인해야 합니다.

```bash
firebase deploy --only firestore:rules
```

관리자는 Firebase 인증 토큰의 이메일 `juuuno1116@gmail.com`으로 판정합니다. 장기적으로는 이메일 하드코딩 대신 Firebase custom claim으로 전환합니다.

## 측정 이벤트

GA4에서 아래 이벤트를 수집합니다.

- `search_submitted`, `search_no_result`
- `brand_opened`, `logo_downloaded`
- `request_submitted`, `logo_submitted`

핵심 지표는 **검색 후 브랜드 열람 또는 다운로드까지 완료한 주간 세션 수**입니다.

## MCP

MCP 패키지는 [mcp/README.md](mcp/README.md)를 참고합니다. 로고 URL, SVG 원문, 이름·초성 검색을 로컬 MCP 프로세스로 제공합니다.

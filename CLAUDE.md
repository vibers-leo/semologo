# 세모로고 (SemoLogo) — 세상 모든 로고

## 프로젝트 개요
- **브랜드명**: 세모로고 (세상 모든 로고)
- **URL**: semo.vibers.co.kr
- **GitHub**: vibers-leo/semologo
- **레퍼런스**: 눈누(noonnu.cc) — 흰 배경, 카드 그리드, 광고 수익화

## 에셋 CDN
- **CDN URL**: https://logo.vibers.co.kr/_clients/{brand-id}/logo.svg|png
- **brands.json**: https://logo.vibers.co.kr/_clients/brands.json
- **총 브랜드**: 2,718개 (2026-08-02 기준)
- **brand-logos 레포**: CDN 전용, 서비스는 semologo로 분리

## 기술 스택
- Next.js 16 (App Router) + TypeScript
- Firebase (ai-recipe-lab 재사용) — Auth: Google OAuth
- Tailwind CSS 4 + Pretendard 폰트
- Vercel 배포 (로컬 빌드는 외장SSD 심링크로 Turbopack 불가 — Vercel에서만 빌드)

## 빌드 노트
- **패키지 매니저: pnpm** (2026-08-09 bun→pnpm 전환). `pnpm install` / `pnpm run build`
  - `node_modules`·`.next` 는 프로젝트 안 실폴더여야 한다. 외부 캐시로 나가는 심링크면
    Turbopack 이 "points out of the filesystem root" 로 죽는다 (예전 로컬 빌드 불가의 원인)
  - 스토어 `/Volumes/Untitled/dev/.pnpm-store` — 프로젝트와 같은 볼륨이라 하드링크로 dedup
- 로컬 빌드 **가능** (약 3분, 6,822 페이지). 예전 "심링크 때문에 불가" 설명은 폐기
- 배포: **GitHub Pages** (Vercel 아님). `git push origin main` → `.github/workflows/deploy.yml`
  → `Deploy to GitHub Pages` 실행 → 이어서 `pages build and deployment` 완료돼야 반영됨 (총 10분 내외)
- 검증: `gh run list --repo vibers-leo/semologo` 두 워크플로 모두 success 확인 후 `curl -sI https://semologo.com`

## 환경변수 (Vercel에 등록 필요)
- NEXT_PUBLIC_FIREBASE_API_KEY
- NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
- NEXT_PUBLIC_FIREBASE_PROJECT_ID
- NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
- NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
- NEXT_PUBLIC_FIREBASE_APP_ID
- NEXT_PUBLIC_CDN_URL=https://logo.vibers.co.kr/_clients
- NEXT_PUBLIC_APP_URL=https://semo.vibers.co.kr

## 디렉토리 구조
```
src/
├── app/
│   ├── page.tsx          ← 메인 그리드
│   ├── login/page.tsx    ← Google OAuth
│   ├── submit/page.tsx   ← 로고 제보
│   ├── robots.ts
│   └── sitemap.ts
├── components/
│   ├── Header.tsx        ← 검색 + 네비
│   ├── BrandGrid.tsx     ← 카드 그리드 + 필터
│   └── BrandModal.tsx    ← 다운로드 모달
└── lib/
    ├── firebase.ts       ← Firebase 초기화
    └── brands.ts         ← brands.json fetch + 타입
```

## 브랜드 추가 순서 (중요 — 안 지키면 페이지가 404 난다)

```
1. brand-logos 커밋 + 푸시
2. **brand-logos 의 pages 배포가 끝날 때까지 기다린다**   ← 이걸 빠뜨리면 404
   gh run list --repo vibers-leo/brand-logos --workflow pages-build-deployment --limit 1
3. curl -s https://logo.vibers.co.kr/version.txt 로 최종값 확인
4. semologo 의 VERSION 3곳 갱신 → 커밋 + 푸시
```

**왜 기다려야 하나:** semologo 빌드는 CDN 의 `brands.json` 을 읽어 6,800여 개
브랜드 페이지를 만든다. CDN 이 아직 갱신 전이면 신규 브랜드 페이지가 아예
생성되지 않아 **404** 가 된다. 캐시버스터(`?v=`)가 있어도 소용없다 — 파일 자체가
아직 안 올라갔기 때문이다.

실제로 두 번 겪었다 (2026-08-13 애터미·세모로고). 두 번째는 semologo 빌드가
brand-logos 배포보다 **52초 먼저** 시작해서 났다. 증상이 같으니 신규 브랜드
페이지가 404 면 이 순서부터 의심할 것. 재빌드하면 해결된다.

## CURRENT_VERSION (CDN 캐시 버스팅)
- `BrandGrid.tsx`, `BrandInner.tsx` 내 `VERSION` 상수: `1786194708`
- brand-logos 레포의 `version.txt` / `index.html`(`CURRENT_VERSION`)과 같은 값으로 맞춘다
- ⚠️ **brand-logos 에는 커밋마다 `version.txt` 를 자동으로 올리는 pre-commit 훅이 있다**
  (`.git/hooks/pre-commit`). 그래서 **brand-logos 를 먼저 커밋·푸시한 뒤**
  최종 `version.txt` 값을 읽어 semologo 상수에 넣어야 한다. 순서를 바꾸면 항상 어긋난다.
  현재 값 확인: `curl -s https://logo.vibers.co.kr/version.txt`
- CDN 에서 받는 JSON에도 `?v=` 를 붙인다. 안 붙이면 `force-cache` 때문에
  신규 브랜드가 기존 방문자에게 영영 안 보인다 (실제로 겪은 버그)

## 로고 유무 판정 (중요)
- `brands.json`: `logo_svg` 또는 `has_svg` 중 하나라도 truthy면 SVG 사용 → 없으면 PNG 폴백 → 둘 다 없으면 기본 아이콘
- **두 필드를 항상 같이 세팅할 것.** `brand/[id]/page.tsx`는 `logo_svg`만 보고,
  `BrandGrid`/`BrandInner`는 둘 다 본다 (과거 빈화면 버그 원인)
- `brands-slim.json`: id·name_ko·name_en·category·has_svg·has_png·added_at만 담은 경량판.
  목록 그리드용으로 적합 (원본 대비 훨씬 작음)
- `<img>`로 CDN 직접 사용 가능. **onError 폴백 필수**

## 세모로고 별칭
"세모로고에서 찾아봐" → https://logo.vibers.co.kr/_clients/brands.json fetch 후 검색
"로고 CDN URL" → https://logo.vibers.co.kr/_clients/{brand-id}/logo.svg

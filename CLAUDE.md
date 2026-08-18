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
- 배포: **NCP Docker** (위 '배포' 섹션 참고). GitHub Pages·Vercel 아님 — 2026-08-18 이전
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

## 배포 — NCP Docker SSR (MANDATORY) — 2026-08-18 이전

**GitHub Pages 아님. `output: "export"` 아님.** 서버에서 요청 시 렌더한다.

| 항목 | 값 |
|---|---|
| 서버 | NCP `ssh vibers` · 컨테이너 `semologo` · 포트 **4520** |
| 프로젝트 | `/root/projects/semologo/` (`.env`·`.webhook.conf` 는 600) |
| 배포 | `git push origin main` → GitHub 웹훅 → `webhook-deploy-generic.sh` |
| 빌드 | 서버에서 `semologo:latest` 로 빌드 → compose 는 `image:` 만 참조 |
| 검증 | `ssh vibers "bash /root/check-deploy.sh semologo https://semologo.com"` |

### 왜 전부 미리 굽지 않나 — 세 호스팅이 다 막혔다
브랜드 4.1만 개를 정적으로 굽으면 **파일 20.5만 개 / 3.4GB** 다(실측).
  · GitHub Pages — 사이트 **1GB 하드 리밋**. 유료 플랜으로도 안 올라간다
  · Cloudflare Pages — 배포당 **파일 10만 개**. 9만 브랜드에서 다시 막힌다
  · 어느 쪽이든 빌드가 25~30분으로 늘고 브랜드 수에 정비례한다

그래서 **최근 1,500장만 빌드에 굽고**(`PRERENDER`) 나머지는 첫 요청 때 만들어
캐시한다. 빌드는 브랜드가 몇 개든 **1~2분 고정**이다.

### 손대면 깨지는 것
- `docker-compose.yml` 에 **`build:` 를 넣지 마라.** 배포 스크립트는 소스를
  `/tmp` 에 클론해 빌드하고 compose 파일만 `/root/projects/semologo` 로 복사한다.
  그 디렉토리엔 소스가 없어 빌드가 실패한다. `image: semologo:latest` 만 쓴다.
- **`NEXT_PUBLIC_*` 는 빌드 시점에 번들에 구워진다.** 런타임 env 로 주면 안 먹는다.
  서버 `.webhook.conf` 의 `BUILD_ARGS` 에 `--build-arg` 로 넣는다.
- `mem_limit` 과 `memswap_limit` 을 **같은 값으로** 둔다(768m). 다르면 스왑에
  빠져 서버 전체가 느려진다. 같으면 OOM Kill 후 자동 재시작된다.
- 상세 페이지는 **브랜드별 `brand.json`(약 1KB)** 을 받는다. `brands.json`
  전체는 4만 개 기준 18MB 라 렌더마다 다시 받게 되고 힙도 위험하다.

### 남아 있는 것 (지우기 전 확인)
Vercel(`semologo` 프로젝트)·Cloudflare Pages(`semologo.pages.dev`) 배포가
**검증된 채로 남아 있다.** NCP 장애 시 즉시 돌아갈 수 있는 경로다.
안정화가 확인되면 정리한다. `scripts/strip-prefetch.mjs` 는 CF Pages 전용이다
(Next 16 이 브랜드당 프리페치 `.txt` 를 4개씩 만들어 파일 수가 5배가 된다).

## 에셋 저장 구조 — PNG는 저장소에 없다 (MANDATORY) — 2026-08-18 이관

**`logo.svg` 는 GitHub Pages, `*.png` 는 NCP 버킷이 서빙한다. URL 은 둘 다 같다.**

| 무엇 | 어디 | 크기 |
|---|---|---|
| `logo.svg` · `variants.json` · `brands*.json` | GitHub Pages (`brand-logos` 레포) | 82MB |
| `logo.png` · `logo-800` · `-transparent` · `-white` · `-icon` · `sources/*.png` | **NCP `vibers-bucket`** | 640MB |

### 왜 — Pages 1GB 하드 리밋에 부딪혔다
`_clients` 가 856MB(86%)였고 **브랜드를 1,000개도 더 못 넣는 상태**였다.
용량을 먹는 건 로고가 아니라 PNG 파생물이었다(79%). 원본 SVG 는 70MB 뿐이고
PNG 는 전부 SVG 에서 재생성 가능하다 — SVG 우선 원칙 그대로다.
이관 후 82MB(8%)가 되어 5만 개까지 여유가 생겼다.

### 서빙 — `logo-guard` 워커
`cf-worker/logo-guard/index.js`. `_clients/**/*.png` 는 버킷에서 가져오고,
**없으면 기존 Pages 로 폴백한다.** 이 폴백이 안전장치다 — 이관 도중에도,
버킷 장애 때도 안 깨진다. 핫링크 차단은 그대로 유지된다.

> 온디맨드 렌더링(워커가 SVG→PNG 변환)은 **일부러 안 했다.** 다크 반전·흰배경
> 제거·심볼 크롭은 numpy 로직이라 JS 로 다시 짜면 결과가 미묘하게 달라진다.
> 버킷 방식은 파이썬 산출물을 **바이트 그대로** 내보낸다.

### 반드시 지킬 것
```bash
python3 scripts/sync-png-bucket.py --pull   # ★ build-variants 앞에 (없으면 3만개 재생성)
python3 scripts/sync-png-bucket.py          # 끝나고 신규 PNG 업로드 (없으면 다운로드 404)
```
- **`--pull` 을 빠뜨리면** build-variants 가 "PNG 가 없으니 만들자"로 판단해
  매 실행마다 3만 개를 다시 만든다. 결과물은 같고 시간만 버린다.
- **업로드를 빠뜨리면** 신규 브랜드 PNG 가 저장소에도 버킷에도 없어 404 다.
- `daily-collect.yml` 에 두 단계가 들어 있다. 시크릿 `NCP_*` 4종 등록됨.
- ⚠️ **`git rm --cached` 후 `git pull --rebase` 는 로컬 PNG 를 지운다.**
  워킹트리를 커밋 트리에 맞추기 때문이다. 유실은 아니다(버킷에 있다) —
  `--pull` 로 되받으면 된다. 2026-08-18 에 40,994개가 이렇게 사라졌다.

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

## SVG 우선 원칙 (MANDATORY) — 2026-08-16 확정

**SVG가 원본이고 PNG는 언제든 파생할 수 있다. 반대는 안 된다.**
그래서 PNG만 있는 것은 "가진 것"이 아니라 **"아직 벡터가 안 온 것"** 으로 취급한다.

| 상황 | 처리 |
|---|---|
| SVG 있음 | 그대로 서비스. `logo.png`는 SVG에서 생성 |
| PNG만 있는 **보유 브랜드** | 서비스는 하되 `svg-wanted.json`에 올린다 |
| PNG만 있는 **미보유 후보** | **서비스에 넣지 않는다.** `collect-wanted.json`에만 둔다 |
| 비트맵이 박힌 SVG (`<image`·`data:image/`) | **SVG로 치지 않는다.** `has_svg` 내리고 `sources/raster-wrapped/`로 옮긴 뒤 대기 목록에 올린다 |

진짜 벡터가 나중에 수집되면 — **약간 다른 버전이라도** — 그때 함께 서비스한다.

**대기 목록 두 개의 역할이 다르다:**
- `svg-wanted.json` — 우리가 **이미 가진** 브랜드인데 SVG가 없는 것 (PNG로 서비스 중)
- `collect-wanted.json` — 우리가 **아직 없는** 브랜드. 위키데이터 QID·Commons 파일명 포함

두 목록 모두 **실제 보유 상태와 일치해야 한다.** 어긋나면 다음 수집이 헛돈다
(2026-08-16에 svg-wanted 522건 중 83건이 이미 확보된 상태였다).

⚠️ `build-variants.py`는 `logo.png`가 **이미 있다고 전제**한다. SVG만 받아온
수집기는 `logo.png`를 따로 만들어야 한다 — 안 그러면 PNG 다운로드가 전부 404다
(2026-08-16 신규 231개에서 실제로 발생).

## 세모로고 별칭
"세모로고에서 찾아봐" → https://logo.vibers.co.kr/_clients/brands.json fetch 후 검색
"로고 CDN URL" → https://logo.vibers.co.kr/_clients/{brand-id}/logo.svg

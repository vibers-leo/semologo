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
- 로컬 빌드: Turbopack이 외장SSD 심링크를 처리 못 함 → git push 후 Vercel 자동 빌드
- 배포: git push origin main → Vercel GitHub 연동 자동 빌드

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

## CURRENT_VERSION (CDN 캐시 버스팅)
- BrandGrid.tsx, BrandModal.tsx 내 `VERSION` 상수: `1785636800`
- brands.json 또는 로고 파일 변경 시 함께 업데이트

## 세모로고 별칭
"세모로고에서 찾아봐" → https://logo.vibers.co.kr/_clients/brands.json fetch 후 검색
"로고 CDN URL" → https://logo.vibers.co.kr/_clients/{brand-id}/logo.svg

import type { NextConfig } from "next";

/**
 * NCP Docker 배포 — SSR + 부분 사전생성(ISR).
 *
 * 왜 정적 내보내기를 걷어냈나 (2026-08-18):
 *   브랜드 4.1만 개를 전부 굽으면 파일 20.5만 개 / 3.4GB 다.
 *   · GitHub Pages: 사이트 1GB 하드 리밋 — 유료 플랜으로도 안 올라간다
 *   · Cloudflare Pages: 배포당 파일 10만 개 — 9만 브랜드에서 다시 막힌다
 *   둘 다 '전부 미리 굽는' 구조 자체가 벽이었다. 서버에서 요청 시 만들면
 *   페이지 수 제한이 사라지고 빌드도 1~2분으로 고정된다.
 *
 * standalone: Docker 이미지에 필요한 것만 담는다 (조직 표준).
 */
const nextConfig: NextConfig = {
  output: "standalone",
  trailingSlash: true,
  images: {
    // 로고는 전부 외부 CDN(logo.vibers.co.kr) 이라 최적화를 태우지 않는다.
    unoptimized: true,
  },
};

export default nextConfig;

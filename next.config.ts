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
  async headers() {
    return [
      {
        // ⚠️ ISR 페이지에 Next.js 가 붙이는 기본값이
        //    `stale-while-revalidate=31536000`(1년) 이다.
        //    그래서 페이지를 고쳐 배포해도 **이미 방문한 사람은 1년간 옛 화면**을
        //    본다. 2026-08-30 에 홈페이지 버튼을 넣었는데 브라우저에 안 보였고,
        //    원인이 이것이었다(curl 로는 새 버전이 정상적으로 나왔다).
        //    카탈로그는 하루에도 여러 번 바뀌므로 1일이면 충분하다.
        source: "/brand/:id*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
          },
        ],
      },
      {
        // ⚠️ 2026-09-01: 위 규칙을 /brand 에만 걸고 **홈을 빠뜨려** 사이트가 깨졌다.
        //    홈 HTML 이 1년치 stale 로 CF 에 남았는데, 그 HTML 이 가리키는
        //    JS 청크는 새 배포에서 사라져 ChunkLoadError 가 났다.
        //    화면에는 서버 렌더한 60개만 뜨고 "목록을 준비하고 있어요" 에서 멈춘다.
        //
        //    **HTML 의 stale 은 배포 주기보다 길면 안 된다.** 청크 파일명이
        //    배포마다 바뀌기 때문이다. 정적 자산(_next/static)은 파일명에
        //    해시가 있어 그대로 immutable 이어도 안전하다 — 여기 대상이 아니다.
        source: "/((?!_next/static|_next/image).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=60, s-maxage=600, stale-while-revalidate=600",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

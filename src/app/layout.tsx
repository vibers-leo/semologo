import type { Metadata } from "next";
import Script from "next/script";
import { SearchProvider } from "@/lib/search-context";
import { CDN, VERSION } from "@/lib/cdn";
import Footer from "@/components/Footer";
import "./globals.css";
import ChunkRecovery from "@/components/ChunkRecovery";

const GA_ID = "G-NWML2V1S7V";
const SITE = process.env.NEXT_PUBLIC_APP_URL || "https://semologo.com";

/**
 * 브랜드 수를 빌드 시점에 실제 데이터에서 읽는다.
 * 예전엔 "6,061개"로 하드코딩돼 있었는데 수집할 때마다 어긋났다
 * (실제 6,824개). 설명·OG·트위터 3곳에 같은 숫자가 박혀 있었다.
 */
async function brandCount(): Promise<string> {
  try {
    // ⚠️ 예전엔 brands-slim.json(12.9MB)을 받아 **개수만 세고 버렸다.**
    //    레이아웃은 모든 페이지를 감싸므로 빌드 때 718번 받아 파싱했고,
    //    페이지당 60초를 넘겨 **배포가 실패했다.**
    //    거르는 조건은 CDN 쪽 build-category-peers.py 가 목록과 똑같이 맞춘다.
    const res = await fetch(`${CDN}/stats.json?v=${VERSION}`, { next: { revalidate: 3600 } });
    if (!res.ok) return "44,000여";
    const s = await res.json();
    const n = Number(s?.visible);
    return Number.isFinite(n) && n > 0 ? n.toLocaleString("ko-KR") : "44,000여";
  } catch {
    return "44,000여";
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const n = await brandCount();
  return {
    metadataBase: new URL(SITE),
    title: "세모로고 — 세상 모든 로고",
    description: `브랜드 로고를 SVG·PNG로 무료 다운로드. 현대·삼성·LG·SK·스타벅스 등 ${n}개 브랜드. 세상 모든 로고, 세모로고.`,
    keywords: ["로고", "브랜드로고", "SVG 로고", "PNG 로고", "로고 다운로드", "기업 로고", "무료 로고", "세모로고", "semologo", "로고창고"],
    alternates: { canonical: "/" },
    other: {
      "naver-site-verification": "f8377ea94a22905671d864f6c08c3e9ea3a1d368",
    },
    icons: {
      icon: "/favicon.ico",
      apple: "/apple-touch-icon.png",
    },
    manifest: "/manifest.webmanifest",
    openGraph: {
      title: "세모로고 — 세상 모든 로고",
      description: `현대·삼성·LG·SK 등 ${n}개 브랜드 로고를 SVG·PNG로 무료 다운로드`,
      siteName: "세모로고",
      url: SITE,
      type: "website",
      // 한국어 사이트임을 명시한다. 없으면 SNS·검색엔진이 언어를 추정해야 한다.
      locale: "ko_KR",
      images: [{ url: `${SITE}/og-cover.jpg`, width: 1200, height: 630, alt: `세모로고 — ${n}개 브랜드 로고 무료 다운로드` }],
    },
    twitter: {
      card: "summary_large_image",
      title: "세모로고 — 세상 모든 로고",
      description: `${n}개 브랜드 로고 SVG·PNG 무료 다운로드`,
      images: [`${SITE}/og-cover.jpg`],
    },
  };
}

/**
 * 구조화 데이터 (AEO/GEO).
 *
 * 왜 필요한가 —
 * 브랜드 상세 페이지에는 Organization·ImageObject 가 있는데 **홈에는 아무것도
 * 없었다**. AI 답변엔진(ChatGPT Search·Perplexity·Gemini)이 "세모로고가
 * 무엇인가"를 판단할 근거가 사이트 루트에 없다는 뜻이다.
 * WebSite(검색 동작 포함) + Organization + CollectionPage 를 넣는다.
 */
function siteJsonLd(count: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE}/#website`,
        url: SITE,
        name: "세모로고",
        alternateName: ["SemoLogo", "세상 모든 로고"],
        description: `브랜드 로고 ${count}개를 SVG·PNG 로 무료 다운로드하는 서비스.`,
        inLanguage: "ko",
        publisher: { "@id": `${SITE}/#org` },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${SITE}/?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "Organization",
        "@id": `${SITE}/#org`,
        name: "세모로고",
        alternateName: "SemoLogo",
        url: SITE,
        logo: `${SITE}/icon-512.png`,
        description:
          "세상 모든 로고. 국내외 브랜드의 공식 로고를 벡터(SVG)와 래스터(PNG)로 제공한다.",
      },
      {
        // 이 사이트의 본체가 '브랜드 로고 모음'임을 명시한다.
        // AI 가 인용할 때 무엇을 가진 사이트인지 바로 알 수 있게 한다.
        "@type": "CollectionPage",
        "@id": `${SITE}/#collection`,
        url: SITE,
        name: "브랜드 로고 모음",
        isPartOf: { "@id": `${SITE}/#website` },
        about: {
          "@type": "Thing",
          name: "브랜드 로고",
          description: "기업·기관·대학·병원의 CI/BI 로고 파일",
        },
        inLanguage: "ko",
      },
    ],
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const count = await brandCount();
  return (
    <html lang="ko">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd(count)) }}
        />
        {/* 광고 서버 선연결 — 슬롯 iframe 첫 요청의 TLS 핸드셰이크 선처리 */}
        <link rel="preconnect" href="https://ai.vibers.co.kr" />
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga-init" strategy="afterInteractive">
          {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}
        </Script>
      </head>
      <body className="min-h-screen flex flex-col">
        <ChunkRecovery /><SearchProvider><div className="flex-1">{children}</div><Footer /></SearchProvider></body>
    </html>
  );
}

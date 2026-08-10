import type { Metadata } from "next";
import Script from "next/script";
import { SearchProvider } from "@/lib/search-context";
import Footer from "@/components/Footer";
import "./globals.css";

const ADSENSE_ID = process.env.NEXT_PUBLIC_ADSENSE_ID || "ca-pub-7704550771011130";
const GA_ID = "G-NWML2V1S7V";
const SITE = process.env.NEXT_PUBLIC_APP_URL || "https://semologo.com";
const CDN = process.env.NEXT_PUBLIC_CDN_URL || "https://logo.vibers.co.kr/_clients";

/**
 * 브랜드 수를 빌드 시점에 실제 데이터에서 읽는다.
 * 예전엔 "6,061개"로 하드코딩돼 있었는데 수집할 때마다 어긋났다
 * (실제 6,824개). 설명·OG·트위터 3곳에 같은 숫자가 박혀 있었다.
 */
async function brandCount(): Promise<string> {
  try {
    const res = await fetch(`${CDN}/brands-slim.json`, { next: { revalidate: 3600 } });
    if (!res.ok) return "6,800여";
    const list = await res.json();
    const n = Array.isArray(list) ? list.filter((b) => !b?.variant_of).length : 0;
    return n > 0 ? n.toLocaleString("ko-KR") : "6,800여";
  } catch {
    return "6,800여";
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
      "google-adsense-account": ADSENSE_ID,
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
      images: [{ url: `${SITE}/og-image.png`, width: 1200, height: 630, alt: "세모로고" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "세모로고 — 세상 모든 로고",
      description: `${n}개 브랜드 로고 SVG·PNG 무료 다운로드`,
      images: [`${SITE}/og-image.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <head>
        {/* 광고 서버 선연결 — 슬롯 iframe 첫 요청의 TLS 핸드셰이크 선처리 */}
        <link rel="preconnect" href="https://ai.vibers.co.kr" />
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga-init" strategy="afterInteractive">
          {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}
        </Script>
        <Script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_ID}`}
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </head>
      <body className="min-h-screen flex flex-col"><SearchProvider><div className="flex-1">{children}</div><Footer /></SearchProvider></body>
    </html>
  );
}

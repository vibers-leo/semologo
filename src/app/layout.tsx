import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

const ADSENSE_ID = process.env.NEXT_PUBLIC_ADSENSE_ID || "ca-pub-7704550771011130";
const GA_ID = "G-NWML2V1S7V";

export const metadata: Metadata = {
  title: "세모로고 — 세상 모든 로고",
  description: "브랜드 로고를 SVG·PNG로 무료 다운로드. 현대·삼성·LG·SK·스타벅스 등 2,718개 브랜드. 세상 모든 로고, 세모로고.",
  keywords: ["로고", "브랜드로고", "SVG 로고", "PNG 로고", "로고 다운로드", "기업 로고", "무료 로고", "세모로고", "semologo", "로고창고"],
  other: {
    "naver-site-verification": "f8377ea94a22905671d864f6c08c3e9ea3a1d368",
    "google-adsense-account": ADSENSE_ID,
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "세모로고 — 세상 모든 로고",
    description: "현대·삼성·LG·SK 등 2,718개 브랜드 로고를 SVG·PNG로 무료 다운로드",
    siteName: "세모로고",
    url: "https://semologo.com",
    type: "website",
    images: [{ url: "https://semologo.com/og-image.png", width: 1200, height: 630, alt: "세모로고" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "세모로고 — 세상 모든 로고",
    description: "2,718개 브랜드 로고 SVG·PNG 무료 다운로드",
    images: ["https://semologo.com/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <head>
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
      <body className="min-h-screen">{children}</body>
    </html>
  );
}

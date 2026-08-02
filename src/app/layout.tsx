import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

const ADSENSE_ID = process.env.NEXT_PUBLIC_ADSENSE_ID || "ca-pub-7704550771011130";

export const metadata: Metadata = {
  title: "세모로고 — 세상 모든 로고",
  description: "브랜드 로고를 SVG·PNG로 무료 다운로드. 세상 모든 로고, 세모로고.",
  verification: {
    other: {
      "naver-site-verification": "f8377ea94a22905671d864f6c08c3e9ea3a1d368",
      "google-adsense-account": ADSENSE_ID,
    },
  },
  openGraph: {
    title: "세모로고",
    description: "브랜드 로고를 SVG·PNG로 무료 다운로드",
    siteName: "세모로고",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <head>
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

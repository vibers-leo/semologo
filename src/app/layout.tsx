import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "세모로고 — 세상 모든 로고",
  description: "브랜드 로고를 SVG·PNG로 무료 다운로드. 세상 모든 로고, 세모로고.",
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
      <body className="min-h-screen">{children}</body>
    </html>
  );
}

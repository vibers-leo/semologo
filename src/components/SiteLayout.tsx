import type { Metadata } from "next";
import Script from "next/script";
import { SearchProvider } from "@/lib/search-context";
import { fetchCatalogStats } from "@/lib/brands";
import { CATALOG_SNAPSHOT, siteCopy } from "@/lib/site-copy";
import Footer from "@/components/Footer";
import { CDN } from "@/lib/cdn";
import "@/app/globals.css";
import { LocaleProvider } from "@/lib/locale-context";
import type { Locale } from "@/lib/locales";
import ViewTracker from "@/components/ViewTracker";
import ChunkRecovery from "@/components/ChunkRecovery";

const GA_ID = "G-NWML2V1S7V";
const SITE = "https://semologo.com";

async function brandCount(): Promise<number> {
  const stats = await fetchCatalogStats();
  return stats?.visible && stats.visible > 0 ? stats.visible : CATALOG_SNAPSHOT.visible;
}

export async function siteMetadata(locale: Locale = "ko"): Promise<Metadata> {
  const n = await brandCount();
  const copy = siteCopy(locale, n);
  return {
    metadataBase: new URL(SITE),
    title: copy.title,
    description: copy.description,
    keywords: ["로고", "브랜드로고", "SVG 로고", "PNG 로고", "로고 다운로드", "기업 로고", "무료 로고", "세모로고", "semologo", "로고창고", "로고모음", "AI 로고 다운로드", "일러스트 로고"],
    alternates: { canonical: locale === "en" ? "/en/" : "/", languages: { ko: "/", en: "/en/", "x-default": "/" } },
    other: {
      "naver-site-verification": "f8377ea94a22905671d864f6c08c3e9ea3a1d368",
    },
    icons: {
      icon: "/favicon.ico",
      apple: "/apple-touch-icon.png",
    },
    manifest: "/manifest.webmanifest",
    openGraph: {
      title: copy.title,
      description: copy.description,
      siteName: "세모로고",
      url: locale === "en" ? `${SITE}/en` : SITE,
      type: "website",
      // 한국어 사이트임을 명시한다. 없으면 SNS·검색엔진이 언어를 추정해야 한다.
      locale: locale === "en" ? "en_US" : "ko_KR",
      images: [{ url: copy.ogImage, width: 1200, height: 630, alt: copy.ogAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title: copy.title,
      description: copy.description,
      images: [copy.ogImage],
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
function siteJsonLd(count: number) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE}/#website`,
        url: SITE,
        name: "세모로고",
        alternateName: ["SemoLogo", "세상 모든 로고"],
        description: siteCopy("ko", count).description,
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
          siteCopy("ko", count).description,
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
  children, locale = "ko",
}: Readonly<{ children: React.ReactNode; locale?: Locale }>) {
  const count = await brandCount();
  return (
    <html lang={locale}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(locale === "en" ? {"@context": "https://schema.org", "@type": "WebSite", name: "SemoLogo", url: `${SITE}/en`, inLanguage: "en", description: siteCopy("en", count).description, potentialAction: {"@type": "SearchAction", target: `${SITE}/en?q={search_term_string}`, "query-input": "required name=search_term_string"}} : siteJsonLd(count)) }}
        />
        {/* 광고 서버 선연결 — 슬롯 iframe 첫 요청의 TLS 핸드셰이크 선처리 */}
        <link rel="preconnect" href="https://ai.vibers.co.kr" />
        <link rel="preconnect" href={new URL(CDN).origin} crossOrigin="anonymous" />
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga-init" strategy="afterInteractive">
          {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}
        </Script>
        {/* 애드센스 — 게시자 ID 는 public/ads.txt 와 같아야 한다. 심사 중에는
            자동광고가 안 나와도 스크립트와 ads.txt 가 있어야 크롤러가 '준비됨'으로 본다 */}
        {process.env.NEXT_PUBLIC_AD_PREVIEW_MODE !== "1" && <Script
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7704550771011130"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />}
      </head>
      <body className="min-h-screen flex flex-col">
        <ChunkRecovery /><ViewTracker /><LocaleProvider locale={locale}><SearchProvider><div className="flex-1">{children}</div><Footer /></SearchProvider></LocaleProvider></body>
    </html>
  );
}

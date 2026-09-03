import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchBrand, fetchBrandsSlim, fetchCategoryPeers } from "@/lib/brands";
import { CDN } from "@/lib/cdn";
import Header from "@/components/Header";
import BrandDetailClient from "./BrandDetailClient";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://semologo.com";

// 하루 한 번 다시 만든다. CDN 의 brands.json 이 갱신되면 그때 반영된다.
export const revalidate = 86400;

// 빌드에 굽는 페이지 수. 나머지는 첫 요청 때 만들어 캐시한다.
// 전부 굽지 않는 이유 — 4.1만 장이면 빌드가 25~30분으로 늘고 이미지도
// 3.4GB 가 된다. 최근 추가분만 미리 구워 새 브랜드가 첫 방문자에게도
// 즉시 뜨게 하고, 나머지는 요청 시 만든다.
// ⚠️ 2026-09-01: 1500 에서 빌드가 죽었다. brands-slim 이 12.4MB 로 커져
//    Next 데이터 캐시(2MB)를 넘고, 워커 3개가 각자 파싱하면서 힙이 터진다.
//    (서버 여유 6.8GB · 워커당 4GB 상한)
//    캐시 헤더를 짧게 잡은 뒤로는 온디맨드 렌더도 금방 최신이 되므로
//    미리 굽는 수를 줄이는 편이 안전하다. 브랜드가 더 늘면 또 낮춘다.
const PRERENDER = 700;

export async function generateStaticParams() {
  const brands = await fetchBrandsSlim();
  return brands
    .filter((b) => !b.variant_of && !b.hidden)
    .sort((a, b) => (b.added_at ?? "").localeCompare(a.added_at ?? ""))
    .slice(0, PRERENDER)
    .map((b) => ({ id: b.id }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const brand = await fetchBrand(id);
  if (!brand) return {};

  const logoUrl = brand.logo_svg
    ? `${CDN}/${brand.id}/logo.svg`
    : `${CDN}/${brand.id}/logo-800.png`;

  // hidden 은 로고답지 않은 이미지다. 페이지는 살려 두되(이미 색인된 URL 을
  // 404 로 만들면 SEO 만 잃는다) 새로 색인되지는 않게 한다.
  const noindex = brand.hidden === true;

  const title = `${brand.name_ko} 로고 SVG·PNG 무료 다운로드 | 세모로고`;
  const description = `${brand.name_ko}(${brand.name_en}) 공식 로고를 SVG 벡터·PNG 고해상도로 무료 다운로드하세요. ${brand.category} 브랜드.`;

  return {
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: `${BASE}/brand/${brand.id}`,
      images: [{ url: logoUrl, width: 800, height: 800, alt: `${brand.name_ko} 로고` }],
      siteName: "세모로고",
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: [logoUrl],
    },
    // 부모 브랜드로 흡수된 중복 항목(예: adobe-icon)은 페이지를 살려두되
    // canonical 을 부모로 돌린다. 삭제하면 429개가 404 가 되고, 그대로 두면
    // 검색엔진에 중복 콘텐츠로 잡힌다.
    alternates: {
      canonical: brand.variant_of
        ? `${BASE}/brand/${brand.variant_of}`
        : `${BASE}/brand/${brand.id}`,
    },
  };
}

export default async function BrandPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const brand = await fetchBrand(id);
  if (!brand) notFound();
  // 연관 브랜드는 같은 카테고리 12개뿐이다. 전체 목록(12.9MB)을 받으면
  // 빌드 워커마다 그걸 파싱해 힙이 터진다 — 실제로 배포가 실패했다.
  const peers = await fetchCategoryPeers(brand.category || "기타");

  const logoUrl = brand.logo_svg
    ? `${CDN}/${brand.id}/logo.svg`
    : `${CDN}/${brand.id}/logo-800.png`;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: brand.name_ko,
      alternateName: brand.name_en,
      logo: logoUrl,
      ...(brand.domain ? { url: `https://${brand.domain}` } : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "ImageObject",
      name: `${brand.name_ko} 로고`,
      contentUrl: logoUrl,
      encodingFormat: brand.logo_svg ? "image/svg+xml" : "image/png",
      about: {
        "@type": "Organization",
        name: brand.name_ko,
        alternateName: brand.name_en,
      },
    },
  ];

  const relatedBrands = peers.filter((b) => b.id !== brand.id).slice(0, 12);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="min-h-screen" style={{ background: "var(--bg)" }}>
        <Header />
        <BrandDetailClient brand={brand} relatedBrands={relatedBrands} />
      </div>
    </>
  );
}

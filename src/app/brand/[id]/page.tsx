import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchBrands, getBrandMap } from "@/lib/brands";
import { CDN } from "@/lib/cdn";
import Header from "@/components/Header";
import BrandDetailClient from "./BrandDetailClient";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://semologo.com";

export async function generateStaticParams() {
  const brands = await fetchBrands();
  return brands.map((b) => ({ id: b.id }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const brand = (await getBrandMap()).get(id);
  if (!brand) return {};

  const logoUrl = brand.logo_svg
    ? `${CDN}/${brand.id}/logo.svg`
    : `${CDN}/${brand.id}/logo-800.png`;

  const title = `${brand.name_ko} 로고 SVG·PNG 무료 다운로드 | 세모로고`;
  const description = `${brand.name_ko}(${brand.name_en}) 공식 로고를 SVG 벡터·PNG 고해상도로 무료 다운로드하세요. ${brand.category} 브랜드.`;

  return {
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
  const brands = await fetchBrands();
  const brand = (await getBrandMap()).get(id);
  if (!brand) notFound();

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

  const relatedBrands = brands
    .filter((b) => b.category === brand.category && b.id !== brand.id)
    .slice(0, 12);

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

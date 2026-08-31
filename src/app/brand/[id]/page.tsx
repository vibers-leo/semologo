import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchBrand, fetchBrandsSlim } from "@/lib/brands";
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
const PRERENDER = 1500;

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
  // 연관 브랜드는 id·이름·카테고리만 쓰므로 경량판이면 충분하다.
  const brands = await fetchBrandsSlim();

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

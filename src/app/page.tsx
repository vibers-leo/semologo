import dynamic from "next/dynamic";
import { fetchBrands } from "@/lib/brands";
import Header from "@/components/Header";
import BrandGrid from "@/components/BrandGrid";

const AdSlot = dynamic(() => import("@/components/AdSlot"), { ssr: false });

export const revalidate = 3600;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string }>;
}) {
  const { q, cat } = await searchParams;
  const brands = await fetchBrands();

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <Header />
      {/* 헤더 하단 배너 광고 */}
      <div className="max-w-[1280px] mx-auto px-4 pt-3">
        <AdSlot slot="5391847260" format="horizontal" style={{ minHeight: "90px" }} />
      </div>
      <main className="max-w-[1280px] mx-auto px-4 pb-20">
        <BrandGrid brands={brands} query={q} category={cat} />
      </main>
    </div>
  );
}

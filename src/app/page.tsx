import { fetchBrands } from "@/lib/brands";
import Header from "@/components/Header";
import BrandGrid from "@/components/BrandGrid";

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
      <main className="max-w-[1280px] mx-auto px-4 pb-20">
        <BrandGrid brands={brands} query={q} category={cat} />
      </main>
    </div>
  );
}

import { fetchBrands } from "@/lib/brands";
import Header from "@/components/Header";
import BrandGrid from "@/components/BrandGrid";
import AdSlot from "@/components/AdSlot";

export const dynamic = "force-static";

export default async function Home() {
  const brands = await fetchBrands();

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <Header />
      <div className="max-w-[1280px] mx-auto px-4 pt-3">
        <AdSlot slot="5391847260" format="horizontal" style={{ minHeight: "90px" }} />
      </div>
      <main className="max-w-[1280px] mx-auto px-4 pb-20">
        <BrandGrid brands={brands} />
      </main>
    </div>
  );
}

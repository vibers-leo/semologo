import Header from "@/components/Header";
import BrandGrid from "@/components/BrandGrid";
import VibersAdSlot from "@/components/VibersAdSlot";

export const dynamic = "force-static";

export default function Home() {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <Header />
      {/* 헤더 하단·본문 상단 — Vibers 광고 서버(디어스 캠페인) */}
      <div className="max-w-[1280px] mx-auto px-4 pt-3">
        <VibersAdSlot slot="home_top" />
      </div>
      <main className="max-w-[1280px] mx-auto px-4 pb-20">
        <BrandGrid />
      </main>
    </div>
  );
}

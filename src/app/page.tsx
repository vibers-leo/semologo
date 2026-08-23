import Header from "@/components/Header";
import { fetchBrandsSlim, sortForGrid, type Brand } from "@/lib/brands";
import BrandGrid from "@/components/BrandGrid";
import VibersAdSlot from "@/components/VibersAdSlot";

export const dynamic = "force-static";

/** 첫 화면에 미리 그려 둘 카드 수. 클라이언트가 목록 JSON(1.15MB)을 받아
 *  파싱하기 전까지 그리드가 비어 있던 것을 없앤다(실측 1,000ms → 즉시). */
const FIRST_PAGE = 60;

async function firstPage(): Promise<Brand[]> {
  try {
    // CDN 장애 시 GitHub 원본으로 폴백하는 공통 경로를 반드시 거친다.
    // 첫 화면만 직접 CDN을 호출하면, 브라우저 전체 목록 폴백이 있어도 처음에
    // 빈 그리드가 보이는 단일 장애점이 된다.
    return sortForGrid(await fetchBrandsSlim()).slice(0, FIRST_PAGE);
  } catch {
    return [];      // 실패해도 클라이언트가 받아온다 — 화면이 비지 않는다
  }
}

export default async function Home() {
  const initialBrands = await firstPage();
  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <Header />
      {/* 헤더 하단·본문 상단 — Vibers 광고 서버(디어스 캠페인) */}
      <div className="max-w-[1280px] mx-auto px-4 pt-3">
        <VibersAdSlot slot="home_top" />
      </div>
      <main className="max-w-[1280px] mx-auto px-4 pb-20">
        <BrandGrid initialBrands={initialBrands} />
      </main>
    </div>
  );
}

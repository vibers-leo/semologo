import Header from "@/components/Header";
import { CDN, sortForGrid, type Brand } from "@/lib/brands";
import { VERSION } from "@/lib/cdn";
import BrandGrid from "@/components/BrandGrid";
import VibersAdSlot from "@/components/VibersAdSlot";

export const dynamic = "force-static";

/** 첫 화면에 미리 그려 둘 카드 수. 클라이언트가 목록 JSON(1.15MB)을 받아
 *  파싱하기 전까지 그리드가 비어 있던 것을 없앤다(실측 1,000ms → 즉시). */
const FIRST_PAGE = 60;

async function firstPage(): Promise<Brand[]> {
  try {
    // 캐시를 타면 안 된다. 빌드가 옛 스냅샷을 집어 **서버가 그린 첫 화면과
    // 클라이언트가 받은 목록이 달라졌다** — 로드 직후 카드가 통째로 갈아끼워졌다
    // (2026-08-17: 서버는 투자사, 클라이언트는 공공기관을 먼저 보여줬다).
    const res = await fetch(`${CDN}/brands-slim.json?v=${VERSION}&b=${Date.now()}`,
                            { cache: "no-store" });
    if (!res.ok) return [];
    const raw = await res.json();
    const list: Brand[] = Array.isArray(raw) ? raw : raw?.brands ?? [];
    const sorted = sortForGrid(list);
    // 빌드가 실제로 무엇을 받았는지 남긴다 — 서버·클라이언트 첫 화면이 어긋났을 때
    // 데이터 문제인지 정렬 문제인지 로그 없이는 가릴 수 없다.
    console.log(`[firstPage] 총 ${list.length} | 배열끝 ${list.at(-1)?.id} | ` +
                `정렬첫3 ${sorted.slice(0, 3).map((b) => b.id).join(",")}`);
    return sorted.slice(0, FIRST_PAGE);
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

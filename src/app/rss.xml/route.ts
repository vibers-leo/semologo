import { fetchBrandsSlim, type Brand } from "@/lib/brands";

/**
 * 신규 등록 브랜드 RSS.
 *
 * 왜 필요한가 —
 * 네이버 서치어드바이저는 사이트맵과 **별도로** RSS 제출을 받는다. 사이트맵은
 * 4만 개 전체 목록이라 "무엇이 새로 생겼는지"를 알려주지 못한다. RSS 는 최근
 * 추가분만 담아 신규 페이지가 빨리 수집되게 한다.
 *
 * 캐시는 1시간. 브랜드는 하루 몇 번 늘어나므로 그보다 촘촘할 이유가 없다.
 */
export const revalidate = 3600;

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://semologo.com";
const MAX = 200;

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET() {
  let brands: Brand[] = [];
  let failed = false;
  try {
    brands = await fetchBrandsSlim();
  } catch (e) {
    // ⚠️ 빈 피드를 조용히 내보내지 않는다. 그러면 네이버가 "신규 없음"으로
    //    읽고 우리는 원인을 모른다. 로그에 남기고 503 으로 답한다.
    failed = true;
    console.error("[rss] brands-slim 조회 실패", e);
  }
  if (failed) {
    return new Response("brands feed unavailable", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const items = brands
    .filter((b) => !b.variant_of && b.added_at)
    .sort((a, b) => String(b.added_at).localeCompare(String(a.added_at)))
    .slice(0, MAX);

  const now = new Date().toUTCString();
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>세모로고 — 새로 등록된 브랜드 로고</title>
<link>${BASE}</link>
<atom:link href="${BASE}/rss.xml" rel="self" type="application/rss+xml"/>
<description>세상 모든 로고. SVG·PNG 무료 다운로드.</description>
<language>ko</language>
<lastBuildDate>${now}</lastBuildDate>
${items
  .map((b) => {
    const name = b.name_ko || b.name_en || b.id;
    const url = `${BASE}/brand/${b.id}/`;
    const date = b.added_at ? new Date(b.added_at).toUTCString() : now;
    return `<item>
<title>${esc(name)} 로고</title>
<link>${url}</link>
<guid isPermaLink="true">${url}</guid>
<pubDate>${date}</pubDate>
<category>${esc(b.category || "기타")}</category>
<description>${esc(name)} 로고를 SVG·PNG 로 무료 다운로드하세요.</description>
</item>`;
  })
  .join("\n")}
</channel>
</rss>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}

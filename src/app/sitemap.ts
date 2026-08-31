import type { MetadataRoute } from "next";
import { fetchBrandsSlim } from "@/lib/brands";

export const dynamic = "force-static";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://semo.vibers.co.kr";

  // ⚠️ 예전엔 `catch { brands = [] }` 였다. CDN 이 잠깐 죽으면 사이트맵이
  //    **URL 1개짜리로 쪼그라든 채 정상 200 으로 나가고**, 검색엔진은 그걸
  //    "페이지가 사라졌다"로 읽는다. 그런데 아무 로그도 안 남아 알 수가 없다.
  //    실패는 실패로 남기고, 빌드가 중단되도록 다시 던진다.
  let brands: Awaited<ReturnType<typeof fetchBrandsSlim>> = [];
  try {
    brands = await fetchBrandsSlim();
  } catch (e) {
    console.error("[sitemap] brands-slim 조회 실패 — 사이트맵을 만들 수 없다", e);
    throw e;
  }
  if (!Array.isArray(brands) || brands.length < 1000) {
    // 4만 개짜리 카탈로그가 갑자기 1천 개 미만이면 정상이 아니다.
    // 그대로 내보내면 색인에서 대량 삭제로 읽힌다.
    throw new Error(`[sitemap] 브랜드 수가 비정상: ${Array.isArray(brands) ? brands.length : "배열아님"}`);
  }

  // 부모로 흡수된 중복 항목(variant_of)은 사이트맵에서 뺀다 — canonical 이
  // 부모를 가리키므로 색인 대상으로 올릴 이유가 없다.
  // hidden(로고답지 않은 이미지)도 뺀다. 색인돼 봐야 방문자가 실망하고
  // 사이트 전체의 품질 평가만 떨어진다.
  const brandUrls = Array.isArray(brands)
    ? brands.filter((b) => !b.variant_of && !b.hidden).map((b) => ({
        url: `${base}/brand/${b.id}`,
        lastModified: b.added_at ? new Date(b.added_at) : new Date(),
        changeFrequency: "monthly" as const,
        priority: 0.7,
      }))
    : [];

  return [
    { url: base, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    ...brandUrls,
  ];
}

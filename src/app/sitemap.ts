import { languageAlternates, localePath, type Locale } from "@/lib/locales";
import type { MetadataRoute } from "next";
import { BLOG_POSTS } from "@/lib/blog";

export const dynamic = "force-static";

export async function buildSitemap(locale: Locale = "ko"): Promise<MetadataRoute.Sitemap> {
  const base = "https://semologo.com";
  // 브랜드 상세 URL은 /sitemap-index.xml 아래 2만 URL 단위 분할 파일에 싣는다.
  // 레거시 /sitemap.xml 은 핵심 페이지 전용으로 유지해 18만 URL 전체가 빌드 중
  // 거대한 정적 XML로 만들어지는 일을 막는다.
  return [
    { url: base + localePath("/", locale), alternates: {languages: languageAlternates("/")}, changeFrequency: "daily", priority: 1 },
    ...["/logo-collection", "/ai-logo-download", "/faq", "/blog", ...BLOG_POSTS.map(post => `/blog/${post.slug}`)].map(path => ({url: base + localePath(path, locale), alternates: {languages: languageAlternates(path)}, priority: 0.8})),
  ];
}

export default function sitemap() {return buildSitemap("ko");}

"use client";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/locale-context";
import { localePath } from "@/lib/locales";
import { trackEvent } from "@/lib/analytics";
import { useSearch } from "@/lib/search-context";
export default function LanguageSwitch() {
  const pathname = usePathname();
  const {locale} = useLocale();
  const {query} = useSearch();
  const next = locale === "ko" ? "en" : "ko";
  // Support pages still in Korean go to the translated catalog; brand URLs retain their identity.
  const normalized = pathname.replace(/\/$/, "") || "/";
  const supported = /^\/(?:en\/?|brand\/[^/]+|faq|favorites|logo-collection|ai-logo-download|login|submit|request|mypage|terms|privacy)?$/.test(normalized.replace(/^\/en(?=\/)/, ""));
  const href = localePath(supported ? pathname : "/", next);
  return <a href={href} lang={next} hrefLang={next} aria-label={next === "en" ? "Switch to English" : "한국어로 전환"}
    className="shrink-0 rounded-full border px-2.5 py-1.5 text-xs font-semibold"
    onClick={e => { e.preventDefault(); try {localStorage.setItem("semologo.locale", next);} catch {} trackEvent("locale_changed", {locale: next}); const url = new URL(href, location.origin); if(query) url.searchParams.set("q", query); location.assign(url.href); }}>
    {next === "en" ? "EN" : "한국어"}
  </a>;
}

export const locales = ["ko", "en"] as const;
export type Locale = (typeof locales)[number];
export const SITE_URL = "https://semologo.com";
/** Match Next trailingSlash:true, including file and .well-known exceptions. */
export function canonicalPath(path: string): string {
  const match = /^([^?#]*)(.*)$/.exec(path)!;
  const pathname = match[1] || "/";
  const suffix = match[2];
  const bare = pathname.replace(/\/+$/, "") || "/";
  if (bare === "/" || /\/[^/]+\.[^/]+$/.test(bare) || bare.startsWith("/.well-known/")) return bare + suffix;
  return bare + "/" + suffix;
}
export function localePath(path: string, locale: Locale) {
  const [, pathname, suffix] = /^([^?#]*)(.*)$/.exec(path)!;
  const bare = pathname.replace(/^\/en(?=\/|$)/, "") || "/";
  return canonicalPath((locale === "en" ? `/en${bare === "/" ? "" : bare}` : bare) + suffix);
}
export function languageAlternates(path: string) {
  return { ko: SITE_URL + localePath(path, "ko"), en: SITE_URL + localePath(path, "en"), "x-default": SITE_URL + localePath(path, "ko") };
}

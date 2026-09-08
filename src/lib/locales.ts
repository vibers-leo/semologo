export const locales = ["ko", "en"] as const;
export type Locale = (typeof locales)[number];
export const SITE_URL = "https://semologo.com";
export function localePath(path: string, locale: Locale) {
  const bare = path.replace(/^\/en(?=\/|$)/, "") || "/";
  return locale === "en" ? `/en${bare === "/" ? "" : bare}` : bare;
}
export function languageAlternates(path: string) {
  return { ko: SITE_URL + localePath(path, "ko"), en: SITE_URL + localePath(path, "en"), "x-default": SITE_URL + localePath(path, "ko") };
}

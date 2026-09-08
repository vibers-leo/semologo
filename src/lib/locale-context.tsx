"use client";
import { createContext, useContext } from "react";
import { localePath, type Locale } from "./locales";
import { english } from "./translations/en";
const Context = createContext<Locale>("ko");
export function LocaleProvider({locale, children}: {locale: Locale; children: React.ReactNode}) {
  return <Context.Provider value={locale}>{children}</Context.Provider>;
}
export function useLocale() {
  const locale = useContext(Context);
  return {locale, en: locale === "en", t: (text: string) => locale === "en" ? english[text] ?? text.split(" · ").map(part => english[part] ?? part).join(" · ") : text, path: (p: string) => localePath(p, locale)};
}
export function T({children}: {children: string}) { const {t} = useLocale(); return <>{t(children)}</>; }

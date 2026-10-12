"use client";
import Link from "next/link";
import { siteCopy } from "@/lib/site-copy";
import { useLocale } from "@/lib/locale-context";
export default function CatalogIntro() {
  const {en, path} = useLocale();
  const copy = siteCopy(en ? "en" : "ko");
  return <section className="pt-5"><h1 className="text-lg font-bold">{copy.intro}</h1><p className="mt-1 text-sm text-gray-500">{copy.introDescription}</p><div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500"><Link className="underline" href={path("/logo-collection")}>{en ? "Logo collection" : "브랜드 로고 모음"}</Link><Link className="underline" href={path("/ai-logo-download")}>{en ? "Using logos in Illustrator" : "AI·SVG 다운로드 안내"}</Link></div></section>;
}

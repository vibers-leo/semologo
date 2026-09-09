"use client";
import Link from "next/link";
import { useLocale } from "@/lib/locale-context";
export default function CatalogIntro() {
  const {en, path} = useLocale();
  return <section className="pt-5"><h1 className="text-lg font-bold">{en ? "Brand logos, ready for your next project" : "필요한 브랜드 로고, 한곳에서 찾아보세요"}</h1><p className="mt-1 text-sm text-gray-500">{en ? "Download available SVG & PNG files, with Illustrator guidance." : "SVG·PNG로 내려받고, Illustrator에서 사용하는 방법도 확인해 보세요."}</p><div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500"><Link className="underline" href={path("/logo-collection")}>{en ? "Logo collection" : "브랜드 로고 모음"}</Link><Link className="underline" href={path("/ai-logo-download")}>{en ? "Using logos in Illustrator" : "AI·SVG 다운로드 안내"}</Link></div></section>;
}

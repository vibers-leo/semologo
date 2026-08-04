"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Brand } from "@/lib/brands";

const CDN = process.env.NEXT_PUBLIC_CDN_URL || "https://logo.vibers.co.kr/_clients";
const VERSION = "1785636800";

const CHECKER: React.CSSProperties = {
  backgroundColor: "#f8f8f8",
  backgroundImage: `
    linear-gradient(rgba(0,0,0,0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px)
  `,
  backgroundSize: "12px 12px",
};

interface DownloadVariant {
  file: string;
  label: string;
  desc: string;
  checker?: boolean;
  svgOnly?: boolean;
  langEn?: boolean;
}

const VARIANTS: DownloadVariant[] = [
  { file: "logo.svg",             label: "SVG 벡터",       desc: "확대해도 깨짐 없음",        svgOnly: true  },
  { file: "logo-800.png",         label: "PNG 800px",      desc: "고해상도 래스터"                              },
  { file: "logo-transparent.png", label: "투명 배경 PNG",  desc: "배경 제거",                 checker: true  },
  { file: "logo-icon.png",        label: "아이콘",          desc: "파비콘·앱 아이콘용 64px",  checker: true  },
  { file: "logo-en.svg",          label: "영문 SVG",        desc: "영문 벡터",                 svgOnly: true, langEn: true },
  { file: "logo.png",             label: "PNG 원본",        desc: "기본 PNG"                                    },
];

async function downloadFile(url: string, filename: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

interface Props {
  brand: Brand;
  relatedBrands: Brand[];
}

export default function BrandDetailClient({ brand, relatedBrands }: Props) {
  const [downloading, setDownloading] = useState<string | null>(null);

  const variants = VARIANTS.filter((v) => {
    if (v.svgOnly && !brand.logo_svg) return false;
    if (v.langEn && !brand.lang_en) return false;
    return true;
  });

  const mainLogoUrl = brand.logo_svg
    ? `${CDN}/${brand.id}/logo.svg?v=${VERSION}`
    : `${CDN}/${brand.id}/logo-800.png?v=${VERSION}`;

  async function handleDownload(variant: DownloadVariant) {
    const url = `${CDN}/${brand.id}/${variant.file}?v=${VERSION}`;
    setDownloading(variant.file);
    try {
      await downloadFile(url, `${brand.id}-${variant.file}`);
    } catch {
      window.open(url, "_blank");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      {/* 뒤로가기 */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm mb-6"
        style={{ color: "var(--text-secondary)" }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="m15 18-6-6 6-6" />
        </svg>
        세모로고 홈
      </Link>

      <div className="grid md:grid-cols-2 gap-8">
        {/* 로고 프리뷰 */}
        <div
          className="rounded-2xl flex items-center justify-center p-10"
          style={{ background: "white", border: "1px solid var(--border)", minHeight: 280 }}
        >
          <Image
            src={mainLogoUrl}
            alt={`${brand.name_ko} 로고`}
            width={240}
            height={240}
            className="object-contain max-h-56 w-auto"
            unoptimized
          />
        </div>

        {/* 브랜드 정보 + 다운로드 */}
        <div className="flex flex-col justify-center gap-5">
          <div>
            <span
              className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full mb-3"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            >
              {brand.category}
            </span>
            <h1 className="text-3xl font-black tracking-tight mb-1" style={{ color: "var(--text)" }}>
              {brand.name_ko}
            </h1>
            <p className="text-base" style={{ color: "var(--text-secondary)" }}>
              {brand.name_en}
            </p>
          </div>

          {/* 다운로드 버튼 목록 */}
          <div className="flex flex-col gap-2">
            {variants.map((v) => (
              <button
                key={v.file}
                onClick={() => handleDownload(v)}
                disabled={downloading === v.file}
                className="flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  cursor: downloading === v.file ? "wait" : "pointer",
                }}
              >
                <div>
                  <span className="text-sm font-bold" style={{ color: "var(--text)" }}>{v.label}</span>
                  <span className="text-xs ml-2" style={{ color: "var(--text-secondary)" }}>{v.desc}</span>
                </div>
                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5"
                  style={{ color: "var(--text-secondary)", opacity: downloading === v.file ? 0.4 : 1 }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 관련 브랜드 */}
      {relatedBrands.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-black mb-4" style={{ color: "var(--text)" }}>
            같은 카테고리 브랜드
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {relatedBrands.map((b) => {
              const url = b.logo_svg
                ? `${CDN}/${b.id}/logo.svg?v=${VERSION}`
                : `${CDN}/${b.id}/logo-800.png?v=${VERSION}`;
              return (
                <Link
                  key={b.id}
                  href={`/brand/${b.id}`}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <div
                    className="w-full aspect-square rounded-lg flex items-center justify-center p-2"
                    style={{ background: "white" }}
                  >
                    <Image
                      src={url}
                      alt={b.name_ko}
                      width={64}
                      height={64}
                      className="object-contain max-h-12 w-auto"
                      unoptimized
                    />
                  </div>
                  <span className="text-xs font-semibold text-center truncate w-full" style={{ color: "var(--text)" }}>
                    {b.name_ko}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}

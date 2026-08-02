"use client";

import { useEffect } from "react";
import { Brand } from "@/lib/brands";

const CDN = process.env.NEXT_PUBLIC_CDN_URL || "https://logo.vibers.co.kr/_clients";
const VERSION = "1785636800";

interface Props {
  brand: Brand;
  onClose: () => void;
}

interface DownloadItem {
  file: string;
  label: string;
  desc: string;
  show: boolean;
}

export default function BrandModal({ brand, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const svgUrl = `${CDN}/${brand.id}/logo.svg?v=${VERSION}`;
  const pngUrl = `${CDN}/${brand.id}/logo.png?v=${VERSION}`;
  const darkUrl = `${CDN}/${brand.id}/logo-transparent.png?v=${VERSION}`;
  const lightSrc = brand.logo_svg ? svgUrl : pngUrl;

  const items: DownloadItem[] = [
    { file: "logo.svg", label: "SVG 벡터 (한글)", desc: "확대해도 깨짐 없음", show: !!brand.logo_svg },
    { file: "logo-en.svg", label: "SVG 벡터 (영문)", desc: "영문 벡터", show: !!(brand.logo_svg && brand.lang_en) },
    { file: "logo-800.png", label: "PNG 800px", desc: "고해상도 래스터", show: true },
    { file: "logo-transparent.png", label: "투명 배경 PNG", desc: "배경 제거", show: true },
    { file: "logo.png", label: "PNG 원본 (한글)", desc: "기본 PNG", show: true },
    { file: "logo-en.png", label: "PNG 원본 (영문)", desc: "영문 PNG", show: !!brand.lang_en },
    { file: "logo-icon.png", label: "아이콘 (64px)", desc: "파비콘·앱 아이콘용", show: true },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
      style={{ background: "rgba(0,0,0,0.5)" }}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{ background: "#fff", maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b" style={{ borderColor: "#f0f0f0" }}>
          <div>
            <h2 className="text-lg font-bold">{brand.name_ko}</h2>
            <p className="text-sm mt-0.5" style={{ color: "#999" }}>
              {brand.name_en} · {brand.category}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors ml-4 mt-0.5">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Dual preview: light + dark */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", height: "200px" }}>
          {/* Light */}
          <div
            style={{
              background: "#ffffff",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px",
              borderRight: "1px solid #f0f0f0",
              position: "relative",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightSrc}
              alt={brand.name_ko}
              onError={(e) => { e.currentTarget.src = pngUrl; }}
              style={{ maxWidth: "90%", maxHeight: "130px", objectFit: "contain" }}
            />
            <span style={{ position: "absolute", bottom: 8, left: 10, fontSize: 10, color: "rgba(0,0,0,0.25)", letterSpacing: "0.3px" }}>
              라이트
            </span>
          </div>
          {/* Dark */}
          <div
            style={{
              background: "#111114",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px",
              position: "relative",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={darkUrl}
              alt={brand.name_ko}
              onError={(e) => {
                const t = e.currentTarget;
                t.src = brand.logo_svg ? svgUrl : pngUrl;
              }}
              style={{ maxWidth: "90%", maxHeight: "130px", objectFit: "contain" }}
            />
            <span style={{ position: "absolute", bottom: 8, left: 10, fontSize: 10, color: "rgba(255,255,255,0.25)", letterSpacing: "0.3px" }}>
              다크
            </span>
          </div>
        </div>

        {/* Download list */}
        <div className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#999" }}>
            다운로드
          </p>
          <div className="flex flex-col gap-2">
            {items.filter((i) => i.show).map((item) => (
              <a
                key={item.file}
                href={`${CDN}/${brand.id}/${item.file}?v=${VERSION}`}
                download={`${brand.id}-${item.file}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-4 py-3 rounded-xl transition-colors hover:bg-gray-50"
                style={{ border: "1px solid #ebebeb" }}
              >
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs" style={{ color: "#999" }}>{item.desc}</p>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "#bbb", flexShrink: 0 }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" x2="12" y1="15" y2="3" />
                </svg>
              </a>
            ))}
          </div>
        </div>

        {brand.sources && brand.sources.length > 0 && (
          <div className="px-5 pb-5">
            <p className="text-xs" style={{ color: "#bbb" }}>
              출처: {brand.sources.join(", ")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

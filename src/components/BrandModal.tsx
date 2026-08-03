"use client";

import { useEffect } from "react";
import { Brand } from "@/lib/brands";

const CDN = process.env.NEXT_PUBLIC_CDN_URL || "https://logo.vibers.co.kr/_clients";
const VERSION = "1785636800";

interface Props {
  brand: Brand;
  onClose: () => void;
}

const VARIANTS = [
  { file: "logo.svg",           name: "SVG 벡터",       desc: "확대해도 깨짐 없음",      bg: "bg-white", svgOnly: true,  langEn: false },
  { file: "logo-en.svg",        name: "영문 SVG",        desc: "영문 벡터",                bg: "bg-white", svgOnly: true,  langEn: true  },
  { file: "logo-800.png",       name: "PNG 800px",       desc: "고해상도 래스터",          bg: "bg-white", svgOnly: false, langEn: false },
  { file: "logo-icon.png",      name: "파비콘 / 아이콘", desc: "64px · 파비콘·앱 아이콘용", bg: "bg-checker",svgOnly: false, langEn: false },
  { file: "logo-transparent.png",name: "투명 배경",      desc: "배경 제거 PNG",            bg: "bg-checker",svgOnly: false, langEn: false },
  { file: "logo.png",           name: "PNG 원본",        desc: "기본 PNG",                 bg: "bg-white", svgOnly: false, langEn: false },
  { file: "logo-en.png",        name: "영문 PNG",        desc: "영문 기본 PNG",            bg: "bg-white", svgOnly: false, langEn: true  },
];

const CHECKER_BG = `
  linear-gradient(45deg,#ccc 25%,transparent 25%),
  linear-gradient(-45deg,#ccc 25%,transparent 25%),
  linear-gradient(45deg,transparent 75%,#ccc 75%),
  linear-gradient(-45deg,transparent 75%,#ccc 75%)
`.trim();

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

  const cdnUrl = (file: string) => `${CDN}/${brand.id}/${file}?v=${VERSION}`;
  const svgUrl  = cdnUrl("logo.svg");
  const pngUrl  = cdnUrl("logo.png");
  const darkUrl = cdnUrl("logo-transparent.png");
  const mainUrl = brand.logo_svg ? svgUrl : pngUrl;

  const filteredVariants = VARIANTS.filter(v => {
    if (v.svgOnly && !brand.logo_svg) return false;
    if (v.langEn && !brand.lang_en) return false;
    return true;
  });

  const downloads = [
    { file: "logo.svg",            label: "SVG 벡터 (한글)",  desc: "확대해도 깨짐 없음",   show: !!brand.logo_svg },
    { file: "logo-en.svg",         label: "SVG 벡터 (영문)",  desc: "영문 벡터",             show: !!(brand.logo_svg && brand.lang_en) },
    { file: "logo-800.png",        label: "PNG 800px",        desc: "고해상도 래스터",       show: true },
    { file: "logo-transparent.png",label: "투명 배경 PNG",    desc: "배경 제거",             show: true },
    { file: "logo.png",            label: "PNG 원본 (한글)",  desc: "기본 PNG",              show: true },
    { file: "logo-en.png",         label: "PNG 원본 (영문)",  desc: "영문 PNG",              show: !!brand.lang_en },
    { file: "logo-icon.png",       label: "아이콘 (64px)",    desc: "파비콘·앱 아이콘용",   show: true },
  ].filter(d => d.show);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-5"
      onClick={onClose}
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(10px)" }}
    >
      <div
        className="relative flex flex-col overflow-hidden"
        style={{
          width: "90vw", maxWidth: 1400, height: "90vh",
          background: "#18181b", border: "1px solid #2a2a2f",
          borderRadius: 20, boxShadow: "0 40px 100px rgba(0,0,0,0.7)",
          animation: "modalIn 0.18s ease",
        }}
        onClick={e => e.stopPropagation()}
      >
        <style>{`@keyframes modalIn { from { opacity:0; transform:scale(.97) translateY(6px); } to { opacity:1; transform:none; } }`}</style>

        {/* ── Header ── */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 20px", borderBottom: "1px solid #2a2a2f",
          flexShrink: 0, background: "#18181b",
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "#f4f4f5", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {brand.name_ko}{brand.name_en && brand.name_en !== brand.name_ko ? ` / ${brand.name_en}` : ""}
            </h2>
            <p style={{ fontSize: 12, color: "#71717a", marginTop: 3 }}>
              {[brand.category, brand.domain].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <button
              onClick={onClose}
              style={{ background: "#222226", border: "1px solid #2a2a2f", color: "#a1a1aa", width: 32, height: 32, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Body: 3-column ── */}
        <div style={{ flex: 1, overflow: "hidden", display: "grid", gridTemplateColumns: "220px 1fr 300px" }}>

          {/* LEFT: 220px — previews + format badges */}
          <div style={{ overflowY: "auto", padding: "20px 16px", borderRight: "1px solid #2a2a2f", display: "flex", flexDirection: "column", gap: 16, scrollbarWidth: "thin" }}>
            {/* Light preview */}
            <div style={{ background: "#ffffff", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, height: 128 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mainUrl} alt={brand.name_ko} style={{ maxWidth: "100%", maxHeight: 88, objectFit: "contain" }}
                onError={e => { e.currentTarget.src = pngUrl; }} />
            </div>
            {/* Dark preview */}
            <div style={{ background: "#111114", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", padding: 18, height: 88 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={darkUrl} alt={brand.name_ko} style={{ maxWidth: "100%", maxHeight: 56, objectFit: "contain" }}
                onError={e => { e.currentTarget.src = mainUrl; }} />
            </div>

            {/* Use mockups */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#71717a", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>사용 미리보기</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                  <div style={{ width: "100%", aspectRatio: "16/9", background: "#f0f0f0", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", padding: 6, overflow: "hidden" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={pngUrl} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} alt="" onError={e => { e.currentTarget.src = svgUrl; }} />
                  </div>
                  <span style={{ fontSize: 9, color: "#71717a", textAlign: "center" }}>OG 16:9</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 28, height: 28, background: "#e4e4e7", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", padding: 3, overflow: "hidden" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={pngUrl} style={{ width: "100%", height: "100%", objectFit: "contain" }} alt="" />
                  </div>
                  <span style={{ fontSize: 9, color: "#71717a", textAlign: "center" }}>파비콘</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 46, height: 46, background: "#e4e4e7", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", padding: 6, overflow: "hidden" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={pngUrl} style={{ width: "100%", height: "100%", objectFit: "contain" }} alt="" />
                  </div>
                  <span style={{ fontSize: 9, color: "#71717a", textAlign: "center" }}>앱 아이콘</span>
                </div>
              </div>
            </div>

            {/* Format availability */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#71717a", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>보유 형식</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {[
                  { label: "SVG 벡터", ok: !!brand.logo_svg },
                  { label: "PNG",      ok: true },
                  { label: "영문 버전", ok: !!brand.lang_en },
                ].map(({ label, ok }) => (
                  <span key={label} style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                    background: ok ? "rgba(34,197,94,0.12)" : "#222226",
                    color: ok ? "#22c55e" : "#71717a",
                    border: `1px solid ${ok ? "rgba(34,197,94,0.2)" : "#2a2a2f"}`,
                  }}>
                    {ok ? "✓" : "✗"} {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Quick download */}
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: "auto" }}>
              <a
                href={mainUrl} download={`${brand.id}-logo.${brand.logo_svg ? "svg" : "png"}`} target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", padding: "9px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "#6366f1", color: "#fff", textDecoration: "none", border: "none", cursor: "pointer" }}
              >
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                {brand.logo_svg ? "SVG" : "PNG"} 다운로드
              </a>
              {brand.logo_svg && (
                <a href={pngUrl} download={`${brand.id}-logo.png`} target="_blank" rel="noopener noreferrer"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", padding: "9px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "#222226", color: "#a1a1aa", textDecoration: "none", border: "1px solid #2a2a2f", cursor: "pointer" }}>
                  ↓ PNG 다운로드
                </a>
              )}
            </div>
          </div>

          {/* MIDDLE: 1fr — intro split + variants grid */}
          <div style={{ overflowY: "auto", padding: "22px 24px", scrollbarWidth: "thin" }}>
            {/* Intro: big light + dark split */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderRadius: 12, overflow: "hidden", height: 180, marginBottom: 24 }}>
              <div style={{ background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mainUrl} alt={brand.name_ko} style={{ maxWidth: "60%", maxHeight: "60%", objectFit: "contain" }}
                  onError={e => { e.currentTarget.src = pngUrl; }} />
              </div>
              <div style={{ background: "#111114", display: "flex", alignItems: "center", justifyContent: "center", padding: 36 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={darkUrl} alt={brand.name_ko} style={{ maxWidth: "40%", maxHeight: "40%", objectFit: "contain" }}
                  onError={e => { e.currentTarget.src = mainUrl; }} />
              </div>
            </div>

            {/* Variants grid */}
            <div style={{ fontSize: 13, fontWeight: 700, color: "#a1a1aa", marginBottom: 14 }}>파일 변형</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 12 }}>
              {filteredVariants.map(v => {
                const url = cdnUrl(v.file);
                const variantBg: React.CSSProperties = v.bg === "bg-checker"
                  ? { backgroundImage: CHECKER_BG, backgroundSize: "12px 12px", backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0", backgroundColor: "#fff" }
                  : v.bg === "bg-dark"
                  ? { background: "#111114" }
                  : { background: "#ffffff" };

                return (
                  <div key={v.file} style={{ background: "#222226", border: "1px solid #2a2a2f", borderRadius: 8, overflow: "hidden" }}>
                    <div style={{ height: 110, display: "flex", alignItems: "center", justifyContent: "center", padding: 14, ...variantBg }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={v.name} style={{ maxWidth: "100%", maxHeight: 76, objectFit: "contain" }}
                        onError={e => { e.currentTarget.style.display = "none"; }} />
                    </div>
                    <div style={{ padding: "8px 10px", borderTop: "1px solid #2a2a2f" }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#a1a1aa" }}>{v.name}</div>
                      <div style={{ fontSize: 10, color: "#71717a", marginTop: 1 }}>{v.desc}</div>
                      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                        <a
                          href={url} download={`${brand.id}-${v.file}`} target="_blank" rel="noopener noreferrer"
                          style={{ flex: 1, fontSize: 11, padding: "5px 0", borderRadius: 6, background: "#6366f1", color: "#fff", textAlign: "center", textDecoration: "none", display: "block", fontWeight: 500 }}
                        >
                          다운로드
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {brand.sources && brand.sources.length > 0 && (
              <p style={{ fontSize: 11, color: "#52525b", marginTop: 20 }}>
                출처: {(brand.sources as string[]).join(", ")}
              </p>
            )}
          </div>

          {/* RIGHT: 300px — full download list */}
          <div style={{ overflowY: "auto", borderLeft: "1px solid #2a2a2f", display: "flex", flexDirection: "column", scrollbarWidth: "thin" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid #2a2a2f" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#71717a", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>전체 다운로드</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {downloads.map(d => (
                  <a
                    key={d.file}
                    href={cdnUrl(d.file)}
                    download={`${brand.id}-${d.file}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 12px", borderRadius: 8,
                      background: "#222226", border: "1px solid #2a2a2f",
                      textDecoration: "none", cursor: "pointer",
                      transition: "border-color 0.15s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = "#6366f1")}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = "#2a2a2f")}
                  >
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 500, color: "#f4f4f5" }}>{d.label}</p>
                      <p style={{ fontSize: 10, color: "#71717a", marginTop: 2 }}>{d.desc}</p>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" x2="12" y1="15" y2="3" />
                    </svg>
                  </a>
                ))}
              </div>
            </div>

            {/* CDN URL snippet */}
            <div style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#71717a", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>CDN URL</div>
              <div style={{ background: "#0f0f11", border: "1px solid #2a2a2f", borderRadius: 8, padding: 10, fontFamily: "monospace", fontSize: 9.5, color: "#71717a", lineHeight: 1.6, wordBreak: "break-all" }}>
                {`${CDN}/${brand.id}/logo.svg`}
              </div>
              <div style={{ marginTop: 6, background: "#0f0f11", border: "1px solid #2a2a2f", borderRadius: 8, padding: 10, fontFamily: "monospace", fontSize: 9.5, color: "#71717a", lineHeight: 1.6, wordBreak: "break-all" }}>
                {`${CDN}/${brand.id}/logo.png`}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

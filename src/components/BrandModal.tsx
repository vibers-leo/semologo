"use client";

import { useEffect, useState, useCallback } from "react";
import { Brand } from "@/lib/brands";
import { BRAND_RELATIONS, RELATION_LABEL, RELATION_COLOR } from "@/lib/brand-relations";
import { getClientDb } from "@/lib/firebase";
import {
  doc, getDoc, setDoc, updateDoc, increment,
} from "firebase/firestore";

const CDN = process.env.NEXT_PUBLIC_CDN_URL || "https://logo.vibers.co.kr/_clients";
const VERSION = "1785636800";

interface Props {
  brand: Brand;
  onClose: () => void;
  allBrands?: Brand[];
  onSelectBrand?: (brand: Brand) => void;
}

const CHECKER: React.CSSProperties = {
  backgroundImage: `
    linear-gradient(45deg,#ccc 25%,transparent 25%),
    linear-gradient(-45deg,#ccc 25%,transparent 25%),
    linear-gradient(45deg,transparent 75%,#ccc 75%),
    linear-gradient(-45deg,transparent 75%,#ccc 75%)
  `,
  backgroundSize: "12px 12px",
  backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0",
  backgroundColor: "#fff",
};

const VARIANTS = [
  { file: "logo.svg",            name: "SVG 벡터",        desc: "확대해도 깨짐 없음",       bg: "white", svgOnly: true,  langEn: false },
  { file: "logo-en.svg",         name: "영문 SVG",         desc: "영문 벡터",                bg: "white", svgOnly: true,  langEn: true  },
  { file: "logo-800.png",        name: "PNG 800px",        desc: "고해상도 래스터",          bg: "white", svgOnly: false, langEn: false },
  { file: "logo-icon.png",       name: "파비콘 / 아이콘",  desc: "64px · 파비콘·앱 아이콘용", bg: "checker",svgOnly: false, langEn: false },
  { file: "logo-transparent.png",name: "투명 배경",        desc: "배경 제거 PNG",            bg: "checker",svgOnly: false, langEn: false },
  { file: "logo.png",            name: "PNG 원본",         desc: "기본 PNG",                 bg: "white", svgOnly: false, langEn: false },
  { file: "logo-en.png",         name: "영문 PNG",         desc: "영문 기본 PNG",            bg: "white", svgOnly: false, langEn: true  },
];

const EMOJIS = ["🦊","🐱","🦋","🐸","🐼","🦁","🐨","🦄","🐙","🦚","🐬","🌸","🎨","✨","🚀","🎯","🍀","🌊"];
function myEmoji() {
  if (typeof window === "undefined") return "🦊";
  let e = localStorage.getItem("_logo_emoji");
  if (!e) { e = EMOJIS[Math.floor(Math.random() * EMOJIS.length)]; localStorage.setItem("_logo_emoji", e); }
  return e;
}
function relTime(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s/60)}분 전`;
  if (s < 86400) return `${Math.floor(s/3600)}시간 전`;
  return `${Math.floor(s/86400)}일 전`;
}

type ShareEntry = { emoji: string; ts: number; type?: string; label?: string; file?: string };

function toast(msg: string) {
  if (typeof document === "undefined") return;
  const el = document.createElement("div");
  el.textContent = msg;
  el.style.cssText = "position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:#18181b;color:#f4f4f5;padding:10px 20px;border-radius:10px;font-size:13px;z-index:9999;border:1px solid #3f3f46;box-shadow:0 8px 32px rgba(0,0,0,.5);animation:toastIn .18s ease";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

export default function BrandModal({ brand, onClose, allBrands = [], onSelectBrand }: Props) {
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [shareFeed, setShareFeed] = useState<ShareEntry[]>([]);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportMemo, setReportMemo] = useState("");
  const [reportUrl, setReportUrl] = useState("");
  const [reportStatus, setReportStatus] = useState<"idle"|"sending"|"done">("idle");
  const [copyDone, setCopyDone] = useState(false);

  const cdnUrl = (file: string) => `${CDN}/${brand.id}/${file}?v=${VERSION}`;
  const svgUrl  = cdnUrl("logo.svg");
  const pngUrl  = cdnUrl("logo.png");
  const darkUrl = cdnUrl("logo-transparent.png");
  const mainUrl = brand.logo_svg ? svgUrl : pngUrl;
  const pageUrl = typeof window !== "undefined" ? `${window.location.origin}/#${brand.id}` : "";

  const relations = (BRAND_RELATIONS[brand.id] || []).flatMap(rel => {
    const related = allBrands.find(b => b.id === rel.relatedId);
    return related ? [{ ...rel, brand: related }] : [];
  });

  const variants = VARIANTS.filter(v => {
    if (v.svgOnly && !brand.logo_svg) return false;
    if (v.langEn && !brand.lang_en) return false;
    return true;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);

  useEffect(() => {
    (async () => {
      try {
        const db = getClientDb();
        const [vSnap, sSnap] = await Promise.all([
          getDoc(doc(db, "logo_votes", brand.id)),
          getDoc(doc(db, "logo_shares", brand.id)),
        ]);
        if (vSnap.exists()) setVotes(vSnap.data() as Record<string, number>);
        if (sSnap.exists()) setShareFeed(sSnap.data().recent || []);
      } catch {}
    })();
  }, [brand.id]);

  const castVote = useCallback(async (file: string, label: string) => {
    try {
      const db = getClientDb();
      const ref = doc(db, "logo_votes", brand.id);
      const snap = await getDoc(ref);
      if (snap.exists()) await updateDoc(ref, { [file]: increment(1) });
      else await setDoc(ref, { [file]: 1 });
      setVotes(prev => ({ ...prev, [file]: (prev[file] || 0) + 1 }));

      const emoji = myEmoji();
      const sRef = doc(db, "logo_shares", brand.id);
      const sSnap = await getDoc(sRef);
      const prev = sSnap.exists() ? (sSnap.data().recent || []) : [];
      const recent = [...prev, { emoji, ts: Date.now(), type: "vote", label, file }].slice(-10);
      if (sSnap.exists()) await updateDoc(sRef, { count: increment(1), recent });
      else await setDoc(sRef, { count: 1, recent });
      setShareFeed(recent);
      toast("👍 추천했어요!");
    } catch { toast("오류가 발생했어요"); }
  }, [brand.id]);

  const doShare = useCallback(async () => {
    navigator.clipboard.writeText(pageUrl).catch(() => {});
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 1800);
    try {
      const db = getClientDb();
      const emoji = myEmoji();
      const ref = doc(db, "logo_shares", brand.id);
      const snap = await getDoc(ref);
      const prev = snap.exists() ? (snap.data().recent || []) : [];
      const recent = [...prev, { emoji, ts: Date.now() }].slice(-10);
      if (snap.exists()) await updateDoc(ref, { count: increment(1), recent });
      else await setDoc(ref, { count: 1, recent });
      setShareFeed(recent);
    } catch {}
    toast("퍼가기 완료! 링크 복사됨 🎉");
  }, [brand.id, pageUrl]);

  const handleReport = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setReportStatus("sending");
    try {
      const fd = new FormData();
      fd.set("brand_id", brand.id);
      fd.set("brand_name", brand.name_ko + " · 버전 개선 제보");
      fd.set("memo", reportMemo);
      fd.set("logo_url", reportUrl);
      const res = await fetch("https://ai.vibers.co.kr/api/logo-submit", { method: "POST", body: fd });
      const json = await res.json();
      if (json.success) {
        setReportStatus("done");
        setTimeout(() => { setReportOpen(false); setReportStatus("idle"); setReportMemo(""); setReportUrl(""); }, 1800);
      } else throw new Error();
    } catch { setReportStatus("idle"); toast("전송에 실패했어요. 다시 시도해 주세요."); }
  }, [brand.id, brand.name_ko, reportMemo, reportUrl]);

  const bgStyle = (bg: string): React.CSSProperties =>
    bg === "checker" ? CHECKER : bg === "dark" ? { background: "#111114" } : { background: "#ffffff" };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-5"
      onClick={onClose}
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
    >
      <style>{`
        @keyframes modalIn { from { opacity:0; transform:scale(.97) translateY(6px); } to { opacity:1; transform:none; } }
        @keyframes toastIn { from { opacity:0; transform:translateX(-50%) translateY(8px); } to { opacity:1; transform:translateX(-50%); } }
        .mscroll::-webkit-scrollbar { width:4px; }
        .mscroll::-webkit-scrollbar-track { background:transparent; }
        .mscroll::-webkit-scrollbar-thumb { background:#d4d4d8; border-radius:2px; }
        .mscroll::-webkit-scrollbar-thumb:hover { background:#a1a1aa; }
        .vbtn:hover { border-color:#6366f1 !important; color:#6366f1 !important; }
        .dlrow:hover { border-color:#6366f1 !important; }
        .sharebtn:hover { border-color:#6366f1 !important; color:#6366f1 !important; }
      `}</style>

      <div
        className="relative flex flex-col overflow-hidden"
        style={{ width:"90vw", maxWidth:1400, height:"90vh", background:"#ffffff", border:"1px solid #e4e4e7", borderRadius:20, boxShadow:"0 24px 80px rgba(0,0,0,.15)", animation:"modalIn .18s ease" }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 20px", borderBottom:"1px solid #e4e4e7", flexShrink:0 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <h2 style={{ fontSize:17, fontWeight:700, color:"#111111", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
              {brand.name_ko}{brand.name_en && brand.name_en !== brand.name_ko ? ` / ${brand.name_en}` : ""}
            </h2>
            <p style={{ fontSize:12, color:"#71717a", marginTop:3 }}>
              {[brand.category, brand.domain].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button
            onClick={doShare}
            className="sharebtn"
            style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 12px", background:"#f4f4f5", border:"1px solid #e4e4e7", color:"#52525b", borderRadius:8, fontSize:12, fontWeight:500, cursor:"pointer", transition:"all .15s", flexShrink:0 }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            {copyDone ? "복사됨!" : "퍼가기"}
          </button>
          <button onClick={onClose} style={{ background:"#f4f4f5", border:"1px solid #e4e4e7", color:"#52525b", width:32, height:32, borderRadius:8, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* ── 연관기업 바 ── */}
        {relations.length > 0 && (
          <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 20px", borderBottom:"1px solid #e4e4e7", background:"#fafafa", flexShrink:0, flexWrap:"wrap" }}>
            <span style={{ fontSize:10, fontWeight:700, color:"#a1a1aa", letterSpacing:".06em", textTransform:"uppercase", flexShrink:0 }}>연관기업</span>
            {relations.map(rel => {
              const clr = RELATION_COLOR[rel.type];
              const relLogoUrl = `${CDN}/${rel.brand.id}/logo.png?v=${VERSION}`;
              return (
                <button
                  key={rel.brand.id}
                  onClick={() => onSelectBrand?.(rel.brand)}
                  disabled={!onSelectBrand}
                  style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 10px 4px 6px", background:clr.bg, border:`1px solid ${clr.border}`, borderRadius:20, cursor:onSelectBrand?"pointer":"default", transition:"opacity .15s" }}
                  onMouseEnter={e => { if (onSelectBrand) e.currentTarget.style.opacity=".75"; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity="1"; }}
                  title={onSelectBrand ? `${rel.brand.name_ko} 열기` : undefined}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={relLogoUrl} alt="" style={{ width:18, height:18, objectFit:"contain", flexShrink:0 }} onError={e => { e.currentTarget.style.display="none"; }} />
                  <span style={{ fontSize:10, fontWeight:700, color:clr.color }}>{RELATION_LABEL[rel.type]}</span>
                  <span style={{ fontSize:11, fontWeight:600, color:clr.color }}>{rel.brand.name_ko}</span>
                  {rel.note && <span style={{ fontSize:9, color:clr.color, opacity:.7 }}>{rel.note}</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* ── 3-column body ── */}
        <div style={{ flex:1, overflow:"hidden", display:"grid", gridTemplateColumns:"220px 1fr 300px" }}>

          {/* ── LEFT: 미리보기 + 형식 + 빠른다운 ── */}
          <div className="mscroll" style={{ overflowY:"auto", padding:"20px 16px", borderRight:"1px solid #e4e4e7", display:"flex", flexDirection:"column", gap:16, scrollbarWidth:"thin" }}>
            <div style={{ background:"#ffffff", border:"1px solid #f0f0f2", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", padding:20, height:128 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mainUrl} alt={brand.name_ko} style={{ maxWidth:"100%", maxHeight:88, objectFit:"contain" }} onError={e => { e.currentTarget.src = pngUrl; }} />
            </div>
            <div style={{ background:"#111114", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", padding:18, height:88 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={darkUrl} alt={brand.name_ko} style={{ maxWidth:"100%", maxHeight:56, objectFit:"contain" }} onError={e => { e.currentTarget.src = mainUrl; }} />
            </div>

            {/* 사용 미리보기 */}
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:"#71717a", letterSpacing:".08em", textTransform:"uppercase", marginBottom:10 }}>사용 미리보기</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
                {[
                  { label:"OG 16:9",   style:{ width:"100%", aspectRatio:"16/9", background:"#f0f0f0", borderRadius:4, display:"flex", alignItems:"center", justifyContent:"center", padding:6, overflow:"hidden" } as React.CSSProperties },
                  { label:"파비콘",    style:{ width:28, height:28, background:"#e4e4e7", borderRadius:4, display:"flex", alignItems:"center", justifyContent:"center", padding:3, overflow:"hidden" } as React.CSSProperties },
                  { label:"앱 아이콘", style:{ width:46, height:46, background:"#e4e4e7", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", padding:6, overflow:"hidden" } as React.CSSProperties },
                ].map(m => (
                  <div key={m.label} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5 }}>
                    <div style={m.style}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={pngUrl} alt="" style={{ maxWidth:"100%", maxHeight:"100%", objectFit:"contain" }} />
                    </div>
                    <span style={{ fontSize:9, color:"#71717a", textAlign:"center" }}>{m.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 보유 형식 */}
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:"#71717a", letterSpacing:".08em", textTransform:"uppercase", marginBottom:10 }}>보유 형식</div>
              <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                {[{ label:"SVG 벡터", ok:!!brand.logo_svg }, { label:"PNG", ok:true }, { label:"영문 버전", ok:!!brand.lang_en }].map(({ label, ok }) => (
                  <span key={label} style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"4px 10px", borderRadius:20, fontSize:11, fontWeight:600, background:ok?"rgba(34,197,94,0.12)":"#f4f4f5", color:ok?"#22c55e":"#71717a", border:`1px solid ${ok?"rgba(34,197,94,0.2)":"#e4e4e7"}` }}>
                    {ok ? "✓" : "✗"} {label}
                  </span>
                ))}
              </div>
            </div>

            {/* 빠른 다운로드 */}
            <div style={{ display:"flex", flexDirection:"column", gap:7, marginTop:"auto" }}>
              <a href={mainUrl} download={`${brand.id}-logo.${brand.logo_svg ? "svg" : "png"}`} target="_blank" rel="noopener noreferrer"
                style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, padding:"9px 0", borderRadius:8, fontSize:12, fontWeight:600, background:"#6366f1", color:"#fff", textDecoration:"none" }}>
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
                {brand.logo_svg ? "SVG" : "PNG"} 다운로드
              </a>
              {brand.logo_svg && (
                <a href={pngUrl} download={`${brand.id}-logo.png`} target="_blank" rel="noopener noreferrer"
                  style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:"9px 0", borderRadius:8, fontSize:12, fontWeight:600, background:"#f4f4f5", color:"#52525b", textDecoration:"none", border:"1px solid #e4e4e7" }}>
                  ↓ PNG 다운로드
                </a>
              )}
            </div>
          </div>

          {/* ── MID: 인트로 + 변형 그리드 ── */}
          <div className="mscroll" style={{ overflowY:"auto", padding:"22px 24px", scrollbarWidth:"thin" }}>
            {/* 인트로 라이트/다크 */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", borderRadius:12, overflow:"hidden", height:180, marginBottom:24 }}>
              <div style={{ background:"#ffffff", display:"flex", alignItems:"center", justifyContent:"center", padding:20, border:"1px solid #f0f0f2" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mainUrl} alt={brand.name_ko} style={{ maxWidth:"60%", maxHeight:"60%", objectFit:"contain" }} onError={e => { e.currentTarget.src = pngUrl; }} />
              </div>
              <div style={{ background:"#111114", display:"flex", alignItems:"center", justifyContent:"center", padding:36 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={darkUrl} alt={brand.name_ko} style={{ maxWidth:"40%", maxHeight:"40%", objectFit:"contain" }} onError={e => { e.currentTarget.src = mainUrl; }} />
              </div>
            </div>

            {/* 변형 그리드 */}
            <div style={{ fontSize:13, fontWeight:700, color:"#3f3f46", marginBottom:14 }}>
              파일 다운로드 <span style={{ fontSize:11, fontWeight:400, color:"#71717a" }}>메인 로고 기준</span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:12 }}>
              {variants.map(v => {
                const url = cdnUrl(v.file);
                const voteCount = votes[v.file] || 0;
                return (
                  <div key={v.file} style={{ background:"#fafafa", border:"1px solid #e4e4e7", borderRadius:8, overflow:"hidden" }}>
                    <div style={{ height:110, display:"flex", alignItems:"center", justifyContent:"center", padding:14, ...bgStyle(v.bg) }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={v.name} style={{ maxWidth:"100%", maxHeight:76, objectFit:"contain" }} onError={e => { e.currentTarget.style.display="none"; }} />
                    </div>
                    <div style={{ padding:"8px 10px", borderTop:"1px solid #e4e4e7", background:"#fafafa" }}>
                      <div style={{ fontSize:11, fontWeight:600, color:"#3f3f46" }}>{v.name}</div>
                      <div style={{ fontSize:10, color:"#71717a", marginTop:1 }}>{v.desc}</div>
                      <div style={{ display:"flex", gap:6, marginTop:8 }}>
                        <button
                          className="vbtn"
                          onClick={() => castVote(v.file, v.name)}
                          title="이 버전 추천"
                          style={{ flex:1, background:"transparent", border:"1px solid #e4e4e7", borderRadius:6, padding:"5px 0", fontSize:11, color:"#71717a", cursor:"pointer", transition:"all .15s" }}
                        >
                          👍 {voteCount > 0 ? voteCount : "—"}
                        </button>
                        <a href={url} download={`${brand.id}-${v.file}`} target="_blank" rel="noopener noreferrer"
                          style={{ flex:1, fontSize:11, padding:"5px 0", borderRadius:6, background:"#6366f1", color:"#fff", textAlign:"center", textDecoration:"none", display:"block", fontWeight:500 }}>
                          다운로드
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── RIGHT: 퍼가요 + 임베드 + 제보 + 광고 ── */}
          <div className="mscroll" style={{ overflowY:"auto", borderLeft:"1px solid #e4e4e7", display:"flex", flexDirection:"column", scrollbarWidth:"thin" }}>

            {/* 퍼가요~ */}
            <div style={{ padding:"14px 16px", borderBottom:"1px solid #e4e4e7" }}>
              <div style={{ fontSize:10, fontWeight:700, color:"#71717a", letterSpacing:".08em", textTransform:"uppercase", marginBottom:10 }}>퍼가요~ 🎉</div>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                <button onClick={doShare}
                  style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, padding:"9px 0", borderRadius:8, fontSize:11, fontWeight:600, background:"#6366f1", color:"#fff", border:"none", cursor:"pointer" }}>
                  🔗 이 브랜드 페이지 퍼가기
                </button>
                <button onClick={() => { navigator.clipboard.writeText(mainUrl); toast("로고 URL 복사됨! 🖼"); }}
                  style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, padding:"9px 0", borderRadius:8, fontSize:11, fontWeight:600, background:"#f4f4f5", color:"#52525b", border:"1px solid #e4e4e7", cursor:"pointer" }}>
                  🖼 로고 URL만 복사
                </button>
              </div>
              {/* 공유 피드 */}
              {shareFeed.length > 0 && (
                <div style={{ marginTop:10 }}>
                  <div style={{ fontSize:9, fontWeight:700, color:"#71717a", letterSpacing:".06em", textTransform:"uppercase", marginBottom:5 }}>최근 활동</div>
                  {shareFeed.slice(-6).map((s, i) => (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:4, padding:"3px 0", borderBottom:"1px solid #f0f0f2" }}>
                      <span>{s.emoji}</span>
                      <span style={{ fontSize:10, color:"#3f3f46", flex:1 }}>
                        {s.type === "vote" ? <><span style={{ color:"#6366f1" }}>"{s.label}"</span> 추천 👍</>
                         : s.type === "swap" ? <><span style={{ color:"#f59e0b" }}>"{s.label}"</span> 교체 요청 🔄</>
                         : "퍼가기 🎉"}
                      </span>
                      <span style={{ fontSize:9, color:"#71717a" }}>{relTime(s.ts)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* HTML 임베드 */}
            <div style={{ padding:"14px 16px", borderBottom:"1px solid #e4e4e7" }}>
              <div style={{ fontSize:10, fontWeight:700, color:"#71717a", letterSpacing:".08em", textTransform:"uppercase", marginBottom:10 }}>HTML 임베드</div>
              <div style={{ background:"#f4f4f5", border:"1px solid #e4e4e7", borderRadius:8, padding:10, fontFamily:"monospace", fontSize:"9.5px", color:"#71717a", lineHeight:1.6, wordBreak:"break-all", marginBottom:8 }}>
                {`<img src="${mainUrl}" alt="${brand.name_ko}" style="height:40px">`}
              </div>
              <button onClick={() => { navigator.clipboard.writeText(`<img src="${mainUrl}" alt="${brand.name_ko}" style="height:40px">`); toast("임베드 코드 복사됨!"); }}
                style={{ width:"100%", padding:"7px 0", borderRadius:8, fontSize:11, fontWeight:600, background:"#f4f4f5", color:"#52525b", border:"1px solid #e4e4e7", cursor:"pointer" }}>
                코드 복사
              </button>
            </div>

            {/* 제보 & 개선 */}
            <div style={{ padding:"14px 16px", borderBottom:"1px solid #e4e4e7" }}>
              <div style={{ fontSize:10, fontWeight:700, color:"#71717a", letterSpacing:".08em", textTransform:"uppercase", marginBottom:10 }}>제보 &amp; 개선</div>
              <button
                onClick={() => setReportOpen(o => !o)}
                style={{ width:"100%", padding:"9px 0", borderRadius:8, fontSize:11, fontWeight:600, background:"#f4f4f5", color:"#52525b", border:"1px solid #e4e4e7", cursor:"pointer" }}
              >
                {reportOpen ? "↩ 접기" : "✉️ 더 좋은 버전 제보하기"}
              </button>
              {reportOpen && (
                <form onSubmit={handleReport} style={{ marginTop:12, paddingTop:12, borderTop:"1px solid #e4e4e7", display:"flex", flexDirection:"column", gap:7 }}>
                  <textarea
                    rows={2} placeholder="개선점 또는 출처 URL 메모"
                    value={reportMemo} onChange={e => setReportMemo(e.target.value)}
                    style={{ width:"100%", background:"#f9f9f9", border:"1px solid #e4e4e7", color:"#111111", padding:8, borderRadius:6, fontSize:11, resize:"none", fontFamily:"inherit", outline:"none", lineHeight:1.5 }}
                  />
                  <input
                    type="url" placeholder="로고 URL (선택)"
                    value={reportUrl} onChange={e => setReportUrl(e.target.value)}
                    style={{ width:"100%", background:"#f9f9f9", border:"1px solid #e4e4e7", color:"#111111", padding:"7px 8px", borderRadius:6, fontSize:11, outline:"none" }}
                  />
                  <div style={{ display:"flex", gap:6 }}>
                    <button type="submit" disabled={reportStatus === "sending"}
                      style={{ flex:1, padding:"7px 0", borderRadius:8, fontSize:11, fontWeight:600, background:"#6366f1", color:"#fff", border:"none", cursor:"pointer" }}>
                      {reportStatus === "sending" ? "전송 중…" : reportStatus === "done" ? "✅ 감사합니다!" : "전송"}
                    </button>
                    <button type="button" onClick={() => setReportOpen(false)}
                      style={{ padding:"7px 14px", borderRadius:8, fontSize:11, fontWeight:600, background:"#f4f4f5", color:"#52525b", border:"1px solid #e4e4e7", cursor:"pointer" }}>
                      취소
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* 광고 슬롯 */}
            <div style={{ flex:1, padding:"14px 16px", display:"flex", flexDirection:"column", justifyContent:"flex-end" }}>
              <div style={{ background:"#f4f4f5", border:"1px dashed #d4d4d8", borderRadius:10, padding:"18px 12px", textAlign:"center" }}>
                <div style={{ fontSize:9, color:"#a1a1aa", letterSpacing:".08em", textTransform:"uppercase", marginBottom:6 }}>광고</div>
                <div style={{ fontSize:11, color:"#a1a1aa" }}>Ad slot</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

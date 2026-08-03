"use client";

import { useEffect, useState, useCallback } from "react";
import { Brand } from "@/lib/brands";
import { BRAND_RELATIONS, RELATION_LABEL, RELATION_COLOR } from "@/lib/brand-relations";
import { getClientDb } from "@/lib/firebase";
import {
  doc, getDoc, setDoc, updateDoc, increment,
} from "firebase/firestore";
import {
  analyzeLogoVisibility, getDarkPreviewStyle, getDarkPreviewUrl, getDarkPreviewLabel,
  type VisibilityResult,
} from "@/lib/logo-visibility";
import {
  loadQuality, getMyVote, voteQuality, type QualityData,
} from "@/lib/logo-quality";

const CDN = process.env.NEXT_PUBLIC_CDN_URL || "https://logo.vibers.co.kr/_clients";
const VERSION = "1785636800";

interface Props {
  brand: Brand;
  onClose: () => void;
  allBrands?: Brand[];
  onSelectBrand?: (brand: Brand) => void;
}

const CHECKER: React.CSSProperties = {
  backgroundColor: "#f8f8f8",
  backgroundImage: `
    linear-gradient(rgba(0,0,0,0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px)
  `,
  backgroundSize: "12px 12px",
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
  const [swapTarget, setSwapTarget] = useState<string | null>(null);
  const [votedFiles, setVotedFiles] = useState<string[]>([]);
  const [shareFeed, setShareFeed] = useState<ShareEntry[]>([]);
  const [visibility, setVisibility] = useState<VisibilityResult | null>(null);
  const [hasWhiteLogo, setHasWhiteLogo] = useState(false);
  const [quality, setQuality] = useState<QualityData>({ up: 0, down: 0, flagged: false });
  const [myQualityVote, setMyQualityVote] = useState<"up" | "down" | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportMemo, setReportMemo] = useState("");
  const [reportUrl, setReportUrl] = useState("");
  const [reportStatus, setReportStatus] = useState<"idle"|"sending"|"done">("idle");
  const [copyDone, setCopyDone] = useState(false);

  const cdnUrl = (file: string) => `${CDN}/${brand.id}/${file}?v=${VERSION}`;
  const svgUrl     = cdnUrl("logo.svg");
  const pngUrl     = cdnUrl("logo.png");
  const darkUrl    = cdnUrl("logo-transparent.png");
  const whiteUrl   = cdnUrl("logo-white.png");
  const mainUrl    = brand.logo_svg ? svgUrl : pngUrl;
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
        if (vSnap.exists()) {
          const data = vSnap.data();
          // 중첩 구조 { votes: { logo_svg: 3 } } 지원 (구버전 flat 형식 폴백)
          const rawVotes = (data.votes && typeof data.votes === "object") ? data.votes : data;
          const decoded: Record<string, number> = {};
          for (const [k, v] of Object.entries(rawVotes)) {
            if (typeof v === "number") decoded[k] = v;
          }
          setVotes(decoded);
          if (data.swap_pending) setSwapTarget(data.swap_target || null);
        }
        if (sSnap.exists()) setShareFeed(sSnap.data().recent || []);
      } catch {}
    })();
    const voted = JSON.parse(typeof window !== "undefined" ? localStorage.getItem(`voted_${brand.id}`) || "[]" : "[]");
    setVotedFiles(voted);
    // 품질 투표 로드
    loadQuality(brand.id).then(setQuality);
    setMyQualityVote(getMyVote(brand.id));
  }, [brand.id]);

  useEffect(() => {
    analyzeLogoVisibility(
      brand.id,
      `${CDN}/${brand.id}/logo.png`,
      `${CDN}/${brand.id}/logo-transparent.png`,
    ).then(setVisibility);
    // logo-white.png 존재 여부 확인 (다크 프리뷰 우선 사용)
    const img = new Image();
    img.onload = () => setHasWhiteLogo(true);
    img.onerror = () => setHasWhiteLogo(false);
    img.src = `${CDN}/${brand.id}/logo-white.png?v=${VERSION}`;
  }, [brand.id]);

  // Firestore 필드명에 . 사용 불가 → 인코딩
  const fk = (file: string) => file.replace(/\//g, "__").replace(/\./g, "_");

  const appendFeed = useCallback(async (entry: ShareEntry) => {
    try {
      const db = getClientDb();
      const ref = doc(db, "logo_shares", brand.id);
      const snap = await getDoc(ref);
      const prev = snap.exists() ? (snap.data().recent || []) : [];
      const recent = [...prev, entry].slice(-20);
      if (snap.exists()) await updateDoc(ref, { recent });
      else await setDoc(ref, { count: 0, recent });
      setShareFeed(recent);
    } catch {}
  }, [brand.id]);

  const castVote = useCallback(async (file: string, label: string) => {
    if (votedFiles.includes(file)) { toast("이미 투표했어요"); return; }

    const key = fk(file);
    // 낙관적 업데이트
    setVotes(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
    const newVoted = [...votedFiles, file];
    setVotedFiles(newVoted);
    localStorage.setItem(`voted_${brand.id}`, JSON.stringify(newVoted));

    try {
      const db = getClientDb();
      const ref = doc(db, "logo_votes", brand.id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        await updateDoc(ref, { [`votes.${key}`]: increment(1) });
      } else {
        await setDoc(ref, { votes: { [key]: 1 }, swap_pending: false, swap_target: null });
      }
      appendFeed({ emoji: myEmoji(), ts: Date.now(), type: "vote", label, file });
      toast("👍 추천했어요!");
    } catch {
      // 롤백
      setVotes(prev => ({ ...prev, [key]: Math.max(0, (prev[key] || 1) - 1) }));
      setVotedFiles(votedFiles);
      localStorage.setItem(`voted_${brand.id}`, JSON.stringify(votedFiles));
      toast("저장 실패. 다시 시도해주세요");
    }
  }, [brand.id, votedFiles, appendFeed]);

  const requestSwap = useCallback(async (file: string, label: string) => {
    if (!window.confirm(`"${label}"을(를) 메인 로고로 교체 요청할까요?\n관리자 확인 후 반영됩니다.`)) return;
    try {
      const db = getClientDb();
      const ref = doc(db, "logo_votes", brand.id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        await updateDoc(ref, { swap_pending: true, swap_target: file });
      } else {
        await setDoc(ref, { votes: {}, swap_pending: true, swap_target: file });
      }
      setSwapTarget(file);
      appendFeed({ emoji: myEmoji(), ts: Date.now(), type: "swap", label, file });
      toast("교체 요청 완료! 관리자 확인 후 반영돼요 🔄");
    } catch { toast("요청 실패. 다시 시도해주세요"); }
  }, [brand.id, appendFeed]);

  const doShare = useCallback(async () => {
    navigator.clipboard.writeText(pageUrl).catch(() => {});
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 1800);
    appendFeed({ emoji: myEmoji(), ts: Date.now() });
    toast("퍼가기 완료! 링크 복사됨 🎉");
  }, [brand.id, pageUrl]);

  const castQualityVote = useCallback(async (vote: "up" | "down") => {
    if (myQualityVote) { toast(myQualityVote === vote ? "이미 투표했어요" : "투표는 한 번만 할 수 있어요"); return; }
    try {
      const result = await voteQuality(brand.id, vote);
      setQuality(result);
      setMyQualityVote(vote);
      toast(vote === "up" ? "👍 좋아요!" : "🚩 교체 요청이 접수됐어요");
    } catch { toast("투표 실패. 다시 시도해주세요"); }
  }, [brand.id, myQualityVote]);

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
    bg === "checker" ? CHECKER : bg === "dark" ? { background: "#111114" } : { background: "#ffffff", border: "none" };

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
            {/* 품질 투표 */}
            <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:7 }}>
              <span style={{ fontSize:10, color:"#a1a1aa" }}>이 로고 어때요?</span>
              <button
                onClick={() => castQualityVote("up")}
                title="좋은 로고예요"
                style={{ display:"inline-flex", alignItems:"center", gap:3, padding:"3px 9px", borderRadius:20, fontSize:11, fontWeight:600, cursor: myQualityVote ? "default" : "pointer", transition:"all .15s", background: myQualityVote === "up" ? "rgba(34,197,94,.12)" : "#f4f4f5", border:`1px solid ${myQualityVote === "up" ? "rgba(34,197,94,.4)" : "#e4e4e7"}`, color: myQualityVote === "up" ? "#16a34a" : "#71717a", opacity: myQualityVote && myQualityVote !== "up" ? .45 : 1 }}
              >
                👍 {quality.up > 0 ? quality.up : ""}
              </button>
              <button
                onClick={() => castQualityVote("down")}
                title="교체가 필요해요"
                style={{ display:"inline-flex", alignItems:"center", gap:3, padding:"3px 9px", borderRadius:20, fontSize:11, fontWeight:600, cursor: myQualityVote ? "default" : "pointer", transition:"all .15s", background: myQualityVote === "down" ? "rgba(239,68,68,.1)" : "#f4f4f5", border:`1px solid ${myQualityVote === "down" ? "rgba(239,68,68,.35)" : "#e4e4e7"}`, color: myQualityVote === "down" ? "#dc2626" : "#71717a", opacity: myQualityVote && myQualityVote !== "down" ? .45 : 1 }}
              >
                🚩 교체 필요 {quality.down > 0 ? quality.down : ""}
              </button>
              {quality.flagged && (
                <span style={{ fontSize:9, fontWeight:700, color:"#dc2626", background:"rgba(239,68,68,.08)", border:"1px solid rgba(239,68,68,.2)", borderRadius:10, padding:"2px 6px" }}>
                  검토 필요
                </span>
              )}
            </div>
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
            <div style={{ position:"relative", background:"#ffffff", border:"1px solid #f0f0f2", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", padding:20, height:128 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mainUrl} alt={brand.name_ko} style={{ maxWidth:"100%", maxHeight:88, objectFit:"contain" }} onError={e => { e.currentTarget.src = pngUrl; }} />
              {brand.original_ai_url && (
                <a href={brand.original_ai_url} target="_blank" rel="noopener noreferrer"
                  title="브랜드 공식 홈페이지에서 수집한 원본 파일"
                  style={{ position:"absolute", bottom:6, right:6, display:"inline-flex", alignItems:"center", gap:3, padding:"2px 7px", background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:10, fontSize:9, fontWeight:700, color:"#2563eb", textDecoration:"none", letterSpacing:".04em" }}>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                  공식
                </a>
              )}
            </div>
            <div style={{ ...getDarkPreviewStyle(visibility), borderRadius:8, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:18, height:88, gap:4 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  hasWhiteLogo && visibility?.darkMode !== "white-only"
                    ? whiteUrl
                    : getDarkPreviewUrl(visibility, darkUrl, mainUrl)
                }
                alt={brand.name_ko}
                style={{ maxWidth:"100%", maxHeight:50, objectFit:"contain" }}
                onError={e => { e.currentTarget.src = mainUrl; }}
              />
              {visibility && (
                <span style={{ fontSize:8, color: visibility.darkMode === "white-only" ? "#71717a" : "#a1a1aa", letterSpacing:".06em", textTransform:"uppercase", opacity:.8 }}>
                  {getDarkPreviewLabel(visibility)}{hasWhiteLogo && visibility.darkMode !== "white-only" ? " · 화이트" : ""}
                </span>
              )}
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
              <div style={{ ...getDarkPreviewStyle(visibility), display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24, gap:6 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getDarkPreviewUrl(visibility, darkUrl, mainUrl)} alt={brand.name_ko} style={{ maxWidth:"55%", maxHeight:"55%", objectFit:"contain" }} onError={e => { e.currentTarget.src = mainUrl; }} />
                {visibility && (
                  <span style={{ fontSize:8, letterSpacing:".06em", textTransform:"uppercase", opacity:.65, color: visibility.darkMode === "white-only" ? "#52525b" : "#a1a1aa" }}>
                    {getDarkPreviewLabel(visibility)}
                  </span>
                )}
              </div>
            </div>

            {/* 변형 그리드 */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#3f3f46" }}>
                파일 다운로드 <span style={{ fontSize:11, fontWeight:400, color:"#71717a" }}>메인 로고 기준</span>
              </div>
              <span style={{ fontSize:10, color:"#a1a1aa" }}>👍 추천 · 🔄 교체 요청</span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:12 }}>
              {variants.map(v => {
                const url = cdnUrl(v.file);
                const key = fk(v.file);
                const voteCount = votes[key] || 0;
                const isVoted = votedFiles.includes(v.file);
                const isSwapTarget = swapTarget === v.file;
                return (
                  <div key={v.file} style={{ background:"#fafafa", border:`1px solid ${isSwapTarget ? "#f59e0b" : "#e4e4e7"}`, borderRadius:8, overflow:"hidden", outline: isSwapTarget ? "2px solid #fde68a" : "none", outlineOffset:1 }}>
                    <div style={{ height:110, display:"flex", alignItems:"center", justifyContent:"center", padding:14, ...bgStyle(v.bg) }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={v.name} style={{ maxWidth:"100%", maxHeight:76, objectFit:"contain" }} onError={e => { e.currentTarget.style.display="none"; }} />
                    </div>
                    <div style={{ padding:"8px 10px", borderTop:"1px solid #e4e4e7", background:"#fafafa" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                        <span style={{ fontSize:11, fontWeight:600, color:"#3f3f46", flex:1 }}>{v.name}</span>
                        {isSwapTarget && <span style={{ fontSize:9, fontWeight:700, color:"#f59e0b", background:"#fef3c7", border:"1px solid #fde68a", borderRadius:10, padding:"1px 5px" }}>교체 대기</span>}
                      </div>
                      <div style={{ fontSize:10, color:"#71717a", marginTop:1 }}>{v.desc}</div>
                      <div style={{ display:"flex", gap:5, marginTop:8 }}>
                        <button
                          onClick={() => castVote(v.file, v.name)}
                          title={isVoted ? "이미 투표함" : "이 버전 추천"}
                          style={{ flex:1, background: isVoted ? "rgba(99,102,241,0.08)" : "transparent", border:`1px solid ${isVoted ? "#6366f1" : "#e4e4e7"}`, borderRadius:6, padding:"5px 0", fontSize:11, color: isVoted ? "#6366f1" : "#71717a", cursor:"pointer", transition:"all .15s", fontWeight: isVoted ? 600 : 400 }}
                        >
                          👍 {voteCount > 0 ? voteCount : "—"}
                        </button>
                        <button
                          onClick={() => requestSwap(v.file, v.name)}
                          title="메인 로고로 교체 요청"
                          style={{ background: isSwapTarget ? "#fef3c7" : "transparent", border:`1px solid ${isSwapTarget ? "#f59e0b" : "#e4e4e7"}`, borderRadius:6, padding:"5px 8px", fontSize:11, color: isSwapTarget ? "#d97706" : "#71717a", cursor:"pointer", transition:"all .15s", flexShrink:0 }}
                        >
                          {isSwapTarget ? "✅" : "🔄"}
                        </button>
                        <a href={url} download={`${brand.id}-${v.file}`} target="_blank" rel="noopener noreferrer"
                          style={{ flex:1, fontSize:11, padding:"5px 0", borderRadius:6, background:"#6366f1", color:"#fff", textAlign:"center", textDecoration:"none", display:"block", fontWeight:500 }}>
                          ↓
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

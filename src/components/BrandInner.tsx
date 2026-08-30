"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Brand, fetchVariants, type VariantManifest, type VariantRecord } from "@/lib/brands";
import { BRAND_RELATIONS, RELATION_LABEL, RELATION_COLOR } from "@/lib/brand-relations";
import { getClientAuth, getClientDb } from "@/lib/firebase";
import CoupangSlot from "./CoupangSlot";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://semologo.com";
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
import { sendHit } from "@/lib/hit";
import { trackEvent } from "@/lib/analytics";
import { CDN, VERSION } from "@/lib/cdn";

/**
 * CDN이 크로스 오리진(logo.vibers.co.kr ≠ semologo.com)이라
 * <a download> 속성이 브라우저에서 무시된다 → 새 탭으로 열려버림.
 * blob으로 받아서 강제로 저장시킨다. CDN은 access-control-allow-origin: * 이라 가능.
 */
async function downloadFile(url: string, filename: string): Promise<boolean> {
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return false;
    const blob = await res.blob();
    // GitHub Pages는 없는 경로에 404 HTML을 내려준다 — 그걸 파일로 저장하면 안 됨
    if (blob.type.includes("text/html") || blob.size === 0) return false;
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objUrl), 60_000);
    return true;
  } catch {
    return false;
  }
}

/** 이미지 프로브로 CDN에 파일이 실제로 있는지 확인 (undefined = 확인 중) */
function useAvailability(urls: (string | null | undefined)[]) {
  const key = urls.filter(Boolean).join("|");
  const [state, setState] = useState<Record<string, boolean>>({});
  useEffect(() => {
    let alive = true;
    const imgs: HTMLImageElement[] = [];
    for (const u of key.split("|")) {
      if (!u) continue;
      const img = new Image();
      img.onload = () => alive && setState(s => (s[u] === true ? s : { ...s, [u]: true }));
      img.onerror = () => alive && setState(s => (s[u] === false ? s : { ...s, [u]: false }));
      img.src = u;
      imgs.push(img);
    }
    return () => { alive = false; imgs.forEach(i => { i.onload = null; i.onerror = null; }); };
  }, [key]);
  return state;
}

interface Props {
  brand: Brand;
  onClose?: () => void;
  allBrands?: Brand[];
  onSelectBrand?: (brand: Brand) => void;
  isPage?: boolean;
}

// ⚠️ globals.css 의 .card-preview 와 **같은 값을 유지**한다.
// 2026-08-18 에 그리드 격자만 진하게 고쳤더니 상세 페이지는 옛 색으로
// 남아 흰 로고가 여기서만 배경에 묻혔다. 한쪽만 고치면 반드시 어긋난다.
const CHECKER: React.CSSProperties = {
  backgroundColor: "#f1f1f2",
  backgroundImage: `
    linear-gradient(rgba(0,0,0,0.10) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,0,0,0.10) 1px, transparent 1px)
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

/** 매니페스트의 provider 는 내부 식별자다 — 사용자에게는 읽을 수 있는 이름으로 */
const PROVIDER_LABEL: Record<string, string> = {
  official: "공식 자산",
  wikimedia: "위키미디어",
  "simple-icons": "Simple Icons",
  simpleicons: "Simple Icons",
  "gilbarbara-logos": "gilbarbara/logos",
  iconify: "Iconify",
  wvl: "WorldVectorLogo",
  devicons: "Devicons",
  "font-awesome": "Font Awesome",
  "logo.dev": "logo.dev",
  derived: "원본에서 자동 추출",
  "project-scan": "프로젝트 에셋",
};
function providerLabel(p?: string): string {
  const key = (p ?? "").split(":")[0];
  return PROVIDER_LABEL[key] ?? key;
}

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

async function generateInverted(src: string): Promise<string | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || 800;
        canvas.height = img.naturalHeight || 800;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imageData.data;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] > 10) {
            d[i]     = 255 - d[i];
            d[i + 1] = 255 - d[i + 1];
            d[i + 2] = 255 - d[i + 2];
          }
        }
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function toast(msg: string) {
  if (typeof document === "undefined") return;
  const el = document.createElement("div");
  el.textContent = msg;
  el.style.cssText = "position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:#18181b;color:#f4f4f5;padding:10px 20px;border-radius:10px;font-size:13px;z-index:9999;border:1px solid #3f3f46;box-shadow:0 8px 32px rgba(0,0,0,.5);animation:toastIn .18s ease";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

/* 로고 프리뷰 박스 — 일정 패딩 내에서 채우기 */
function LogoBox({
  src, alt, height, padding = 20, bg = "white", fallback, children,
}: {
  src: string; alt: string; height: number; padding?: number;
  bg?: "white" | "checker" | "dark" | "transparent"; fallback?: string;
  children?: React.ReactNode;
}) {
  const bgStyle: React.CSSProperties =
    bg === "checker"      ? CHECKER :
    bg === "dark"         ? { background: "#111114" } :
    bg === "transparent"  ? { background: "transparent" } :
                            { background: "#ffffff" };

  return (
    <div style={{ position: "relative", height, overflow: "hidden", ...bgStyle }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        style={{
          position: "absolute",
          top: padding, right: padding, bottom: padding, left: padding,
          width: `calc(100% - ${padding * 2}px)`,
          height: `calc(100% - ${padding * 2}px)`,
          objectFit: "contain",
          objectPosition: "center",
        }}
        onError={fallback ? (e) => { e.currentTarget.src = fallback; } : undefined}
      />
      {children}
    </div>
  );
}

export default function BrandInner({ brand, onClose, allBrands = [], onSelectBrand, isPage = false }: Props) {
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
  const [invertedUrl, setInvertedUrl] = useState<string | null>(null);

  const cdnUrl = (file: string) => `${CDN}/${brand.id}/${file}?v=${VERSION}`;
  const svgUrl  = cdnUrl("logo.svg");
  const pngUrl  = cdnUrl("logo.png");
  const darkUrl = cdnUrl("logo-transparent.png");
  const whiteUrl = cdnUrl("logo-white.png");
  const hasSvg = !!(brand.logo_svg || brand.has_svg);
  // 예전엔 PNG 칩이 무조건 참이었다. 실제로는 logo.png 가 없는 브랜드가 있었고
  // (신규 수집분 231개 전부) PNG 다운로드 버튼이 404 를 받고 있었다.
  const hasPng = !!(brand.logo_png || brand.has_png);

  /**
   * 흰색·아주 밝은 로고는 밝은 배경에서 보이지 않는다.
   * 목록 카드는 이미 어두운 배경으로 처리했는데 모달 안쪽은 그대로여서
   * 프리뷰·썸네일이 전부 비어 보였다 (Rolldown·Vite 등). 같은 규칙을 적용한다.
   * slim 은 `light`, brands.json 은 `light_logo` 로 실어 보낸다.
   */
  const isLightLogo = !!(brand.light || brand.light_logo);
  const DARK_TILE: React.CSSProperties = { background: "#18181b", backgroundImage: "none" };
  /** 밝은 로고면 어두운 타일, 아니면 원래 배경 */
  const tile = (base?: React.CSSProperties): React.CSSProperties =>
    isLightLogo ? DARK_TILE : (base ?? {});
  /** 변형 하나가 흰색이면 브랜드가 밝든 아니든 어두운 타일이어야 한다.
   *  흰 로고를 밝은 체커보드에 얹으면 빈 칸으로 보인다 — 팬이지에서 '화이트'
   *  4종이 전부 안 보여 파일이 깨진 것처럼 읽혔다 (2026-08-26). */
  const variantTile = (v: { key: string; color?: string }): React.CSSProperties =>
    (v.color === "white" || /(^|[-_])white$/.test(v.key)) ? DARK_TILE : tile(CHECKER);
  const mainUrl = hasSvg ? svgUrl : pngUrl;
  // 정본 브랜드 페이지 주소. 예전엔 `${origin}/#${brand.id}` 라 홈으로 보내놓고
  // 해시로 모달을 여는 링크였다 — 사이트맵·canonical 과 다른 주소를 공유하던 셈이다.
  //
  // window 를 쓰지 않는다. 이 값을 **화면에 렌더**하기 시작하면서
  // 서버(빈 문자열) ↔ 클라이언트(실제 URL) 가 어긋나 React #418
  // (하이드레이션 텍스트 불일치) 가 났다. 빌드 시점 상수로 고정한다.
  const pageUrl = `${SITE_URL}/brand/${brand.id}/`;

  const relations = (BRAND_RELATIONS[brand.id] || []).flatMap(rel => {
    const related = allBrands.find(b => b.id === rel.relatedId);
    return related ? [{ ...rel, brand: related }] : [];
  });

  // 변형 매니페스트 — 없으면 null 이고, 아래에서 기존 고정 목록으로 폴백한다
  const [manifest, setManifest] = useState<VariantManifest | null>(null);
  useEffect(() => {
    let alive = true;
    fetchVariants(brand.id).then(m => { if (alive) setManifest(m); });
    return () => { alive = false; };
  }, [brand.id]);

  /**
   * 매니페스트가 있으면 그것이 곧 '존재 증명'이다 — 디스크에서 생성했으므로
   * 목록에 있는 파일은 반드시 있다. 그래서 이미지 프로브가 필요 없다.
   * 매니페스트가 없는 브랜드만 기존 프로브 방식으로 동작한다.
   */
  const fallbackVariants = VARIANTS.filter(v => {
    if (v.svgOnly && !hasSvg) return false;
    if (v.langEn && !brand.lang_en) return false;
    return true;
  });

  // 매니페스트는 SVG 변형(형태별)을 맡고, 아래 그리드는 래스터 파생물
  // (파비콘·투명·화이트·800px)을 맡는다. 매니페스트에 없는 파일이므로
  // 이쪽은 계속 이미지 프로브로 존재를 확인한다.
  const gridCandidates = manifest
    ? fallbackVariants.filter(v => !v.file.endsWith(".svg"))
    : fallbackVariants;
  const probeUrls = [...gridCandidates.map(v => cdnUrl(v.file)), pngUrl, mainUrl];
  const avail = useAvailability(probeUrls);
  const isReady = (url: string) => avail[url] !== false;   // 확인 중이면 일단 보여줌
  const variants = gridCandidates.filter(v => isReady(cdnUrl(v.file)));

  /** 매니페스트 변형을 형태별 섹션으로 묶는다 (대표 → 가로 → 세로 → 심볼 → 워드마크) */
  const sections = manifest
    ? Object.entries(
        manifest.variants.reduce<Record<string, VariantRecord[]>>((acc, v) => {
          (acc[v.label] ||= []).push(v);
          return acc;
        }, {})
      ).sort((a, b) => (a[1][0].order ?? 99) - (b[1][0].order ?? 99))
    : [];

  // 언어 탭은 unknown 이 아닌 언어가 2개 이상일 때만 의미가 있다
  const langs = manifest
    ? Array.from(new Set(manifest.variants.map(v => v.lang).filter(l => l === "ko" || l === "en")))
    : [];
  const [langFilter, setLangFilter] = useState<string | null>(null);

  // 영문 버전 보유 여부는 변형 매니페스트가 정답이다. 예전엔 brand.lang_en 을
  // 봤는데 그 플래그를 가진 브랜드가 사실상 없어서, 영문 로고가 실제로 있어도
  // "✗ 영문 버전" 이라고 잘못 말했다.
  const hasEn = manifest ? langs.includes("en") : !!brand.lang_en;

  const grab = useCallback(async (url: string, filename: string) => {
    const ok = await downloadFile(url, filename);
    if (!ok) window.open(url, "_blank", "noopener,noreferrer");
    trackEvent("logo_downloaded", { brand_id: brand.id, file_name: filename, download_method: ok ? "download" : "new_tab" });
    sendHit(brand.id, "download");
  }, [brand.id]);

  useEffect(() => {
    if (isPage) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [isPage, onClose]);

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
    loadQuality(brand.id).then(setQuality);
    setMyQualityVote(getMyVote(brand.id));
  }, [brand.id]);

  useEffect(() => {
    setInvertedUrl(null);
    analyzeLogoVisibility(
      brand.id,
      `${CDN}/${brand.id}/logo.png`,
      `${CDN}/${brand.id}/logo-transparent.png`,
    ).then(async result => {
      setVisibility(result);
      if (result.darkMode === "white-only") {
        const transparentSrc = `${CDN}/${brand.id}/logo-transparent.png?v=${VERSION}`;
        const pngSrc = `${CDN}/${brand.id}/logo.png?v=${VERSION}`;
        const inv = await generateInverted(transparentSrc) ?? await generateInverted(pngSrc);
        setInvertedUrl(inv);
      }
    });
    const img = new Image();
    img.onload = () => setHasWhiteLogo(true);
    img.onerror = () => setHasWhiteLogo(false);
    img.src = `${CDN}/${brand.id}/logo-white.png?v=${VERSION}`;
  }, [brand.id]);

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
    if (!getClientAuth().currentUser) { toast("추천하려면 로그인해 주세요"); return; }
    if (votedFiles.includes(file)) { toast("이미 투표했어요"); return; }
    const key = fk(file);
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
      setVotes(prev => ({ ...prev, [key]: Math.max(0, (prev[key] || 1) - 1) }));
      setVotedFiles(votedFiles);
      localStorage.setItem(`voted_${brand.id}`, JSON.stringify(votedFiles));
      toast("저장 실패. 다시 시도해주세요");
    }
  }, [brand.id, votedFiles, appendFeed]);

  const requestSwap = useCallback(async (file: string, label: string) => {
    if (!getClientAuth().currentUser) { toast("교체를 요청하려면 로그인해 주세요"); return; }
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

  // 공유 — 예전엔 '퍼가기' · '로고 URL만 복사' · '코드 복사' 버튼 3개가
  // 두 섹션에 흩어져 있었다. 셋 다 "클립보드에 담는다"는 같은 동작이라
  // 서로 중복돼 보였고 사이드바 세로 공간도 많이 먹었다.
  // 무엇을 복사할지만 고르게 하고 실행 버튼은 하나로 합친다.
  const SHARE_TABS = [
    { key: "page",  label: "페이지" },
    { key: "image", label: "이미지" },
    { key: "html",  label: "HTML" },
  ] as const;
  type ShareTab = (typeof SHARE_TABS)[number]["key"];
  const [shareTab, setShareTab] = useState<ShareTab>("page");

  const embedCode = `<img src="${mainUrl}" alt="${brand.name_ko}" style="height:40px">`;
  const shareValue = shareTab === "page" ? pageUrl : shareTab === "image" ? mainUrl : embedCode;

  /** 헤더의 빠른 퍼가기 — 사이드바 탭과 무관하게 **항상 페이지 링크**를 복사한다.
   *  (공유 UI 통합 때 이 버튼까지 탭을 따라가서, 누를 때마다 다른 게
   *   복사되는 상태였다) */
  const copyPageLink = useCallback(async () => {
    navigator.clipboard.writeText(pageUrl).catch(() => {});
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 1800);
    appendFeed({ emoji: myEmoji(), ts: Date.now() });
    toast("퍼가기 완료! 링크 복사됨 🎉");
  }, [pageUrl, appendFeed]);

  const doShare = useCallback(async () => {
    navigator.clipboard.writeText(shareValue).catch(() => {});
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 1800);
    // 활동 피드는 '페이지 퍼가기'일 때만 쌓는다 — URL·코드 복사는 개인 작업이라
    // 남에게 보여줄 활동이 아니다.
    if (shareTab === "page") appendFeed({ emoji: myEmoji(), ts: Date.now() });
    toast(shareTab === "page" ? "퍼가기 완료! 링크 복사됨 🎉"
        : shareTab === "image" ? "로고 URL 복사됨! 🖼"
        : "임베드 코드 복사됨!");
  }, [brand.id, shareValue, shareTab, appendFeed]);

  const castQualityVote = useCallback(async (vote: "up" | "down") => {
    if (!getClientAuth().currentUser) { toast("품질 평가를 남기려면 로그인해 주세요"); return; }
    if (myQualityVote) { toast(myQualityVote === vote ? "이미 투표했어요" : "투표는 한 번만 할 수 있어요"); return; }
    try {
      const result = await voteQuality(brand.id, vote, brand.name_ko || brand.name_en);
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

  /* ─────────── 레이아웃 스타일 ─────────── */
  const containerStyle: React.CSSProperties = isPage
    ? { width: "100%", maxWidth: 1400, margin: "0 auto", display: "flex", flexDirection: "column", background: "#ffffff" }
    : { position: "relative", display: "flex", flexDirection: "column", width: "90vw", maxWidth: 1400, height: "90vh", background: "#ffffff", border: "1px solid #e4e4e7", borderRadius: 20, boxShadow: "0 24px 80px rgba(0,0,0,.15)", animation: "modalIn .18s ease" };

  const darkPreviewSrc = hasWhiteLogo && visibility?.darkMode !== "white-only"
    ? whiteUrl
    : getDarkPreviewUrl(visibility, darkUrl, mainUrl);

  return (
    <div style={containerStyle} onClick={e => e.stopPropagation()}>
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
        @media (max-width: 768px) {
          .brand-inner-body { grid-template-columns: 1fr !important; }
          .brand-inner-left { border-right: none !important; border-bottom: 1px solid #e4e4e7; }
          .brand-inner-right { border-left: none !important; border-top: 1px solid #e4e4e7; }
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 20px", borderBottom:"1px solid #e4e4e7", flexShrink:0, flexWrap:"wrap" }}>
        <div style={{ flex:1, minWidth:0 }}>
          {/* 검색엔진이 페이지 주제를 잡는 가장 강한 신호다. 예전엔 h2 뿐이라
              h1 이 아예 없었다 — '삼성화재 로고'로 검색했을 때 잡힐 근거가
              title·description 에만 있었다.
              보이는 글자는 그대로 두고(브랜드명), 검색어 형태('OO 로고')는
              화면에 안 보이는 텍스트로 덧붙인다. */}
          <h1 style={{ fontSize:17, fontWeight:700, color:"#111111", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", margin:0 }}>
            {brand.name_ko}{brand.name_en && brand.name_en !== brand.name_ko ? ` / ${brand.name_en}` : ""}
            <span style={{ position:"absolute", width:1, height:1, padding:0, margin:-1,
                           overflow:"hidden", clip:"rect(0 0 0 0)", whiteSpace:"nowrap", border:0 }}>
              {` ${brand.name_ko} 로고 SVG PNG 다운로드`}
            </span>
          </h1>
          <p style={{ fontSize:12, color:"#71717a", marginTop:2 }}>{brand.category}</p>
          {/* 검색용 요약. 4만 페이지가 전부 같은 틀이면 '얇은 콘텐츠'로 분류돼
              색인에서 빠진다. 이 브랜드만 아는 사실(시장·업종·종목코드·형태·
              보유 형식)로 페이지마다 다른 문장을 만든다. */}
          {/* 검색엔진용. 화면에는 안 보이지만 HTML 에는 남는다 —
              헤더가 4줄이 되면 정작 로고가 밀린다. 크롤러는 읽는다. */}
          <p style={{ position:"absolute", width:1, height:1, padding:0, margin:-1,
                      overflow:"hidden", clip:"rect(0 0 0 0)", whiteSpace:"nowrap", border:0 }}>
            {[
              `${brand.name_ko}${brand.name_en && brand.name_en !== brand.name_ko ? `(${brand.name_en})` : ""}의 공식 로고입니다.`,
              brand.krx_market ? `${brand.krx_market} 상장${brand.krx_code ? ` (${brand.krx_code})` : ""}${brand.krx_sector ? ` · ${brand.krx_sector}` : ""}.` : null,
              brand.kr_kind ? `${brand.kr_kind}입니다.` : null,
              brand.category ? `${brand.category} 분야.` : null,
              brand.has_svg
                ? "SVG 벡터 원본을 제공해 어떤 크기로 확대해도 깨지지 않습니다."
                : "PNG 고해상도 파일을 제공합니다.",
              "파비콘·투명 배경·화이트 버전도 함께 내려받을 수 있습니다.",
              brand.website || brand.domain ? `공식 사이트: ${brand.domain || brand.website}` : null,
            ].filter(Boolean).join(" ")}
          </p>

        </div>

          {/* 홈페이지 → 투표 → 퍼가기 → 닫기 순. 도메인을 글자로만 두면
              사용자가 주소를 눈으로 옮겨 적어야 한다.
              ⚠️ website 가 있으면 그대로 쓴다 — 야화처럼 특정 경로를
                 가리키는 경우가 있어(yahwabar.com/r/d) 도메인으로 다시
                 만들면 안 된다. */}
          {(brand.website || brand.domain) && (
            <a
              href={brand.website && /^https?:\/\//.test(brand.website)
                ? brand.website
                : `https://${String(brand.website || brand.domain).replace(/^https?:\/\//, "")}`}
              target="_blank" rel="noopener noreferrer nofollow"
              title={`${brand.name_ko} 공식 홈페이지로 이동`}
              style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"5px 12px",
                       background:"#f4f4f5", border:"1px solid #e4e4e7", color:"#52525b",
                       borderRadius:8, fontSize:12, fontWeight:500, textDecoration:"none",
                       flexShrink:0 }}
            >
              🔗 홈페이지
            </a>
          )}
          {/* 품질 투표 — 헤더 오른쪽으로. 왼쪽에 두면 브랜드명 아래 줄이
              하나 더 생겨 헤더가 4줄이 된다. */}
        <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:7 }}>
        <button onClick={() => castQualityVote("up")} title="좋은 로고예요"
        style={{ display:"inline-flex", alignItems:"center", gap:3, padding:"3px 9px", borderRadius:20, fontSize:11, fontWeight:600, cursor: myQualityVote ? "default" : "pointer", transition:"all .15s", background: myQualityVote === "up" ? "rgba(34,197,94,.12)" : "#f4f4f5", border:`1px solid ${myQualityVote === "up" ? "rgba(34,197,94,.4)" : "#e4e4e7"}`, color: myQualityVote === "up" ? "#16a34a" : "#71717a", opacity: myQualityVote && myQualityVote !== "up" ? .45 : 1 }}>
        👍 {quality.up > 0 ? quality.up : ""}
        </button>
        <button onClick={() => castQualityVote("down")} title="교체가 필요해요"
        style={{ display:"inline-flex", alignItems:"center", gap:3, padding:"3px 9px", borderRadius:20, fontSize:11, fontWeight:600, cursor: myQualityVote ? "default" : "pointer", transition:"all .15s", background: myQualityVote === "down" ? "rgba(239,68,68,.1)" : "#f4f4f5", border:`1px solid ${myQualityVote === "down" ? "rgba(239,68,68,.35)" : "#e4e4e7"}`, color: myQualityVote === "down" ? "#dc2626" : "#71717a", opacity: myQualityVote && myQualityVote !== "down" ? .45 : 1 }}>
        🚩 교체 필요 {quality.down > 0 ? quality.down : ""}
        </button>
        {quality.flagged && (
        <span style={{ fontSize: 11, fontWeight:700, color:"#dc2626", background:"rgba(239,68,68,.08)", border:"1px solid rgba(239,68,68,.2)", borderRadius:10, padding:"2px 6px" }}>검토 필요</span>
        )}
        </div>
        <button onClick={copyPageLink} className="sharebtn"
          style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 12px", background:"#f4f4f5", border:"1px solid #e4e4e7", color:"#52525b", borderRadius:8, fontSize:12, fontWeight:500, cursor:"pointer", transition:"all .15s", flexShrink:0 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          {copyDone ? "복사됨!" : "퍼가기"}
        </button>

        {/* 페이지 모드: 홈 링크 / 모달 모드: X 버튼 */}
        {isPage ? (
          <Link href="/" style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 12px", background:"#f4f4f5", border:"1px solid #e4e4e7", color:"#52525b", borderRadius:8, fontSize:12, fontWeight:500, textDecoration:"none", flexShrink:0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6"/></svg>
            홈으로
          </Link>
        ) : (
          <button onClick={onClose} style={{ background:"#f4f4f5", border:"1px solid #e4e4e7", color:"#52525b", width:32, height:32, borderRadius:8, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        )}
      </div>

      {/* ── 연관기업 바 ── */}
      {relations.length > 0 && (
        <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 20px", borderBottom:"1px solid #e4e4e7", background:"#fafafa", flexShrink:0, flexWrap:"wrap" }}>
          <span style={{ fontSize: 11, fontWeight:700, color:"#a1a1aa", letterSpacing:".06em", textTransform:"uppercase", flexShrink:0 }}>연관기업</span>
          {relations.map(rel => {
            const clr = RELATION_COLOR[rel.type];
            const relLogoUrl = `${CDN}/${rel.brand.id}/logo.png?v=${VERSION}`;
            return (
              <button key={rel.brand.id} onClick={() => onSelectBrand?.(rel.brand)} disabled={!onSelectBrand}
                style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 10px 4px 6px", background:clr.bg, border:`1px solid ${clr.border}`, borderRadius:20, cursor:onSelectBrand?"pointer":"default", transition:"opacity .15s" }}
                onMouseEnter={e => { if (onSelectBrand) e.currentTarget.style.opacity=".75"; }}
                onMouseLeave={e => { e.currentTarget.style.opacity="1"; }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={relLogoUrl} alt="" style={{ width:18, height:18, objectFit:"contain", flexShrink:0 }} onError={e => { e.currentTarget.style.display="none"; }} />
                <span style={{ fontSize: 11, fontWeight:700, color:clr.color }}>{RELATION_LABEL[rel.type]}</span>
                <span style={{ fontSize:11, fontWeight:600, color:clr.color }}>{rel.brand.name_ko}</span>
                {rel.note && <span style={{ fontSize: 11, color:clr.color, opacity:.7 }}>{rel.note}</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* ── 3-column body ── */}
      <div
        className="brand-inner-body"
        style={{
          flex: isPage ? undefined : 1,
          overflow: isPage ? undefined : "hidden",
          display: "grid",
          gridTemplateColumns: "220px 1fr 300px",
        }}
      >
        {/* ── LEFT: 미리보기 + 형식 + 빠른다운 ── */}
        <div className={`mscroll brand-inner-left`} style={{ overflowY: isPage ? undefined : "auto", padding:"20px 16px", borderRight:"1px solid #e4e4e7", display:"flex", flexDirection:"column", gap:16, scrollbarWidth:"thin" }}>

          {/* 메인 프리뷰 */}
          <div style={{ border:"1px solid #f0f0f2", borderRadius:8, overflow:"hidden", position:"relative" }}>
            <LogoBox src={mainUrl} alt={brand.name_ko} height={128} padding={16} bg={isLightLogo ? "dark" : "white"} fallback={pngUrl} />
            {brand.original_ai_url && (
              <a href={brand.original_ai_url} target="_blank" rel="noopener noreferrer"
                style={{ position:"absolute", bottom:6, right:6, display:"inline-flex", alignItems:"center", gap:3, padding:"2px 7px", background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:10, fontSize: 11, fontWeight:700, color:"#2563eb", textDecoration:"none", letterSpacing:".04em" }}>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                공식
              </a>
            )}
          </div>

          {/* 다크 프리뷰 */}
          <div style={{ borderRadius:8, overflow:"hidden" }}>
            <div style={{ ...(invertedUrl ? { background:"#111114" } : getDarkPreviewStyle(visibility)), position:"relative", height:72 }}>
              <LogoBox src={invertedUrl || darkPreviewSrc} alt={brand.name_ko} height={72} padding={12} bg="transparent" fallback={mainUrl} />
              {visibility && (
                <span style={{ position:"absolute", bottom:4, left:0, right:0, textAlign:"center", fontSize: 11, color:"#71717a", letterSpacing:".06em", textTransform:"uppercase", opacity:.8 }}>
                  {invertedUrl ? "흑백 반전 (다크용)" : getDarkPreviewLabel(visibility) + (hasWhiteLogo && visibility.darkMode !== "white-only" ? " · 화이트" : "")}
                </span>
              )}
            </div>
          </div>

          {/* 사용 미리보기 */}
          <div>
            <div style={{ fontSize: 11, fontWeight:700, color:"#71717a", letterSpacing:".08em", textTransform:"uppercase", marginBottom:10 }}>사용 미리보기</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
              {[
                { label:"OG 16:9", style:{ width:"100%", aspectRatio:"16/9", background: isLightLogo ? "#18181b" : "#f0f0f0", borderRadius:4, overflow:"hidden", position:"relative" } as React.CSSProperties },
                { label:"파비콘",  style:{ width:28, height:28, background: isLightLogo ? "#18181b" : "#e4e4e7", borderRadius:4, overflow:"hidden", position:"relative" } as React.CSSProperties },
                { label:"앱 아이콘", style:{ width:46, height:46, background: isLightLogo ? "#18181b" : "#e4e4e7", borderRadius:10, overflow:"hidden", position:"relative" } as React.CSSProperties },
              ].map(m => (
                <div key={m.label} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5 }}>
                  <div style={m.style}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={hasSvg ? svgUrl : darkUrl} alt="" style={{ position:"absolute", inset:"10%", width:"80%", height:"80%", objectFit:"contain", objectPosition:"center" }} onError={e => { e.currentTarget.src = pngUrl; }} />
                  </div>
                  <span style={{ fontSize: 11, color:"#71717a", textAlign:"center" }}>{m.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 보유 형식 */}
          <div>
            <div style={{ fontSize: 11, fontWeight:700, color:"#71717a", letterSpacing:".08em", textTransform:"uppercase", marginBottom:10 }}>보유 형식</div>
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              {[{ label:"SVG 벡터", ok:hasSvg }, { label:"PNG", ok:hasPng }, { label:"영문 버전", ok:hasEn }].map(({ label, ok }) => (
                <span key={label} style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"4px 10px", borderRadius:20, fontSize:11, fontWeight:600, background:ok?"rgba(34,197,94,0.12)":"#f4f4f5", color:ok?"#22c55e":"#71717a", border:`1px solid ${ok?"rgba(34,197,94,0.2)":"#e4e4e7"}` }}>
                  {ok ? "✓" : "✗"} {label}
                </span>
              ))}
            </div>
          </div>

          {/* 빠른 다운로드 */}
          <div style={{ display:"flex", flexDirection:"column", gap:7, marginTop:"auto" }}>
            <a href={mainUrl} download={`${brand.id}-logo.${hasSvg ? "svg" : "png"}`}
              onClick={e => { e.preventDefault(); grab(mainUrl, `${brand.id}-logo.${hasSvg ? "svg" : "png"}`); }}
              style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, padding:"9px 0", borderRadius:8, fontSize:12, fontWeight:600, background:"#6366f1", color:"#fff", textDecoration:"none", cursor:"pointer" }}>
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
              {hasSvg ? "SVG" : "PNG"} 다운로드
            </a>
            {hasSvg && isReady(pngUrl) && (
              <a href={pngUrl} download={`${brand.id}-logo.png`}
                onClick={e => { e.preventDefault(); grab(pngUrl, `${brand.id}-logo.png`); }}
                style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:"9px 0", borderRadius:8, fontSize:12, fontWeight:600, background:"#f4f4f5", color:"#52525b", textDecoration:"none", border:"1px solid #e4e4e7", cursor:"pointer" }}>
                ↓ PNG 다운로드
              </a>
            )}
            {invertedUrl && (
              <a href={invertedUrl} download={`${brand.id}-logo-dark.png`}
                      onClick={e => { e.preventDefault(); grab(invertedUrl, `${brand.id}-logo-dark.png`); }}
                style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:5, padding:"9px 0", borderRadius:8, fontSize:12, fontWeight:600, background:"#111114", color:"#a78bfa", textDecoration:"none", border:"1px solid #3f3f46" }}>
                🌙 반전 PNG (다크용)
              </a>
            )}
          </div>
        </div>

        {/* ── MID: 인트로 + 변형 그리드 ── */}
        <div className="mscroll" style={{ overflowY: isPage ? undefined : "auto", padding:"22px 24px", scrollbarWidth:"thin" }}>
          {/* 인트로 라이트/다크 — 배경별로 어떻게 보이는지 확인용 */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", borderRadius:12, overflow:"hidden", height:132, marginBottom:16 }}>
            <LogoBox src={mainUrl} alt={brand.name_ko} height={132} padding={18} bg={isLightLogo ? "dark" : "white"} fallback={pngUrl} />
            <div style={{ ...(invertedUrl ? { background:"#111114" } : getDarkPreviewStyle(visibility)), position:"relative", height:132 }}>
              {/* 다크 배경에는 SVG 를 그대로 쓴다.
                  logo-transparent.png 는 remove_white_bg() 로 만들어져 안티앨리어싱
                  가장자리에 흰 테두리가 남는다. 어두운 배경에서 그게 후광처럼 보여
                  로고가 깨져 보였다. SVG 는 진짜 투명이라 그런 잔상이 없다. */}
              <LogoBox
                src={invertedUrl || (hasSvg ? mainUrl : getDarkPreviewUrl(visibility, darkUrl, mainUrl))}
                alt={brand.name_ko} height={132} padding={20} bg="transparent" fallback={mainUrl} />
              {visibility && (
                <span style={{ position:"absolute", bottom:6, left:0, right:0, textAlign:"center", fontSize: 11, letterSpacing:".06em", textTransform:"uppercase", opacity:.6, color: invertedUrl ? "#71717a" : (visibility.darkMode === "white-only" ? "#52525b" : "#a1a1aa") }}>
                  {invertedUrl ? "흑백 반전" : getDarkPreviewLabel(visibility)}
                </span>
              )}
            </div>
          </div>

          {/* ── 로고 변형 갤러리 (매니페스트 기반) ── */}
          {sections.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
                <div style={{ fontSize:13, fontWeight:700, color:"#3f3f46" }}>
                  로고 변형{" "}
                  <span style={{ fontSize:11, fontWeight:400, color:"#71717a" }}>
                    {manifest!.variants.length}종 · SVG·PNG 각각 받기
                  </span>
                </div>
                {langs.length >= 2 && (
                  <div style={{ display:"flex", gap:4 }}>
                    {[null, ...langs].map(l => (
                      <button key={l ?? "all"} onClick={() => setLangFilter(l)}
                        style={{ fontSize:11, padding:"3px 9px", borderRadius:12, cursor:"pointer",
                          border:`1px solid ${langFilter === l ? "#6366f1" : "#e4e4e7"}`,
                          background: langFilter === l ? "rgba(99,102,241,.08)" : "transparent",
                          color: langFilter === l ? "#6366f1" : "#71717a" }}>
                        {l === null ? "전체" : l === "ko" ? "한글" : "영문"}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {sections.map(([label, items]) => {
                const shown = langFilter
                  ? items.filter(v => v.lang === langFilter || v.lang === "none")
                  : items;
                if (shown.length === 0) return null;
                return (
                  <div key={label} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:"#71717a", marginBottom:6,
                      letterSpacing:".04em" }}>
                      {label}
                      <span style={{ marginLeft:6, fontWeight:400, color:"#a1a1aa" }}>{shown.length}종</span>
                    </div>
                    {/* 가로 행 리스트.
                        예전엔 minmax(170px,1fr) 카드 그리드였는데, 모달 가운데 폭이
                        좁아서 한 줄에 한 장씩만 들어가 세로로 길어졌고, 그 아래
                        '가공 파일' 이 화면 밖으로 밀려났다. 행으로 바꾸면 줄바꿈이
                        없어 항목 수와 무관하게 목록 전체가 보인다. 모바일도 같다. */}
                    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                      {shown.map(v => {
                        const svgFile = v.files.svg;
                        const pngFile = v.files.png;
                        const previewUrl = cdnUrl(svgFile || pngFile || "logo.png");
                        return (
                          <div key={v.key} style={{ display:"flex", alignItems:"center", gap:10,
                            background:"#fafafa", border:"1px solid #e4e4e7", borderRadius:8,
                            padding:"7px 9px" }}>
                            <div style={{ position:"relative", width:56, height:38, flexShrink:0,
                              borderRadius:5, overflow:"hidden", ...variantTile(v) }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={previewUrl} alt={v.label}
                                style={{ position:"absolute", inset:4, width:"calc(100% - 8px)",
                                  height:"calc(100% - 8px)", objectFit:"contain" }}
                                onError={e => { e.currentTarget.style.display = "none"; }} />
                            </div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:11.5, fontWeight:600, color:"#3f3f46",
                                display:"flex", alignItems:"center", gap:5 }}>
                                <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                                  {v.label}
                                </span>
                                {v.origin === "derived" && (
                                  <span style={{ flexShrink:0, fontSize: 11, fontWeight:700, color:"#6366f1",
                                    background:"#eef2ff", border:"1px solid #c7d2fe", borderRadius:9,
                                    padding:"0 5px" }}>자동 추출</span>
                                )}
                              </div>
                              <div style={{ fontSize: 11, color:"#a1a1aa", marginTop:1,
                                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                                {providerLabel(v.provider)}
                                {v.alts?.length ? ` · 소스 ${v.alts.length + 1}종` : ""}
                              </div>
                            </div>
                            <div style={{ display:"flex", gap:5, flexShrink:0 }}>
                              {svgFile && (
                                <button onClick={() => grab(cdnUrl(svgFile), `${brand.id}-${v.key}.svg`)}
                                  style={{ fontSize:11, padding:"5px 11px", borderRadius:6, border:"none",
                                    background:"#6366f1", color:"#fff", cursor:"pointer", fontWeight:500 }}>
                                  SVG
                                </button>
                              )}
                              {pngFile && (
                                <button onClick={() => grab(cdnUrl(pngFile), `${brand.id}-${v.key}.png`)}
                                  style={{ fontSize:11, padding:"5px 11px", borderRadius:6,
                                    border:"1px solid #e4e4e7", background:"#fff", color:"#52525b",
                                    cursor:"pointer", fontWeight:500 }}>
                                  PNG
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 변형 그리드 */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#3f3f46" }}>
              {manifest ? "가공 파일" : "파일 다운로드"}{" "}
              <span style={{ fontSize:11, fontWeight:400, color:"#71717a" }}>
                {manifest ? "파비콘 · 투명 배경 · 고해상도" : "메인 로고 기준"}
              </span>
            </div>
            <span style={{ fontSize: 11, color:"#a1a1aa" }}>👍 추천 · 🔄 교체 요청</span>
          </div>
          {/* 좁은 컬럼에서도 2열이 들어가도록 최소폭을 줄였다.
              160px 이면 모달 가운데 폭에서 1열이 돼 세로로 길어진다. */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(112px,1fr))", gap:8 }}>
            {invertedUrl && (
              <div style={{ background:"#111114", border:"1px solid #3f3f46", borderRadius:8, overflow:"hidden" }}>
                <div style={{ position:"relative", height:110, background:"#111114" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={invertedUrl} alt="반전 PNG"
                    style={{ position:"absolute", top:14, right:14, bottom:14, left:14, width:"calc(100% - 28px)", height:"calc(100% - 28px)", objectFit:"contain", objectPosition:"center" }} />
                  <span style={{ position:"absolute", top:5, right:5, fontSize: 11, fontWeight:700, color:"#a78bfa", background:"rgba(99,102,241,.2)", border:"1px solid rgba(99,102,241,.3)", borderRadius:10, padding:"1px 5px" }}>다크용</span>
                </div>
                <div style={{ padding:"8px 10px", borderTop:"1px solid #3f3f46", background:"#1c1c1e" }}>
                  <div style={{ fontSize:11, fontWeight:600, color:"#e4e4e7" }}>반전 PNG</div>
                  <div style={{ fontSize: 11, color:"#71717a", marginTop:1 }}>다크 배경용 흰색 반전</div>
                  <div style={{ marginTop:8 }}>
                    <a href={invertedUrl} download={`${brand.id}-logo-dark.png`}
                      onClick={e => { e.preventDefault(); grab(invertedUrl, `${brand.id}-logo-dark.png`); }}
                      style={{ display:"block", fontSize:11, padding:"5px 0", borderRadius:6, background:"#6366f1", color:"#fff", textAlign:"center", textDecoration:"none", fontWeight:500 }}>
                      ↓ 다운로드
                    </a>
                  </div>
                </div>
              </div>
            )}
            {variants.map(v => {
              const url = cdnUrl(v.file);
              const key = fk(v.file);
              const voteCount = votes[key] || 0;
              const isVoted = votedFiles.includes(v.file);
              const isSwapTarget = swapTarget === v.file;
              return (
                <div key={v.file} style={{ background:"#fafafa", border:`1px solid ${isSwapTarget ? "#f59e0b" : "#e4e4e7"}`, borderRadius:8, overflow:"hidden", outline: isSwapTarget ? "2px solid #fde68a" : "none", outlineOffset:1 }}>
                  {/* 썸네일 — 동일 패딩으로 크기 정규화 */}
                  <div style={{ position:"relative", height:76, ...tile(bgStyle(v.bg)) }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={v.name}
                      style={{ position:"absolute", top:14, right:14, bottom:14, left:14, width:"calc(100% - 28px)", height:"calc(100% - 28px)", objectFit:"contain", objectPosition:"center" }}
                      onError={e => { e.currentTarget.style.display="none"; }}
                    />
                    {isSwapTarget && <span style={{ position:"absolute", top:5, right:5, fontSize: 11, fontWeight:700, color:"#f59e0b", background:"#fef3c7", border:"1px solid #fde68a", borderRadius:10, padding:"1px 5px" }}>교체 대기</span>}
                  </div>
                  <div style={{ padding:"8px 10px", borderTop:"1px solid #e4e4e7", background:"#fafafa" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                      <span style={{ fontSize:11, fontWeight:600, color:"#3f3f46", flex:1 }}>{v.name}</span>
                    </div>
                    <div style={{ fontSize: 11, color:"#71717a", marginTop:1 }}>{v.desc}</div>
                    <div style={{ display:"flex", gap:5, marginTop:8 }}>
                      <button onClick={() => castVote(v.file, v.name)} title={isVoted ? "이미 투표함" : "이 버전 추천"}
                        style={{ flex:1, background: isVoted ? "rgba(99,102,241,0.08)" : "transparent", border:`1px solid ${isVoted ? "#6366f1" : "#e4e4e7"}`, borderRadius:6, padding:"5px 0", fontSize:11, color: isVoted ? "#6366f1" : "#71717a", cursor:"pointer", transition:"all .15s", fontWeight: isVoted ? 600 : 400 }}>
                        👍 {voteCount > 0 ? voteCount : "—"}
                      </button>
                      <button onClick={() => requestSwap(v.file, v.name)} title="메인 로고로 교체 요청"
                        style={{ background: isSwapTarget ? "#fef3c7" : "transparent", border:`1px solid ${isSwapTarget ? "#f59e0b" : "#e4e4e7"}`, borderRadius:6, padding:"5px 8px", fontSize:11, color: isSwapTarget ? "#d97706" : "#71717a", cursor:"pointer", transition:"all .15s", flexShrink:0 }}>
                        {isSwapTarget ? "✅" : "🔄"}
                      </button>
                      <a href={url} download={`${brand.id}-${v.file}`}
                        onClick={e => { e.preventDefault(); grab(url, `${brand.id}-${v.file}`); }}
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
        <div className={`mscroll brand-inner-right`} style={{ overflowY: isPage ? undefined : "auto", borderLeft:"1px solid #e4e4e7", display:"flex", flexDirection:"column", scrollbarWidth:"thin" }}>

          {/* 공유 — 무엇을 복사할지 고르고 버튼 하나로 실행한다 */}
          <div style={{ padding:"14px 16px", borderBottom:"1px solid #e4e4e7" }}>
            <div style={{ fontSize: 11, fontWeight:700, color:"#71717a", letterSpacing:".08em", textTransform:"uppercase", marginBottom:10 }}>공유하기 🎉</div>

            {/* 무엇을 복사할지 */}
            <div style={{ display:"flex", gap:4, marginBottom:8 }}>
              {SHARE_TABS.map(t => {
                const on = shareTab === t.key;
                return (
                  <button key={t.key} onClick={() => setShareTab(t.key)}
                    style={{ flex:1, padding:"6px 0", borderRadius:7, fontSize:11, fontWeight:600, cursor:"pointer",
                             background: on ? "#111" : "#f4f4f5", color: on ? "#fff" : "#71717a",
                             border: `1px solid ${on ? "#111" : "#e4e4e7"}`, transition:"all .12s" }}>
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* 복사될 내용 — 실제로 뭐가 담기는지 보여준다 */}
            <div style={{ background:"#f9f9f9", border:"1px solid #e4e4e7", borderRadius:8, padding:"8px 10px",
                          fontFamily:"monospace", fontSize:11, color:"#71717a", lineHeight:1.6,
                          marginBottom:8, wordBreak:"break-all",
                          maxHeight:56, overflow:"hidden" }}>
              {shareValue}
            </div>

            <button onClick={doShare}
              style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                       padding:"9px 0", borderRadius:8, fontSize:12, fontWeight:600, cursor:"pointer",
                       background: copyDone ? "#16a34a" : "#6366f1", color:"#fff", border:"none", transition:"background .15s" }}>
              {copyDone ? "✅ 복사됐어요" : "📋 복사하기"}
            </button>

            {shareFeed.length > 0 && (
              <div style={{ marginTop:12 }}>
                <div style={{ fontSize: 11, fontWeight:700, color:"#71717a", letterSpacing:".06em", textTransform:"uppercase", marginBottom:5 }}>최근 활동</div>
                {shareFeed.slice(-6).map((s, i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:4, padding:"3px 0", borderBottom:"1px solid #f0f0f2" }}>
                    <span>{s.emoji}</span>
                    <span style={{ fontSize: 12, color:"#3f3f46", flex:1 }}>
                      {s.type === "vote" ? <><span style={{ color:"#6366f1" }}>"{s.label}"</span> 추천 👍</>
                       : s.type === "swap" ? <><span style={{ color:"#f59e0b" }}>"{s.label}"</span> 교체 요청 🔄</>
                       : "퍼가기 🎉"}
                    </span>
                    <span style={{ fontSize: 11, color:"#71717a" }}>{relTime(s.ts)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 제보 & 개선 */}
          <div style={{ padding:"14px 16px", borderBottom:"1px solid #e4e4e7" }}>
            <div style={{ fontSize: 11, fontWeight:700, color:"#71717a", letterSpacing:".08em", textTransform:"uppercase", marginBottom:10 }}>제보 &amp; 개선</div>
            <button onClick={() => setReportOpen(o => !o)}
              style={{ width:"100%", padding:"9px 0", borderRadius:8, fontSize:11, fontWeight:600, background:"#f4f4f5", color:"#52525b", border:"1px solid #e4e4e7", cursor:"pointer" }}>
              {reportOpen ? "↩ 접기" : "✉️ 더 좋은 버전 제보하기"}
            </button>
            {reportOpen && (
              <form onSubmit={handleReport} style={{ marginTop:12, paddingTop:12, borderTop:"1px solid #e4e4e7", display:"flex", flexDirection:"column", gap:7 }}>
                <textarea rows={2} placeholder="개선점 또는 출처 URL 메모"
                  value={reportMemo} onChange={e => setReportMemo(e.target.value)}
                  style={{ width:"100%", background:"#f9f9f9", border:"1px solid #e4e4e7", color:"#111111", padding:8, borderRadius:6, fontSize:11, resize:"none", fontFamily:"inherit", outline:"none", lineHeight:1.5 }} />
                <input type="url" placeholder="로고 URL (선택)"
                  value={reportUrl} onChange={e => setReportUrl(e.target.value)}
                  style={{ width:"100%", background:"#f9f9f9", border:"1px solid #e4e4e7", color:"#111111", padding:"7px 8px", borderRadius:6, fontSize:11, outline:"none" }} />
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
            {/* 새 로고 제보 링크 */}
            <Link href="/submit" style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:5, marginTop:8, padding:"8px 0", borderRadius:8, fontSize:11, fontWeight:500, color:"#6366f1", border:"1px solid rgba(99,102,241,.25)", background:"rgba(99,102,241,.05)", textDecoration:"none" }}>
              ➕ 새 브랜드 로고 제보하기
            </Link>
          </div>

          {/* 광고 슬롯 — 환경변수가 없으면 통째로 렌더되지 않는다.
              예전엔 여기 "광고 / Ad slot" 점선 상자가 있었는데, 개발용
              자리표시자가 프로덕션에서 실제 사용자에게 그대로 보이고 있었다. */}
          <div style={{ flex:1, padding:"14px 16px", display:"flex", flexDirection:"column", justifyContent:"flex-end" }}>
            <CoupangSlot subId="brand" />
          </div>
        </div>
      </div>
    </div>
  );
}

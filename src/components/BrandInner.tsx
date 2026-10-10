"use client";
import { presentationAssetFile, validPresentation, type LogoPresentation } from "@/lib/logo-presentation";
import { presentationVoteId, presentationVoteKey, presentationVoteCount } from '@/lib/logo-presentation-vote';
import { generateInverted } from "@/lib/logo-dark-png";

import { useLocale, T } from "@/lib/locale-context";
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Brand, fetchVariants, type VariantManifest } from "@/lib/brands";
import { BRAND_RELATIONS, RELATION_LABEL, RELATION_COLOR } from "@/lib/brand-relations";
import { getClientAuth, getClientDb } from "@/lib/firebase";
import LogoVersionHistory from "./LogoVersionHistory";
import { logoVariantLabel } from "@/lib/logo-variant-label";
import CoupangSlot from "./CoupangSlot";

const SITE_URL = "https://semologo.com";
import {
  doc, getDoc, setDoc, updateDoc, increment,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import {
  analyzeLogoVisibility, getDarkPreviewStyle, getDarkPreviewUrl, getDarkPreviewLabel,
  type VisibilityResult,
} from "@/lib/logo-visibility";
import {
  loadQuality, getMyVote, voteQuality, cancelQualityVote, type QualityData,
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
  backgroundColor: "var(--logo-preview-bg)",
  backgroundImage: `
    linear-gradient(rgba(0,0,0,0.11) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,0,0,0.11) 1px, transparent 1px)
  `,
  backgroundSize: "12px 12px",
};

const VARIANTS = [
  { file: "logo.svg",            name: "SVG 벡터",        desc: "확대해도 깨짐 없음",       bg: "white", svgOnly: true,  langEn: false },
  { file: "logo-en.svg",         name: "영문 SVG",         desc: "영문 벡터",                bg: "white", svgOnly: true,  langEn: true  },
  { file: "logo-800.png",        name: "고해상도 PNG",        desc: "큰 화면·편집 작업용",          bg: "white", svgOnly: false, langEn: false },
  { file: "logo-icon.png",       name: "아이콘용 PNG",  desc: "파비콘·앱 아이콘용", bg: "checker",svgOnly: false, langEn: false },
  { file: "logo-transparent.png",name: "투명 PNG",        desc: "배경 제거 PNG",            bg: "checker",svgOnly: false, langEn: false },
  { file: "logo.png",            name: "기본 PNG",         desc: "기본 PNG",                 bg: "white", svgOnly: false, langEn: false },
  { file: "logo-en.png",         name: "영문 PNG",         desc: "영문 기본 PNG",            bg: "white", svgOnly: false, langEn: true  },
];

/** 매니페스트의 provider 는 내부 식별자다 — 사용자에게는 읽을 수 있는 이름으로 */
const PROVIDER_LABEL: Record<string, string> = {
  lobe: "Lobe Icons",
  svgl: "SVGL",
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
  derived: "원본에서 추출",
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
  const {en, t, path} = useLocale();
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
  const svgUrl  = typeof brand.logo_svg === "string" && brand.logo_svg.startsWith("/")
    ? `${brand.logo_svg}?v=${VERSION}`
    : cdnUrl(brand.svg_transparent || "logo.svg");
  const directPng = typeof brand.logo_png === "string" ? (/^https?:\/\//.test(brand.logo_png) ? brand.logo_png : brand.logo_png.startsWith("/") ? `${brand.logo_png}?v=${VERSION}` : cdnUrl(brand.logo_png)) : null;
  const pngUrl  = directPng || cdnUrl("logo.png");
  const darkUrl = brand.rejected_asset_files?.includes("logo-transparent.png") ? pngUrl : cdnUrl("logo-transparent.png");
  const whiteUrl = cdnUrl(brand.dark_png || "logo-white.png");
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
  /**
   * 수동 지정이 자동 판정보다 우선한다. 자동(흰 잉크 60%↑)은 '색 심볼 + 흰 글자'까지
   * 잡지만, 45~60% 구간은 흰 글자형과 흰 채움 아이콘형이 반반이라 기계가 못 가른다.
   * 관리자가 모달의 다크 프리뷰를 클릭하면 logo_votes/{id}.bg 에 남고,
   * brand-logos/scripts/pull-bg-overrides.py 가 그걸 내려받아 목록 전체에 반영한다.
   */
  const [presentation,setPresentation]=useState<LogoPresentation | null>(brand.presentation || null);
  const [candidateBgs,setCandidateBgs]=useState<Record<string,"light"|"dark">>({});

  const [savingPresentation,setSavingPresentation]=useState(false);
  useEffect(()=>{let alive=true;setPresentation(brand.presentation || null);fetch(`/api/logo-presentation/?id=${encodeURIComponent(brand.id)}`,{cache:"no-store"}).then(r=>r.ok?r.json():null).then(data=>{const p=data?.presentations?.[brand.id];if(alive&&validPresentation(p)){setPresentation(p);setCandidateBgs(old=>({...old,[p.file]:p.bg}));}}).catch(()=>{});return()=>{alive=false;};},[brand.id]);
  const [bgOverride, setBgOverride] = useState<"dark" | "light" | null>(null);
  const ADMIN_EMAIL = "juuuno1116@gmail.com";
  // 렌더 중에 getClientAuth() 를 부르면 SSR 에서 깨진다 — 효과 안에서만 읽는다.
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    try {
      const auth = getClientAuth();
      setIsAdmin(auth.currentUser?.email === ADMIN_EMAIL);
      return onAuthStateChanged(auth, u => setIsAdmin(u?.email === ADMIN_EMAIL));
    } catch { /* 서버 렌더·비로그인 */ }
  }, []);
  const isLightLogo = presentation ? presentation.bg === "dark" : bgOverride ? bgOverride === "dark" : !!(brand.light || brand.light_logo || brand.dark_variant === "white");
  const savePresentation = async (file:string,bg:"light"|"dark") => {
    if(!isAdmin||!file)return;
    setSavingPresentation(true);
    try{const token=await getClientAuth().currentUser?.getIdToken();const r=await fetch('/api/logo-presentation/',{method:'PATCH',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({id:brand.id,file,bg})});const data=await r.json();if(!r.ok)throw Error(data.error);setPresentation(data.presentation);setBgOverride(null);window.dispatchEvent(new CustomEvent('semologo:presentation',{detail:{brandId:brand.id,presentation:data.presentation}}));toast('대표 이미지와 배경을 저장했어요.');}catch(e){toast(e instanceof Error?e.message:'저장하지 못했어요.');}finally{setSavingPresentation(false);}
  };
  const toggleBg = (e:React.MouseEvent) => {e.stopPropagation();if(!isAdmin)return;const fallback=presentationAssetFile(brand,brand.logo_png)||presentationAssetFile(brand,brand.preview_png)||"logo.png";const file=presentation?.file || (!isLightLogo ? brand.dark_png || (hasWhiteLogo ? "logo-white.png" : fallback) : fallback);void savePresentation(file,isLightLogo?"light":"dark");};
  const DARK_TILE: React.CSSProperties = { background: "#18181b", backgroundImage: "none" };
  /** 밝은 로고면 어두운 타일, 아니면 원래 배경 */
  const tile = (base?: React.CSSProperties): React.CSSProperties =>
    isLightLogo ? DARK_TILE : (base ?? {});
  /** 변형 하나가 흰색이면 브랜드가 밝든 아니든 어두운 타일이어야 한다.
   *  흰 로고를 밝은 체커보드에 얹으면 빈 칸으로 보인다 — 팬이지에서 '화이트'
   *  4종이 전부 안 보여 파일이 깨진 것처럼 읽혔다 (2026-08-26). */
  const variantTile = (v: { key: string; color?: string }): React.CSSProperties =>
    (v.color === "white" || v.color === "mono-light" || /(^|[-_])white$/.test(v.key)) ? DARK_TILE : tile(CHECKER);
  // 기관 원본 PNG에는 흰 캔버스가 포함된 경우가 많다. 대표 미리보기는
  // 배경 제거 파생물을 먼저 사용하고, 파생물이 없을 때만 원본으로 폴백한다.
  const mainUrl = hasSvg ? svgUrl : (directPng || darkUrl);
  // 일부 기관 수집본의 원본 SVG에는 로고 주변의 안내 문서/캔버스가
  // 함께 들어온다. 다운로드 원본은 보존하되, 대표 화면은 검수된 가공본을
  // 우선 사용한다. KCA는 logo-800.png가 실제 로고만 담은 가공본이다.
  const previewUrl = presentation ? cdnUrl(presentation.file) : brand.preview_png || (brand.id === "kca" ? cdnUrl("logo-800.png") : hasPng ? pngUrl : `/api/logo-preview/?id=${encodeURIComponent(brand.id)}`);
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
  // 지자체처럼 본 로고·브랜드 슬로건·캐릭터가 별도 콘텐츠로 존재하는 경우
  // 같은 출처 묶음의 페이지를 서로 연결한다.
  const relatedVariants = allBrands.filter((candidate) =>
    candidate.id !== brand.id &&
    (candidate.variant_of === brand.id ||
      (brand.variant_of && candidate.variant_of === brand.variant_of))
  ).slice(0, 8);

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
  const fallbackVariants = VARIANTS.map(v => {
    const file = v.file === "logo.png" ? brand.logo_png : v.file === "logo.svg" ? brand.svg_transparent : v.file === "logo-icon.png" ? brand.icon_png : undefined;
    return typeof file === "string" && !file.startsWith("/") && !file.startsWith("http") ? {...v,file, ...(v.file === "logo-icon.png" && brand.icon_png ? {desc:"1024×1024 · 파비콘·앱 아이콘용"} : {})} : v;
  }).filter(v => {
    if (brand.rejected_asset_files?.includes(v.file)) return false;
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
  const compositionFiles = new Set(manifest?.variants.flatMap(v => Object.values(v.files)) || []);
  const variants = gridCandidates.filter(v => isReady(cdnUrl(v.file)) && !compositionFiles.has(v.file));

  const iconFile = brand.icon_png || "logo-icon.png";
  const iconUrl = cdnUrl(iconFile);
  const symbolVariant = manifest?.variants.find(v => (v.form === "symbol" || v.lockup === "symbol") && v.color !== "white" && v.color !== "mono-light" && (v.files.svg || v.files.png));
  // Use only confirmed files; a failed icon probe keeps the working logo preview.
  const usageIconUrl = brand.icon_png ? iconUrl : symbolVariant ? cdnUrl(symbolVariant.files.svg || symbolVariant.files.png!) : !brand.rejected_asset_files?.includes(iconFile) && avail[iconUrl] === true ? iconUrl : null;

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
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = previousOverflow; };
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
          for (const [k,v] of Object.entries(data.presentation_votes || {})) if (typeof v === "number") decoded[k]=v;
          setVotes(decoded);
          if (data.swap_pending) setSwapTarget(data.swap_target || null);
          // 공개 배경 투표 결과를 사용한다. 대표 배경은 관리자 선택 API에서 불러온다.
          // Legacy public background votes never override the administrator's selected file.
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
    if (brand.dark_png) { setVisibility(null); setHasWhiteLogo(true); return; }
    if (brand.rejected_asset_files?.includes("logo-transparent.png")) {
      setVisibility(null); setHasWhiteLogo(false); return;
    }
    analyzeLogoVisibility(
      brand.id,
      previewUrl,
      darkUrl,
    ).then(async result => {
      setVisibility(result);
      if (result.darkMode === "white-only") {
        const transparentSrc = darkUrl;
        const pngSrc = previewUrl;
        const inv = await generateInverted(transparentSrc) ?? await generateInverted(pngSrc);
        setInvertedUrl(inv);
      }
    });
    if (brand.rejected_asset_files?.includes("logo-white.png")) { setHasWhiteLogo(false); return; }
    const img = new Image();
    img.onload = () => setHasWhiteLogo(true);
    img.onerror = () => setHasWhiteLogo(false);
    img.src = `${CDN}/${brand.id}/logo-white.png?v=${VERSION}`;
  }, [brand.id]);



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

  const voteBusy = useRef(false);
  const castVote = useCallback(async (file: string, label: string, bg: "light"|"dark" = "light") => {
    if (voteBusy.current) return;
    if (!getClientAuth().currentUser) { toast("추천하려면 로그인해 주세요"); return; }
    const identity=presentationVoteId(file,bg);
    if (votedFiles.includes(identity) || (bg==="light" && votedFiles.includes(file))) { toast("이미 투표했어요"); return; }
    voteBusy.current = true;
    const key = presentationVoteKey(file,bg);
    setVotes(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
    const newVoted = [...votedFiles, identity];
    setVotedFiles(newVoted);
    localStorage.setItem(`voted_${brand.id}`, JSON.stringify(newVoted));
    try {
      const db = getClientDb();
      const ref = doc(db, "logo_votes", brand.id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        await updateDoc(ref, { [`presentation_votes.${key}`]: increment(1) });
      } else {
        await setDoc(ref, { presentation_votes: { [key]: increment(1) } }, { merge: true });
      }
      appendFeed({ emoji: myEmoji(), ts: Date.now(), type: "vote", label: `${label} · ${bg === "dark" ? "검정 배경" : "흰 배경"}`, file });
      toast("👍 추천했어요!");
    } catch {
      setVotes(prev => ({ ...prev, [key]: Math.max(0, (prev[key] || 1) - 1) }));
      setVotedFiles(votedFiles);
      localStorage.setItem(`voted_${brand.id}`, JSON.stringify(votedFiles));
      toast("저장 실패. 다시 시도해주세요");
    } finally { voteBusy.current = false; }
  }, [brand.id, votedFiles, appendFeed]);

  const requestSwap = useCallback(async (file: string, label: string) => {
    if (!getClientAuth().currentUser) { toast("교체를 요청하려면 로그인해 주세요"); return; }
    if (!window.confirm(`"${t(label)}"을(를) 메인 로고로 교체 요청할까요?\n관리자 확인 후 반영됩니다.`)) return;
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

  const candidateBg = (file:string, fallback:"light"|"dark"="light") => candidateBgs[file] || fallback;
  const candidateActions = (file:string,label:string,bg:"light"|"dark",fixed=false) => {
    const voted=votedFiles.includes(presentationVoteId(file,bg)) || (bg==="light" && votedFiles.includes(file));
    const selected=presentation?.file===file && presentation.bg===bg;
    const applicable=validPresentation({file,bg}) && !brand.rejected_asset_files?.includes(file);
    return <div className="logo-candidate-actions">
      {!fixed && <div className="logo-background-options" aria-label={`${label} 배경`}>
        {(["light","dark"] as const).map(value=><button key={value} type="button" aria-pressed={bg===value} onClick={()=>setCandidateBgs(old=>({...old,[file]:value}))}>{value==="light"?"흰 배경":"검정 배경"}</button>)}
      </div>}
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        <button className="logo-candidate-vote" type="button" aria-pressed={voted} onClick={()=>void castVote(file,label,bg)} title="이 파일과 배경을 대표 이미지로 추천">{voted?"✓ 추천함":"👍 대표 추천"} {presentationVoteCount(votes,file,bg)||""}</button>
        {isAdmin && applicable && <button className="logo-candidate-apply" type="button" disabled={savingPresentation||selected} onClick={()=>void savePresentation(file,bg)}>{selected?"✓ 현재 대표":"대표로 지정"}</button>}
      </div>
    </div>;
  };

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

  const embedCode = `<img src="${mainUrl}" alt="${en ? brand.name_en || brand.name_ko : brand.name_ko}" style="height:40px">`;
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
    // 같은 버튼을 다시 누르면 취소. 다른 쪽을 누르면 먼저 취소하라고 안내한다.
    if (myQualityVote === vote) {
      try {
        const result = await cancelQualityVote(brand.id, vote);
        setQuality(result); setMyQualityVote(null);
        toast(vote === "up" ? "좋아요를 취소했어요" : "교체 요청을 취소했어요");
      } catch { toast("취소 실패. 다시 시도해주세요"); }
      return;
    }
    if (myQualityVote) { toast("먼저 기존 투표를 다시 눌러 취소해 주세요"); return; }
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
    : { position: "relative", display: "flex", flexDirection: "column", width: "96vw", maxWidth: 1600, height: "90vh", background: "#ffffff", border: "1px solid #e4e4e7", borderRadius: 20, boxShadow: "0 24px 80px rgba(0,0,0,.15)", animation: "modalIn .18s ease" };

  const darkPreviewSrc = presentation ? previewUrl : brand.dark_png ? whiteUrl : hasWhiteLogo && visibility?.darkMode !== "white-only"
    ? whiteUrl
    : getDarkPreviewUrl(visibility, darkUrl, previewUrl);

  return (
    <div className={isPage ? "brand-inner-panel brand-inner-page" : "brand-inner-panel brand-inner-dialog"} style={containerStyle} onClick={e => e.stopPropagation()}>
      {!isPage && <div className="brand-sheet-handle" aria-hidden="true"><span /></div>}
      <style>{`
        @keyframes modalIn { from { opacity:0; transform:scale(.97) translateY(6px); } to { opacity:1; transform:none; } }
        @keyframes toastIn { from { opacity:0; transform:translateX(-50%) translateY(8px); } to { opacity:1; transform:translateX(-50%); } }
        .mscroll::-webkit-scrollbar { width:4px; }
        .mscroll::-webkit-scrollbar-track { background:transparent; }
        .mscroll::-webkit-scrollbar-thumb { background:#d4d4d8; border-radius:2px; }
        .mscroll::-webkit-scrollbar-thumb:hover { background:#a1a1aa; }
        .vbtn:hover { border-color:#6366f1 !important; color:#6366f1 !important; }
        .dlrow:hover { border-color:#6366f1 !important; }
        .logo-composition-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
        .logo-composition-card { display:grid; grid-template-columns:clamp(112px,32%,140px) minmax(0,1fr); grid-template-rows:auto auto; align-content:center; padding:8px; }
        @media (max-width: 1000px) { .logo-composition-grid { grid-template-columns:1fr; } }
        .logo-composition-preview { aspect-ratio:1; align-self:center; width:100%; grid-row:1 / span 2; position:relative; overflow:hidden; border-radius:8px; }
        .logo-candidate-actions { margin-top:8px; }
        .logo-background-options { display:flex; gap:4px; margin-bottom:6px; }
        .logo-background-options button,.logo-candidate-vote,.logo-candidate-apply { border:1px solid #e4e4e7; border-radius:6px; background:#fff; color:#52525b; padding:5px 7px; font-size:11px; cursor:pointer; }
        .logo-background-options button[aria-pressed=true],.logo-candidate-vote[aria-pressed=true] { border-color:#6366f1; color:#6366f1; background:#eef2ff; }
        .logo-candidate-apply { color:#6366f1; }
        .logo-candidate-apply:disabled { opacity:.6; cursor:default; }
        .sharebtn:hover { border-color:#6366f1 !important; color:#6366f1 !important; }
        @media (max-width: 768px) {
          .brand-inner-header > :first-child { flex-basis:100% !important; }
          .brand-inner-body { display:block !important; overflow-y:auto !important; }
          .brand-inner-body > .mscroll { overflow-y:visible !important; }
          .brand-inner-left { border-right: none !important; border-bottom: 1px solid #e4e4e7; }
          .brand-inner-right { border-left: none !important; border-top: 1px solid #e4e4e7; }
        }
      `}</style>

      {/* ── Header ── */}
      <div className="brand-inner-header" style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 20px", borderBottom:"1px solid #e4e4e7", flexShrink:0, flexWrap:"wrap" }}>
        <div style={{ flex:1, minWidth:0 }}>
          {/* 검색엔진이 페이지 주제를 잡는 가장 강한 신호다. 예전엔 h2 뿐이라
              h1 이 아예 없었다 — '삼성화재 로고'로 검색했을 때 잡힐 근거가
              title·description 에만 있었다.
              브랜드명은 화면과 접근성 트리에 한 번만 표시한다. */}
          <h1 style={{ fontSize:17, fontWeight:700, color:"#111111", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", margin:0 }}>
            {en ? brand.name_en || brand.name_ko : brand.name_ko}{!en && brand.name_en && brand.name_en !== brand.name_ko ? ` / ${brand.name_en}` : ""}
          </h1>
          <p style={{ fontSize:12, color:"#71717a", marginTop:2, display:"flex", alignItems:"center", gap:6 }}>
            <span>{t(brand.category || "기타")}</span>
            {/* 공식 배포 원본은 신뢰도가 다르다. 사이트 헤더에서 긁은 것과
                배포처가 CI 페이지에 올려둔 원본은 같은 로고라도 근거가 다르다. */}
            {brand.asset_origin && (
              <span title={brand.asset_origin}
                style={{ display:"inline-flex", alignItems:"center", gap:3,
                         padding:"1px 7px", borderRadius:999, fontSize:11, fontWeight:600,
                         color:"#15803d", background:"rgba(34,197,94,.1)",
                         border:"1px solid rgba(34,197,94,.25)" }}><T>{"✓ 공식 배포 원본"}</T></span>
            )}
            {/* 매뉴얼 원본은 로고 파일만큼 값어치가 있다 — 컬러 팔레트·
                최소규격·응용례가 들어 있다. 배포처가 준 경우에만 뜬다. */}
            {(brand.official_zip_url || brand.source_zip) && (
              <a href={brand.official_zip_url || `${CDN}/${brand.id}/${brand.source_zip}?v=${VERSION}`} target={brand.official_zip_url ? "_blank" : undefined} rel={brand.official_zip_url ? "noopener noreferrer" : undefined} download={!brand.official_zip_url} title="공식 제공 원본 ZIP 내려받기"
                 style={{ display:"inline-flex", alignItems:"center", gap:3, padding:"1px 7px", borderRadius:999, fontSize:11, fontWeight:600, color:"#166534", background:"rgba(34,197,94,.1)", border:"1px solid rgba(34,197,94,.25)", textDecoration:"none" }}><T>{"📦 공식 제공 원본 ZIP"}</T></a>
            )}
            {brand.brand_manual && (
              <a href={`${CDN}/${brand.id}/${brand.brand_manual}?v=${VERSION}`}
                 download
                 title="브랜드 매뉴얼 원본 내려받기"
                 style={{ display:"inline-flex", alignItems:"center", gap:3,
                          padding:"1px 7px", borderRadius:999, fontSize:11, fontWeight:600,
                          color:"#4338ca", background:"rgba(99,102,241,.1)",
                          border:"1px solid rgba(99,102,241,.25)", textDecoration:"none" }}><T>{"📘 브랜드 매뉴얼"}</T></a>
            )}
          </p>
          {/* 검색용 요약. 4만 페이지가 전부 같은 틀이면 '얇은 콘텐츠'로 분류돼
              색인에서 빠진다. 이 브랜드만 아는 사실(시장·업종·종목코드·형태·
              보유 형식)로 페이지마다 다른 문장을 만든다. */}
          {/* 검색엔진용. 화면에는 안 보이지만 HTML 에는 남는다 —
              헤더가 4줄이 되면 정작 로고가 밀린다. 크롤러는 읽는다. */}
          {(() => {
            const sources = [
              ...(brand.sources ?? []),
              ...(brand.official_source_page ? [{ label: en ? "Official source page" : "공식 원문 페이지", origin: brand.official_source_page, source_url: undefined }] : []),
              ...(brand.ci_page_url ? [{ label: en ? "CI page" : "CI 안내 페이지", origin: brand.ci_page_url, source_url: undefined }] : []),
              ...(brand.getlogo_url ? [{ label: en ? "GetLogo record" : "겟로고 기록", origin: brand.getlogo_url, source_url: undefined }] : []),
            ]
              .map(item => ({ ...item, url: item.origin || item.source_url }))
              .filter((item): item is typeof item & { url: string } => Boolean(item.url))
              .filter((item, index, all) => all.findIndex(other => other.url === item.url) === index)
              .slice(0, 3);
            if (!sources.length) return null;
            return <div className="mt-3 flex flex-wrap items-center gap-2" aria-label={en ? "Logo sources" : "로고 출처"}>
              <span className="text-sm text-gray-500">🔗 {en ? "Sources" : "출처"}</span>
              {sources.map((source, index) => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-sm text-gray-500 underline" title={source.label || (en ? "Open original source" : "원본 출처 열기")}>
                {source.label || (index === 0 ? (en ? "Official source" : "공식 출처") : (en ? `Source ${index + 1}` : `출처 ${index + 1}`))}
              </a>)}
            </div>;
          })()}

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
              title={`${en ? brand.name_en || brand.name_ko : brand.name_ko} 공식 홈페이지로 이동`}
              style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"5px 12px",
                       background:"#f4f4f5", border:"1px solid #e4e4e7", color:"#52525b",
                       borderRadius:8, fontSize:12, fontWeight:500, textDecoration:"none",
                       flexShrink:0 }}
            ><T>{"🔗 홈페이지"}</T></a>
          )}
          {/* 품질 투표 — 헤더 오른쪽으로. 왼쪽에 두면 브랜드명 아래 줄이
              하나 더 생겨 헤더가 4줄이 된다. */}
        <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:7 }}>
        <button onClick={() => castQualityVote("up")} title={myQualityVote === "up" ? "다시 누르면 취소" : "좋은 로고예요"}
        style={{ display:"inline-flex", alignItems:"center", gap:3, padding:"3px 9px", borderRadius:20, fontSize:11, fontWeight:600, cursor: (myQualityVote && myQualityVote !== "up") ? "default" : "pointer", transition:"all .15s", background: myQualityVote === "up" ? "rgba(34,197,94,.12)" : "#f4f4f5", border:`1px solid ${myQualityVote === "up" ? "rgba(34,197,94,.4)" : "#e4e4e7"}`, color: myQualityVote === "up" ? "#16a34a" : "#71717a", opacity: myQualityVote && myQualityVote !== "up" ? .45 : 1 }}>
        👍 {quality.up > 0 ? quality.up : ""}
        </button>
        <button onClick={() => castQualityVote("down")} title={myQualityVote === "down" ? "다시 누르면 취소" : "교체가 필요해요"}
        style={{ display:"inline-flex", alignItems:"center", gap:3, padding:"3px 9px", borderRadius:20, fontSize:11, fontWeight:600, cursor: (myQualityVote && myQualityVote !== "down") ? "default" : "pointer", transition:"all .15s", background: myQualityVote === "down" ? "rgba(239,68,68,.1)" : "#f4f4f5", border:`1px solid ${myQualityVote === "down" ? "rgba(239,68,68,.35)" : "#e4e4e7"}`, color: myQualityVote === "down" ? "#dc2626" : "#71717a", opacity: myQualityVote && myQualityVote !== "down" ? .45 : 1 }}><T>{"🚩 교체 필요"}</T>{quality.down > 0 ? quality.down : ""}
        </button>
        {quality.flagged && (
        <span style={{ fontSize: 11, fontWeight:700, color:"#dc2626", background:"rgba(239,68,68,.08)", border:"1px solid rgba(239,68,68,.2)", borderRadius:10, padding:"2px 6px" }}><T>{"검토 필요"}</T></span>
        )}
        </div>
        <button onClick={copyPageLink} className="sharebtn"
          style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 12px", background:"#f4f4f5", border:"1px solid #e4e4e7", color:"#52525b", borderRadius:8, fontSize:12, fontWeight:500, cursor:"pointer", transition:"all .15s", flexShrink:0 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          {copyDone ? t("복사됨!") : t("퍼가기")}
        </button>

        {/* 페이지 모드: 홈 링크 / 모달 모드: X 버튼 */}
        {isPage ? (
          <Link href={path("/")} style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 12px", background:"#f4f4f5", border:"1px solid #e4e4e7", color:"#52525b", borderRadius:8, fontSize:12, fontWeight:500, textDecoration:"none", flexShrink:0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6"/></svg><T>{"홈으로"}</T></Link>
        ) : (
          <button type="button" data-brand-close className="brand-sheet-close" aria-label={t("닫기")} onClick={onClose} style={{ background:"#f4f4f5", border:"1px solid #e4e4e7", color:"#52525b", width:32, height:32, borderRadius:8, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        )}
      </div>

      {/* ── 연관기업 바 ── */}
      {relations.length > 0 && (
        <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 20px", borderBottom:"1px solid #e4e4e7", background:"#fafafa", flexShrink:0, flexWrap:"wrap" }}>
          <span style={{ fontSize: 11, fontWeight:700, color:"#a1a1aa", letterSpacing:".06em", textTransform:"uppercase", flexShrink:0 }}><T>{"연관기업"}</T></span>
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

      {relatedVariants.length > 0 && (
        <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 20px", borderBottom:"1px solid #e4e4e7", background:"#fff", flexShrink:0, flexWrap:"wrap" }}>
          <span style={{ fontSize:11, fontWeight:700, color:"#a1a1aa", letterSpacing:".06em", textTransform:"uppercase", flexShrink:0 }}><T>{"관련 로고"}</T></span>
          {relatedVariants.map((related) => (
            <button key={related.id} onClick={() => onSelectBrand?.(related)} disabled={!onSelectBrand}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 10px 4px 6px", background:"#f5f3ff", border:"1px solid #ddd6fe", borderRadius:20, cursor:onSelectBrand?"pointer":"default" }}>
              <img src={`${CDN}/${related.id}/logo.png?v=${VERSION}`} alt="" style={{ width:22, height:18, objectFit:"contain", flexShrink:0 }} onError={e => { e.currentTarget.style.display="none"; }} />
              <span style={{ fontSize:11, fontWeight:700, color:"#5b21b6" }}>{en ? related.name_en || related.name_ko : related.name_ko}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── 3-column body ── */}
      <div
        className="brand-inner-body"
        style={{
          flex: isPage ? undefined : 1,
          overflow: isPage ? undefined : "hidden",
          display: "grid",
          gridTemplateColumns: "200px minmax(0,1fr) 270px",
        }}
      >
        {/* ── LEFT: 미리보기 + 형식 + 빠른다운 ── */}
        <div className={`mscroll brand-inner-left`} style={{ overflowY: isPage ? undefined : "auto", padding:"20px 16px", borderRight:"1px solid #e4e4e7", display:"flex", flexDirection:"column", gap:16, scrollbarWidth:"thin" }}>

          {/* 메인 프리뷰 */}
          <div style={{ border:"1px solid #f0f0f2", borderRadius:8, overflow:"hidden", position:"relative" }}>
            <LogoBox src={!presentation && bgOverride === "dark" ? (invertedUrl || darkPreviewSrc) : previewUrl} alt={en ? brand.name_en || brand.name_ko : brand.name_ko} height={128} padding={16} bg={isLightLogo ? "dark" : "white"} fallback={pngUrl} />
            {brand.original_ai_url && (
              <a href={brand.original_ai_url} target="_blank" rel="noopener noreferrer"
                style={{ position:"absolute", bottom:6, right:6, display:"inline-flex", alignItems:"center", gap:3, padding:"2px 7px", background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:10, fontSize: 11, fontWeight:700, color:"#2563eb", textDecoration:"none", letterSpacing:".04em" }}>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg><T>{"공식"}</T></a>
            )}
          </div>

          {/* 다크 프리뷰 — 관리자는 클릭해서 "검정 배경으로 메인 노출"을 지정한다 */}
          <div style={{ borderRadius:8, overflow:"hidden", cursor: "pointer", outline: bgOverride ? "2px solid #22c55e" : undefined }}
               onClick={toggleBg}
               title={isLightLogo ? "클릭: 흰 배경으로 되돌리기" : "클릭: 검정 배경으로 메인 노출"}>
            <div style={{ ...(invertedUrl || brand.dark_png ? { background:"#111114" } : getDarkPreviewStyle(visibility)), position:"relative", height:72 }}>
              {bgOverride && (
                <span style={{ position:"absolute", top:4, right:6, fontSize:10, fontWeight:700, padding:"1px 6px", borderRadius:8, background: bgOverride === "dark" ? "#22c55e" : "#e4e4e7", color: bgOverride === "dark" ? "#fff" : "#52525b" }}>
                  {bgOverride === "dark" ? "📌 검정 메인" : "📌 흰 배경"}
                </span>
              )}
              {/* 라벨은 가운데 큰 다크 패널에만 둔다 — 여기 72px 타일에선 핀과 겹쳐 지저분했다 */}
              <LogoBox src={invertedUrl || darkPreviewSrc} alt={en ? brand.name_en || brand.name_ko : brand.name_ko} height={72} padding={12} bg="transparent" fallback={previewUrl} />
              {visibility && (
                <span style={{ position:"absolute", bottom:4, left:0, right:0, textAlign:"center", fontSize: 11, color:"#71717a", letterSpacing:".06em", textTransform:"uppercase", opacity:.8 }}>
                  {invertedUrl ? t("흑백 반전 (다크용)") : t(getDarkPreviewLabel(visibility)) + (hasWhiteLogo && visibility.darkMode !== "white-only" ? " · 화이트" : "")}
                </span>
              )}
            </div>
          </div>

          {/* 사용 미리보기 */}
          <div>
            <div style={{ fontSize: 11, fontWeight:700, color:"#71717a", letterSpacing:".08em", textTransform:"uppercase", marginBottom:10 }}><T>{"사용 미리보기"}</T></div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
              {[
                { label:"OG 16:9", style:{ width:"100%", aspectRatio:"16/9", background: isLightLogo ? "#18181b" : "#f0f0f0", borderRadius:4, overflow:"hidden", position:"relative" } as React.CSSProperties },
                { label:"파비콘",  style:{ width:28, height:28, background: isLightLogo ? "#18181b" : "#e4e4e7", borderRadius:4, overflow:"hidden", position:"relative" } as React.CSSProperties },
                { label:"앱 아이콘", style:{ width:46, height:46, background: isLightLogo ? "#18181b" : "#e4e4e7", borderRadius:10, overflow:"hidden", position:"relative" } as React.CSSProperties },
              ].map(m => (
                <div key={t(m.label)} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5 }}>
                  <div style={m.style}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.label !== "OG 16:9" && usageIconUrl ? usageIconUrl : !presentation && bgOverride === "dark" ? (invertedUrl || darkPreviewSrc) : previewUrl} alt="" style={{ position:"absolute", inset:"10%", width:"80%", height:"80%", objectFit:"contain", objectPosition:"center" }} onError={e => { e.currentTarget.src = pngUrl; }} />
                  </div>
                  <span style={{ fontSize: 11, color:"#71717a", textAlign:"center" }}>{t(m.label)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 보유 형식 */}
          <div>
            <div style={{ fontSize: 11, fontWeight:700, color:"#71717a", letterSpacing:".08em", textTransform:"uppercase", marginBottom:10 }}><T>{"보유 형식"}</T></div>
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              {[{ label:"SVG 벡터", ok:hasSvg || !!manifest?.variants.some(v=>v.files.svg) }, { label:"PNG", ok:hasPng }, { label:"영문 버전", ok:hasEn }].map(({ label, ok }) => (
                <span key={t(label)} style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"4px 10px", borderRadius:20, fontSize:11, fontWeight:600, background:ok?"rgba(34,197,94,0.12)":"#f4f4f5", color:ok?"#22c55e":"#71717a", border:`1px solid ${ok?"rgba(34,197,94,0.2)":"#e4e4e7"}` }}>
                  {ok ? "✓" : "✗"} {t(label)}
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
              {hasSvg ? "SVG" : "PNG"}{" "}<T>{"다운로드"}</T></a>
            {hasSvg && isReady(pngUrl) && (
              <a href={pngUrl} download={`${brand.id}-logo.png`}
                onClick={e => { e.preventDefault(); grab(pngUrl, `${brand.id}-logo.png`); }}
                style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:"9px 0", borderRadius:8, fontSize:12, fontWeight:600, background:"#f4f4f5", color:"#52525b", textDecoration:"none", border:"1px solid #e4e4e7", cursor:"pointer" }}><T>{"↓ PNG 다운로드"}</T></a>
            )}
            {invertedUrl && (
              <a href={invertedUrl} download={`${brand.id}-logo-dark.png`}
                      onClick={e => { e.preventDefault(); grab(invertedUrl, `${brand.id}-logo-dark.png`); }}
                style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:5, padding:"9px 0", borderRadius:8, fontSize:12, fontWeight:600, background:"#111114", color:"#a78bfa", textDecoration:"none", border:"1px solid #3f3f46" }}><T>{"🌙 반전 PNG (다크용)"}</T></a>
            )}
          </div>
        </div>

        {/* ── MID: 인트로 + 변형 그리드 ── */}
        <div className="mscroll brand-inner-main" style={{ overflowY: isPage ? undefined : "auto", padding:"22px 24px", scrollbarWidth:"thin" }}>
          <section aria-label="대표 이미지 배경" style={{marginBottom:24}}>
            <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>대표 이미지</div>
            <p style={{fontSize:12,color:"#71717a",margin:"0 0 12px"}}>파일과 배경을 함께 추천해 주세요. 대표 이미지는 관리자가 최종 지정해요.</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12}}>
              {(["light","dark"] as const).map(bg=>{
                const base=presentation?.file||presentationAssetFile(brand,brand.logo_png)||presentationAssetFile(brand,brand.preview_png)||"logo.png";
                const file=bg==="dark"&&!presentation?(brand.dark_png || (hasWhiteLogo?"logo-white.png":invertedUrl?`generated-dark:${base}`:base)):base;
                const src=presentation?previewUrl:bg==="dark"?(brand.dark_png||hasWhiteLogo?whiteUrl:invertedUrl||pngUrl):pngUrl;
                return <div key={bg} style={{border:"1px solid #e4e4e7",borderRadius:12,overflow:"hidden"}}>
                  <LogoBox src={src} alt={bg==="light"?"흰 배경 미리보기":"검정 배경 미리보기"} height={132} padding={18} bg={bg==="dark"?"dark":"white"} fallback={pngUrl}/>
                  <div style={{padding:"10px 12px"}}><b style={{fontSize:12}}>{bg==="light"?"흰 배경":"검정 배경"}</b>{file.startsWith("generated-dark:")&&<span style={{fontSize:10,color:"#71717a",marginLeft:6}}>자동 생성 미리보기</span>}{candidateActions(file,"대표 이미지",bg,true)}</div>
                </div>;
              })}
            </div>
          </section>
          <LogoVersionHistory brandId={brand.id} isAdmin={isAdmin}/>

          <section aria-label="로고 구성">
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:10}}>
              <div style={{fontSize:13,fontWeight:700}}>로고 구성</div>
              {langs.length >= 2 && <div style={{display:"flex",gap:4}}>{[null,...langs].map(l=><button key={l||"all"} onClick={()=>setLangFilter(l)} aria-pressed={langFilter===l} className="logo-candidate-vote">{l===null?"전체":l==="ko"?"국문":"영문"}</button>)}</div>}
            </div>
            <p style={{fontSize:12,color:"#71717a",margin:"0 0 14px"}}>원하는 로고와 파일 형식을 골라 받으세요. 파일과 배경별로 대표 이미지를 추천할 수 있어요.</p>
            <div className="logo-composition-grid">
                      {(manifest?.variants || []).filter(v => !langFilter || v.lang === langFilter || v.lang === "none" || v.text_layout?.startsWith("ko-en")).map(v => {
                        const svgFile = v.files.svg;
                        const pngFile = v.files.png;
                        const previewUrl = cdnUrl(pngFile || svgFile || "logo.png");
                        return (
                          <div key={v.key} className="logo-composition-card" style={{ minWidth:0,
                            background:"#fff", border:"1px solid #e4e4e7", borderRadius:12, overflow:"hidden" }}>
                            <div className="logo-composition-preview" style={{
                              ...(candidateBg(pngFile||svgFile||"",v.color==="white"||v.color==="mono-light"?"dark":"light")==="dark"?DARK_TILE:CHECKER) }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={previewUrl} alt={t(logoVariantLabel(v))}
                                style={{ position:"absolute", inset:12, width:"calc(100% - 24px)",
                                  height:"calc(100% - 24px)", objectFit:"contain" }}
                                onError={e => {
                                  // 일부 대량 수집분은 SVG가 Pages에는 있지만 CDN 업로드가 늦을 수 있다.
                                  // 같은 변형의 PNG가 있으면 숨기지 말고 즉시 폴백한다.
                                  if (pngFile && e.currentTarget.src !== cdnUrl(pngFile)) e.currentTarget.src = cdnUrl(pngFile);
                                  else e.currentTarget.style.display = "none";
                                }} />
                            </div>
                            <div style={{ flex:1, minWidth:0, padding:"12px 12px 6px" }}>
                              <div style={{ fontSize:12, fontWeight:600, color:"#3f3f46",
                                display:"flex", alignItems:"center", flexWrap:"wrap", gap:5 }}>
                                <span>
                                  {t(logoVariantLabel(v))}
                                </span>
                                {v.origin === "derived" && (
                                  <span style={{ flexShrink:0, fontSize: 11, fontWeight:700, color:"#6366f1",
                                    background:"#eef2ff", border:"1px solid #c7d2fe", borderRadius:9,
                                    padding:"0 5px" }}><T>{"원본 추출"}</T></span>
                                )}
                              </div>
                              <div style={{ fontSize: 11, color:"#a1a1aa", marginTop:1,
                                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                                {v.asset_group === "typography" ? "공식 서체 안내 · 설치용 폰트 제외" : t(providerLabel(v.provider))}
                                {v.alts?.length ? ` · 소스 ${v.alts.length + 1}종` : ""}
                              </div>
                            </div>
                            <div style={{ gridColumn:2, padding:"4px 12px 12px" }}><div style={{display:"flex",gap:6}}>
                              {svgFile && (
                                <button onClick={() => grab(cdnUrl(svgFile), `${brand.id}-${v.key}.svg`)}
                                  style={{ fontSize:11, padding:"7px 11px", borderRadius:7, border:"none",
                                    background:"#6366f1", color:"#fff", cursor:"pointer", fontWeight:500 }}>
                                  SVG
                                </button>
                              )}
                              {pngFile && (
                                <button onClick={() => grab(cdnUrl(pngFile), `${brand.id}-${v.key}.png`)}
                                  style={{ fontSize:11, padding:"7px 11px", borderRadius:7,
                                    border:"1px solid #e4e4e7", background:"#fff", color:"#52525b",
                                    cursor:"pointer", fontWeight:500 }}>
                                  PNG
                                </button>
                              )}
                            </div>{(pngFile || svgFile) && candidateActions(pngFile||svgFile!,logoVariantLabel(v),candidateBg(pngFile||svgFile!,v.color==="white"||v.color==="mono-light"?"dark":"light"))}</div>
                          </div>
                        );
                      })}
            {invertedUrl && <div className="logo-composition-card" style={{border:"1px solid #e4e4e7",borderRadius:12,overflow:"hidden"}}>
              <div className="logo-composition-preview" style={{background:"#111114",display:"flex",alignItems:"center",padding:12}}><img src={invertedUrl} alt="다크 배경용 PNG" style={{width:"100%",maxHeight:116,objectFit:"contain"}}/></div>
              <div style={{padding:"12px 12px 6px"}}><b style={{fontSize:12}}>다크 배경용 PNG</b><p style={{fontSize:11,color:"#71717a"}}>자동 생성한 다운로드 파일이에요.</p></div>
              <div style={{gridColumn:2,padding:"4px 12px 12px"}}><button className="logo-candidate-apply" onClick={()=>void grab(invertedUrl,`${brand.id}-dark.png`)}>PNG 다운로드</button>{candidateActions(`generated-dark:${presentationAssetFile(brand,brand.logo_png)||"logo.png"}`,"다크 배경용 PNG","dark",true)}</div>
            </div>}
            {variants.map(v=>{
              const bg=candidateBg(v.file,v.bg==="dark"?"dark":"light");
              return <div key={v.file} className="logo-composition-card" style={{border:"1px solid #e4e4e7",borderRadius:12,overflow:"hidden"}}>
                <div className="logo-composition-preview" style={{...(bg==="dark"?DARK_TILE:CHECKER),display:"flex",alignItems:"center",padding:12}}><img src={cdnUrl(v.file)} alt={t(v.name)} style={{width:"100%",maxHeight:116,objectFit:"contain"}}/></div>
                <div style={{padding:"12px 12px 6px"}}><b style={{fontSize:12}}>{t(v.name)}</b><p style={{fontSize:11,color:"#71717a",marginTop:4}}>{t(v.desc)}</p></div>
                <div style={{gridColumn:2,padding:"4px 12px 12px"}}><button className="logo-candidate-apply" onClick={()=>void grab(cdnUrl(v.file),`${brand.id}-${v.file}`)}>{v.file.endsWith(".svg")?"SVG":"PNG"} 다운로드</button>{candidateActions(v.file,v.name,bg)}</div>
              </div>;
            })}
            </div>
          </section>
        </div>

        {/* ── RIGHT: 퍼가요 + 임베드 + 제보 + 광고 ── */}
        <div className={`mscroll brand-inner-right`} style={{ overflowY: isPage ? undefined : "auto", borderLeft:"1px solid #e4e4e7", display:"flex", flexDirection:"column", scrollbarWidth:"thin" }}>

          {/* 공유 — 무엇을 복사할지 고르고 버튼 하나로 실행한다 */}
          <div style={{ padding:"14px 16px", borderBottom:"1px solid #e4e4e7" }}>
            <div style={{ fontSize: 11, fontWeight:700, color:"#71717a", letterSpacing:".08em", textTransform:"uppercase", marginBottom:10 }}><T>{"공유하기 🎉"}</T></div>

            {/* 무엇을 복사할지 */}
            <div style={{ display:"flex", gap:4, marginBottom:8 }}>
              {SHARE_TABS.map(t => {
                const on = shareTab === t.key;
                return (
                  <button key={t.key} onClick={() => setShareTab(t.key)}
                    style={{ flex:1, padding:"6px 0", borderRadius:7, fontSize:11, fontWeight:600, cursor:"pointer",
                             background: on ? "#111" : "#f4f4f5", color: on ? "#fff" : "#71717a",
                             border: `1px solid ${on ? "#111" : "#e4e4e7"}`, transition:"all .12s" }}>
                    <T>{t.label}</T>
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
              {copyDone ? t("✅ 복사됐어요") : t("📋 복사하기")}
            </button>

            {shareFeed.length > 0 && (
              <div style={{ marginTop:12 }}>
                <div style={{ fontSize: 11, fontWeight:700, color:"#71717a", letterSpacing:".06em", textTransform:"uppercase", marginBottom:5 }}><T>{"최근 활동"}</T></div>
                {shareFeed.slice(-6).map((s, i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:4, padding:"3px 0", borderBottom:"1px solid #f0f0f2" }}>
                    <span>{s.emoji}</span>
                    <span style={{ fontSize: 12, color:"#3f3f46", flex:1 }}>
                      {s.type === "vote" ? <><span style={{ color:"#6366f1" }}>"{s.label}"</span><T>{"추천 👍"}</T></>
                       : s.type === "swap" ? <><span style={{ color:"#f59e0b" }}>"{s.label}"</span><T>{"교체 요청 🔄"}</T></>
                       : t("퍼가기 🎉")}
                    </span>
                    <span style={{ fontSize: 11, color:"#71717a" }}>{relTime(s.ts)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 제보 & 개선 */}
          <div style={{ padding:"14px 16px", borderBottom:"1px solid #e4e4e7" }}>
            <div style={{ fontSize: 11, fontWeight:700, color:"#71717a", letterSpacing:".08em", textTransform:"uppercase", marginBottom:10 }}><T>{"제보 & 개선"}</T></div>
            <button onClick={() => setReportOpen(o => !o)}
              style={{ width:"100%", padding:"9px 0", borderRadius:8, fontSize:11, fontWeight:600, background:"#f4f4f5", color:"#52525b", border:"1px solid #e4e4e7", cursor:"pointer" }}>
              {reportOpen ? t("↩ 접기") : t("✉️ 더 좋은 버전 제보하기")}
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
                    {reportStatus === "sending" ? t("전송 중…") : reportStatus === "done" ? t("✅ 감사합니다!") : t("전송")}
                  </button>
                  <button type="button" onClick={() => setReportOpen(false)}
                    style={{ padding:"7px 14px", borderRadius:8, fontSize:11, fontWeight:600, background:"#f4f4f5", color:"#52525b", border:"1px solid #e4e4e7", cursor:"pointer" }}><T>{"취소"}</T></button>
                </div>
              </form>
            )}
            {/* 새 로고 제보 링크 */}
            <Link href="/submit" style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:5, marginTop:8, padding:"8px 0", borderRadius:8, fontSize:11, fontWeight:500, color:"#6366f1", border:"1px solid rgba(99,102,241,.25)", background:"rgba(99,102,241,.05)", textDecoration:"none" }}><T>{"➕ 새 브랜드 로고 제보하기"}</T></Link>
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

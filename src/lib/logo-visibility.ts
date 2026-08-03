/**
 * 로고 다크 배경 시인성 분석 엔진
 *
 * 규칙 우선순위:
 * 1. logo-transparent.png 존재 → 픽셀 분석 → dark-safe / white-only
 * 2. logo.png 픽셀 분석 → 어두운 비율 / 채색 비율
 * 3. 판별 불가 → unknown (체커 패턴)
 *
 * 절대 반전하지 않는다 — 반전 로고는 브랜드 훼손.
 */

export type DarkMode =
  | "dark-safe"   // 다크 배경에 안전 (투명 PNG 또는 컬러풀)
  | "white-only"  // 어두운 로고 → 흰 배경 강제
  | "colorful"    // 채색이 강해 다크 배경에서도 잘 보임
  | "unknown";    // 분석 불가 (체커 패턴 표시)

export interface VisibilityResult {
  darkMode: DarkMode;
  analyzedAt: number;
  hasTransparent: boolean; // logo-transparent.png 존재 여부
  confidence: number;      // 0~1 (높을수록 신뢰)
}

const CACHE_KEY = (id: string) => `semo-vis-v2:${id}`;
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30일

/** 이미지 로드 (5초 타임아웃) */
function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timer = setTimeout(() => resolve(null), 5000);
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = url;
  });
}

interface PixelStats {
  darkRatio: number;    // R,G,B < 60 픽셀 비율
  brightRatio: number;  // 밝기 > 200 픽셀 비율
  colorRatio: number;   // 채도 > 40% 픽셀 비율
  whiteRatio: number;   // R,G,B > 240 픽셀 비율 (배경으로 볼 수 있는 흰색)
  totalVisible: number; // 투명 아닌 픽셀 수
}

/** Canvas로 픽셀 통계 추출 (100×100 리샘플) */
function analyzePixels(img: HTMLImageElement): PixelStats {
  const SAMPLE = 80;
  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE;
  canvas.height = SAMPLE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { darkRatio: 0, brightRatio: 0, colorRatio: 0, whiteRatio: 0, totalVisible: 0 };

  ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
  const { data } = ctx.getImageData(0, 0, SAMPLE, SAMPLE);

  let dark = 0, bright = 0, color = 0, white = 0, total = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 20) continue; // 투명 픽셀 제외
    total++;

    const luma = r * 0.299 + g * 0.587 + b * 0.114;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;

    if (r < 60 && g < 60 && b < 60) dark++;
    if (luma > 200) bright++;
    if (r > 240 && g > 240 && b > 240) white++;
    if (sat > 0.35 && luma > 30 && luma < 230) color++;
  }

  if (total === 0) return { darkRatio: 0, brightRatio: 0, colorRatio: 0, whiteRatio: 0, totalVisible: 0 };
  return {
    darkRatio: dark / total,
    brightRatio: bright / total,
    colorRatio: color / total,
    whiteRatio: white / total,
    totalVisible: total,
  };
}

/**
 * 시인성 규칙 적용
 *
 * transparent 버전 분석:
 * - 밝은 픽셀(흰/컬러) 비율이 높음 → 투명 배경에 밝은 로고 → dark-safe
 * - 어두운 픽셀 비율이 높음 → 검은 로고 → white-only
 *
 * 일반 PNG 분석:
 * - 어두운 픽셀 > 35% → white-only (검은 로고)
 * - 흰 배경 픽셀 > 50% → 흰 배경 로고 → 추가 판단 필요
 * - 컬러 픽셀 > 20% → colorful (다크 배경 안전)
 */
function applyRules(stats: PixelStats, isTransparent: boolean): DarkMode {
  const { darkRatio, brightRatio, colorRatio, whiteRatio } = stats;

  if (isTransparent) {
    // 투명 PNG: 배경이 없으므로 로고 픽셀만 분석
    if (darkRatio > 0.25) return "white-only"; // 검은 로고 → 흰 배경
    if (brightRatio > 0.2 || colorRatio > 0.1) return "dark-safe"; // 밝거나 컬러 → 다크 안전
    if (darkRatio < 0.05) return "colorful"; // 거의 색상만 → 컬러풀
    return "dark-safe"; // 투명 PNG 있으면 기본적으로 다크 안전
  }

  // 일반 PNG 분석
  // 흰 배경이 지배적이면 실제 로고 색상은 다른 곳에
  const adjustedDark = whiteRatio > 0.5 ? darkRatio / (1 - whiteRatio + 0.001) : darkRatio;

  if (adjustedDark > 0.45) return "white-only"; // 로고 자체가 어두움
  if (colorRatio > 0.2) return "colorful";       // 충분한 채색
  if (brightRatio > 0.5 && whiteRatio > 0.4) return "white-only"; // 흰 배경에 밝은 로고 = 흰 로고일 가능성
  if (colorRatio > 0.08) return "colorful";
  return "unknown";
}

/** 브랜드 로고 시인성 분석 (캐시 우선) */
export async function analyzeLogoVisibility(
  brandId: string,
  pngUrl: string,
  transparentUrl: string
): Promise<VisibilityResult> {
  if (typeof window === "undefined") {
    return { darkMode: "unknown", analyzedAt: 0, hasTransparent: false, confidence: 0 };
  }

  // 캐시 확인
  try {
    const cached = localStorage.getItem(CACHE_KEY(brandId));
    if (cached) {
      const parsed = JSON.parse(cached) as VisibilityResult;
      if (Date.now() - parsed.analyzedAt < CACHE_TTL) return parsed;
    }
  } catch {}

  // Step 1: 투명 PNG 시도
  const transImg = await loadImage(transparentUrl);
  if (transImg) {
    const stats = analyzePixels(transImg);
    const darkMode = applyRules(stats, true);
    const result: VisibilityResult = {
      darkMode,
      analyzedAt: Date.now(),
      hasTransparent: true,
      confidence: 0.88,
    };
    try { localStorage.setItem(CACHE_KEY(brandId), JSON.stringify(result)); } catch {}
    return result;
  }

  // Step 2: 일반 PNG 분석
  const mainImg = await loadImage(pngUrl);
  if (!mainImg) {
    const result: VisibilityResult = { darkMode: "unknown", analyzedAt: Date.now(), hasTransparent: false, confidence: 0 };
    try { localStorage.setItem(CACHE_KEY(brandId), JSON.stringify(result)); } catch {}
    return result;
  }

  const stats = analyzePixels(mainImg);
  const darkMode = applyRules(stats, false);
  const result: VisibilityResult = {
    darkMode,
    analyzedAt: Date.now(),
    hasTransparent: false,
    confidence: 0.70,
  };
  try { localStorage.setItem(CACHE_KEY(brandId), JSON.stringify(result)); } catch {}
  return result;
}

/** 캐시 강제 초기화 (규칙 업데이트 시 사용) */
export function clearVisibilityCache(brandId?: string) {
  if (typeof window === "undefined") return;
  if (brandId) {
    localStorage.removeItem(CACHE_KEY(brandId));
  } else {
    const keys = Object.keys(localStorage).filter(k => k.startsWith("semo-vis-v2:"));
    keys.forEach(k => localStorage.removeItem(k));
  }
}

/** 다크 미리보기 배경 스타일 반환 */
export function getDarkPreviewStyle(result: VisibilityResult | null): React.CSSProperties {
  if (!result || result.darkMode === "unknown") {
    return {
      backgroundColor: "#f8f8f8",
      backgroundImage: `
        linear-gradient(rgba(0,0,0,0.055) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,0,0,0.055) 1px, transparent 1px)
      `,
      backgroundSize: "12px 12px",
    };
  }
  if (result.darkMode === "white-only") return { background: "#ffffff" };
  return { background: "#111114" }; // dark-safe / colorful
}

/** 다크 미리보기에 사용할 이미지 URL 반환 */
export function getDarkPreviewUrl(
  result: VisibilityResult | null,
  transparentUrl: string,
  mainUrl: string
): string {
  if (!result) return mainUrl;
  if (result.darkMode === "white-only") return mainUrl;
  if (result.hasTransparent) return transparentUrl;
  return mainUrl;
}

/** 다크 미리보기 라벨 */
export function getDarkPreviewLabel(result: VisibilityResult | null): string {
  if (!result || result.darkMode === "unknown") return "배경 미확인";
  if (result.darkMode === "white-only") return "밝은 배경 전용";
  if (result.darkMode === "dark-safe") return "다크 배경 최적화";
  if (result.darkMode === "colorful") return "다크 배경 호환";
  return "";
}

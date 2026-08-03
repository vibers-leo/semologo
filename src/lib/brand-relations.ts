export type RelationType = "인수됨" | "구사명" | "모회사" | "자회사" | "합병" | "분사" | "파트너";

export interface BrandRelation {
  relatedId: string;
  type: RelationType;
  note?: string;
}

export const BRAND_RELATIONS: Record<string, BrandRelation[]> = {
  // 대우조선해양 → 한화오션으로 인수 (2023)
  "daewoo-shipbuilding": [
    { relatedId: "hanwha-ocean", type: "인수됨", note: "2023" },
  ],
  "hanwha-ocean": [
    { relatedId: "daewoo-shipbuilding", type: "구사명" },
  ],

  // 대우전자 → 위니아전자
  "logo-daewoo-electronics-south-korea": [
    { relatedId: "logo-wordmark-daewoo-electronics-now-winia-electronics", type: "인수됨" },
  ],
  "logo-wordmark-daewoo-electronics-now-winia-electronics": [
    { relatedId: "logo-daewoo-electronics-south-korea", type: "구사명" },
  ],
};

export const RELATION_LABEL: Record<RelationType, string> = {
  "인수됨":  "→ 인수됨",
  "구사명":  "← 구 사명",
  "모회사":  "모회사",
  "자회사":  "자회사",
  "합병":    "합병",
  "분사":    "분사",
  "파트너":  "파트너",
};

export const RELATION_COLOR: Record<RelationType, { bg: string; color: string; border: string }> = {
  "인수됨":  { bg: "#fef3c7", color: "#92400e", border: "#fde68a" },
  "구사명":  { bg: "#ede9fe", color: "#5b21b6", border: "#ddd6fe" },
  "모회사":  { bg: "#dbeafe", color: "#1e40af", border: "#bfdbfe" },
  "자회사":  { bg: "#dcfce7", color: "#166534", border: "#bbf7d0" },
  "합병":    { bg: "#fce7f3", color: "#9d174d", border: "#fbcfe8" },
  "분사":    { bg: "#f3f4f6", color: "#374151", border: "#e5e7eb" },
  "파트너":  { bg: "#ecfeff", color: "#155e75", border: "#a5f3fc" },
};

import type { Brand } from "./brands";

/** 정적 빌드가 빈 브랜드 목록으로 성공하는 사고를 막기 위한 최소 기준. */
export const MIN_BRAND_COUNT = 1_000;

export function parseBrandList(payload: unknown): Brand[] {
  if (Array.isArray(payload)) return payload as Brand[];
  if (
    payload &&
    typeof payload === "object" &&
    "brands" in payload &&
    Array.isArray(payload.brands)
  ) {
    return payload.brands as Brand[];
  }
  return [];
}

export function hasUsableBrandData(brands: Brand[]): boolean {
  return brands.length >= MIN_BRAND_COUNT && brands.every(
    (brand) => typeof brand.id === "string" && brand.id.length > 0,
  );
}

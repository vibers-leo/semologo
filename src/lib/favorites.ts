"use client";
import { useSyncExternalStore } from "react";
import type { Brand } from "./brands";
const FAVORITES_STORAGE_SLOT = "semologo.favorites.v1";
const EMPTY: Brand[] = [];
let raw: string | null = null;
let cached: Brand[] = EMPTY;
function snapshot() {
  try {
    const next = localStorage.getItem(FAVORITES_STORAGE_SLOT);
    if(next !== raw) { raw = next; const parsed = JSON.parse(next || "[]"); cached = Array.isArray(parsed) ? parsed.filter(b => b && typeof b.id === "string" && /^[a-z0-9-]+$/i.test(b.id) && typeof b.name_ko === "string").slice(0, 1000) : EMPTY; }
  } catch { cached = EMPTY; }
  return cached;
}
function subscribe(cb: () => void) {
  window.addEventListener("storage", cb); window.addEventListener("semologo-favorites", cb);
  return () => {window.removeEventListener("storage", cb); window.removeEventListener("semologo-favorites", cb);};
}
export function useFavorites() { return useSyncExternalStore(subscribe, snapshot, () => EMPTY); }
export function toggleFavorite(brand: Brand) {
  const current = snapshot();
  const saved = current.some(b => b.id === brand.id);
  if(!saved && current.length >= 1000) throw new Error("limit");
  const {id, name_ko, name_en, category, logo_svg, logo_png, has_svg, has_png, light} = brand;
  localStorage.setItem(FAVORITES_STORAGE_SLOT, JSON.stringify(saved ? current.filter(b => b.id !== id) : [{id, name_ko, name_en, category, logo_svg, logo_png, has_svg, has_png, light}, ...current]));
  window.dispatchEvent(new Event("semologo-favorites"));
  return !saved;
}

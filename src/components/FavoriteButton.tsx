"use client";
import { useState } from "react";
import type { Brand } from "@/lib/brands";
import { useFavorites, toggleFavorite } from "@/lib/favorites";
import { useLocale } from "@/lib/locale-context";
import { trackEvent } from "@/lib/analytics";
export default function FavoriteButton({brand}: {brand: Brand}) {
  const {en} = useLocale(); const favorites = useFavorites(); const [error, setError] = useState(false);
  const saved = favorites.some(b => b.id === brand.id);
  return <span className="inline-flex flex-col items-start">
    <button type="button" aria-pressed={saved} aria-label={en ? (saved ? "Remove from favorites" : "Save to favorites") : (saved ? "즐겨찾기 해제" : "즐겨찾기 추가")}
      onClick={e => {e.stopPropagation(); e.preventDefault(); try {const added = toggleFavorite(brand); setError(false); trackEvent(added ? "favorite_added" : "favorite_removed", {brand_id: brand.id});} catch {setError(true);} }}
      className="rounded-full border bg-white px-2.5 py-1.5 text-xs font-medium text-gray-800 hover:bg-amber-50">
      {saved ? "★" : "☆"} {en ? (saved ? "Saved" : "Save") : (saved ? "저장됨" : "저장")}
    </button>
    {error && <span role="status" className="text-xs text-red-700">{en ? "Storage unavailable or 1,000-logo limit reached." : "저장 공간을 사용할 수 없거나 1,000개 한도에 도달했어요."}</span>}
  </span>;
}

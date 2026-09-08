"use client";
import Link from "next/link";
import Header from "./Header";
import FavoriteButton from "./FavoriteButton";
import { useFavorites } from "@/lib/favorites";
import { useLocale } from "@/lib/locale-context";
import { CDN, VERSION } from "@/lib/cdn";
import { useState, useEffect } from "react";
import { trackEvent } from "@/lib/analytics";
export default function FavoritesPage() {
  const favorites = useFavorites(); const {en, path} = useLocale(); const [ready, setReady] = useState(false);
  const [help, setHelp] = useState(false);
  useEffect(() => setReady(true), []);
  return <><Header /><main className="mx-auto max-w-5xl px-4 py-10 pb-28">
    <h1 className="text-3xl font-bold">{en ? "Your saved logos" : "즐겨찾는 로고"}</h1>
    <p className="mt-3 text-sm text-gray-500">{en ? "No account needed. Favorites stay in this browser and are shared between Korean and English. Clearing browser data removes them." : "로그인 없이 이 브라우저에 저장돼요. 한·영 화면에서 함께 쓸 수 있고, 브라우저 데이터를 지우면 목록도 사라져요."}</p>
    <button className="mt-5 rounded-full border px-4 py-2 text-sm" aria-expanded={help} onClick={() => {setHelp(!help); trackEvent("bookmark_help_opened");}}>{en ? "Bookmark SemoLogo" : "세모로고를 브라우저 즐겨찾기에 추가"}</button>
    {help && <p className="my-3 rounded-xl bg-gray-50 p-4 text-sm" role="status">{en ? "On desktop, press Ctrl+D (Windows) or ⌘D (Mac). On mobile, open the browser menu or Share menu and choose Bookmark or Add to Home Screen if available." : "PC에서는 Ctrl+D, Mac에서는 ⌘D를 눌러주세요. 모바일에서는 브라우저 메뉴나 공유 메뉴에서 ‘북마크’ 또는 ‘홈 화면에 추가’를 선택해 주세요. 브라우저에 따라 메뉴가 달라요."}</p>}
    {!ready ? <p className="mt-10">{en ? "Loading…" : "불러오는 중이에요…"}</p> : favorites.length === 0 ? <div className="my-12 rounded-2xl border p-8"><p>{en ? "Save logos with the ☆ button to find them here next time." : "로고의 ☆ 저장 버튼을 누르면 다음에 여기서 바로 찾을 수 있어요."}</p><Link className="mt-4 inline-block underline" href={path("/")}>{en ? "Explore logos" : "로고 둘러보기"}</Link></div> : <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">{favorites.map(b => <article key={b.id} className="rounded-xl border p-3">
      <Link href={path(`/brand/${b.id}`)}><div className="flex h-28 items-center justify-center rounded-lg" style={{background: b.light ? "#18181b" : "#f9fafb"}}><img className="max-h-24 max-w-full object-contain" src={`${CDN}/${b.id}/logo.${b.has_svg || b.logo_svg ? "svg" : "png"}?v=${VERSION}`} alt={en ? b.name_en || b.name_ko : b.name_ko} onError={e => {e.currentTarget.style.visibility="hidden";}} /></div><h2 className="my-3 truncate font-semibold">{en ? b.name_en || b.name_ko : b.name_ko}</h2></Link><FavoriteButton brand={b}/>
    </article>)}</div>}
  </main></>;
}

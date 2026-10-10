"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { trackEvent } from "@/lib/analytics";

/** 브라우저 보안상 자동 북마크 대신, 운영체제별 저장 방법을 안내한다. */
export default function BookmarkPrompt() {
  const { en } = useLocale();
  const [open, setOpen] = useState(false);
  const [bookmarkUrl, setBookmarkUrl] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const toggle = () => {
    if (!open) {
      trackEvent("bookmark_help_opened");
      const url = new URL(window.location.href);
      for (const key of [...url.searchParams.keys()]) if (key.startsWith('utm_')) url.searchParams.delete(key);
      url.searchParams.set('utm_source', 'bookmark');
      url.searchParams.set('utm_medium', 'saved_link');
      url.searchParams.set('utm_campaign', 'header_bookmark');
      // Ctrl+D saves the current address; changing it here does not count as a visit.
      window.history.replaceState(window.history.state, '', url);
      setBookmarkUrl(url.href);
      setCopyStatus('');
    }
    setOpen(!open);
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(bookmarkUrl);
      trackEvent('bookmark_link_copied');
      setCopyStatus(en ? 'Link copied' : '주소를 복사했어요');
    } catch { setCopyStatus(en ? 'Select and copy the link below.' : '아래 주소를 선택해 복사해 주세요.'); }
  };

  return (
    <div className="relative shrink-0" ref={ref}>
      <button type="button" onClick={toggle} aria-expanded={open}
        aria-label={en ? "Add SemoLogo to browser bookmarks" : "세모로고를 브라우저 즐겨찾기에 추가"}
        className="text-xs font-medium whitespace-nowrap">
        ☆ <span className="hidden lg:inline">{en ? "Bookmark" : "즐겨찾기"}</span>
      </button>
      {open && <div role="dialog" aria-label={en ? "Bookmark instructions" : "즐겨찾기 안내"}
        className="absolute right-0 top-full mt-3 w-[min(88vw,320px)] rounded-2xl border p-4 text-sm shadow-xl z-[60]"
        style={{ background: "#fff", borderColor: "var(--border)" }}>
        <p className="font-semibold">{en ? "Keep SemoLogo close" : "세모로고를 바로 열어보세요"}</p>
        <p className="mt-1 text-xs leading-5 text-gray-500">{en ? "Save this site in your browser for the next logo search." : "다음에 로고를 찾을 때 바로 열 수 있도록 이 사이트를 브라우저에 저장해요."}</p>
        <div className="mt-3 rounded-xl bg-gray-50 p-3 text-xs leading-5">
          <p><strong>{en ? "Desktop" : "PC"}</strong> · {en ? "Press Ctrl+D (Windows/Linux) or ⌘D (Mac)." : "Ctrl+D(Windows/Linux) 또는 ⌘D(Mac)를 눌러주세요."}</p>
          <p className="mt-2"><strong>{en ? "Mobile" : "모바일"}</strong> · {en ? "Open the browser menu or Share menu, then choose Bookmark or Add to Home Screen." : "브라우저 메뉴나 공유 메뉴에서 ‘북마크’ 또는 ‘홈 화면에 추가’를 선택해 주세요."}</p>
        </div>
        <a href={bookmarkUrl} draggable className="mt-3 block text-xs underline">{en ? 'Drag this link to your bookmarks bar' : '이 링크를 즐겨찾기 모음으로 끌어 놓아도 돼요'}</a>
        <button type="button" onClick={()=>void copyLink()} className="mt-3 rounded-lg border px-3 py-2 text-xs">{en ? 'Copy bookmark link' : '즐겨찾기 주소 복사'}</button>
        <p role="status" className="mt-2 break-all text-xs text-gray-500">{copyStatus}</p>
        {copyStatus && <input aria-label={en ? 'Bookmark URL' : '즐겨찾기 주소'} readOnly value={bookmarkUrl} onFocus={e=>e.target.select()} className="mt-1 w-full rounded border p-2 text-xs"/>}
      </div>}
    </div>
  );
}

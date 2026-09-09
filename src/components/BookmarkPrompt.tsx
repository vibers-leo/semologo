"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { trackEvent } from "@/lib/analytics";

/** 브라우저 보안상 자동 북마크 대신, 운영체제별 저장 방법을 안내한다. */
export default function BookmarkPrompt() {
  const { en } = useLocale();
  const [open, setOpen] = useState(false);
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
    setOpen(value => {
      const next = !value;
      if (next) trackEvent("bookmark_help_opened");
      return next;
    });
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
      </div>}
    </div>
  );
}

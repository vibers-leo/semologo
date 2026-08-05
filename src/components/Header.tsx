"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { getClientAuth } from "@/lib/firebase";
import { useSearch } from "@/lib/search-context";

function UserMenu({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const handleSignOut = async () => {
    await signOut(getClientAuth());
    setOpen(false);
    router.refresh();
  };
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2">
        {user.photoURL
          ? <img src={user.photoURL} alt="" width={28} height={28} className="rounded-full" />
          : <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold">{user.displayName?.[0] ?? "U"}</div>
        }
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-40 rounded-xl border shadow-lg overflow-hidden z-50"
          style={{ background: "#fff", borderColor: "var(--border)" }}>
          <button onClick={handleSignOut}
            className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-colors">
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}

const ADMIN_EMAIL = "juuuno1116@gmail.com";

export default function Header() {
  const { query, setQuery } = useSearch();
  const [user, setUser] = useState<User | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(getClientAuth(), u => {
      setUser(u);
      setAuthLoaded(true);
    });
    return unsub;
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b"
      style={{ background: "rgba(255,255,255,0.97)", backdropFilter: "blur(8px)", borderColor: "var(--border)" }}>
      <div className="max-w-[1600px] mx-auto px-6 h-20 flex items-center gap-4">

        {/* 로고 */}
        <Link href="/" className="shrink-0 flex items-center" onClick={() => setQuery("")}>
          <Image src="/semologo.png" alt="세모로고" width={983} height={265}
            className="h-14 w-auto object-contain" priority />
        </Link>

        {/* 검색바 — 중앙 고정폭 */}
        <div className="relative w-[480px] shrink-0 mx-auto">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="브랜드 검색 — 삼성, Nike, Starbucks..."
            className="w-full pl-10 pr-9 py-2.5 text-sm rounded-full border outline-none transition-colors"
            style={{ border: "1.5px solid var(--border)", background: "var(--surface)", fontFamily: "inherit" }}
            onFocus={e => (e.currentTarget.style.borderColor = "#111")}
            onBlur={e => (e.currentTarget.style.borderColor = "var(--border)")}
            autoComplete="off"
          />
          {query && (
            <button onClick={() => setQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>

        {/* 우측 메뉴 */}
        <nav className="flex items-center gap-2 shrink-0 ml-auto">
          <Link href="/request"
            className="hidden sm:flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors hover:bg-gray-100"
            style={{ color: "var(--text-secondary)" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            로고 요청
          </Link>
          <Link href="/submit"
            className="hidden sm:flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors hover:bg-gray-100"
            style={{ color: "var(--text-secondary)" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            로고 제보
          </Link>
          {user?.email === ADMIN_EMAIL && (
            <Link href="/requests"
              className="hidden sm:block text-sm px-2 py-1.5 rounded-lg transition-colors hover:bg-gray-100"
              style={{ color: "#a1a1aa", fontSize: 11 }}>
              관리
            </Link>
          )}
          {authLoaded && (
            user
              ? <UserMenu user={user} />
              : (
                <Link href="/login"
                  className="text-sm px-3 py-1.5 rounded-full font-medium text-white ml-1"
                  style={{ background: "#111" }}>
                  로그인
                </Link>
              )
          )}
        </nav>
      </div>
    </header>
  );
}

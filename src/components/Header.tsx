"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
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

const NAV_LINKS = [
  { label: "로고 제보", href: "/submit" },
  { label: "로고 요청", href: "/request" },
  { label: "자주 묻는 질문", href: "/faq" },
];

export default function Header() {
  const { query, setQuery } = useSearch();
  const [user, setUser] = useState<User | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  useEffect(() => {
    const unsub = onAuthStateChanged(getClientAuth(), u => {
      setUser(u);
      setAuthLoaded(true);
    });
    return unsub;
  }, []);

  const SearchBar = ({ className }: { className?: string }) => (
    <div className={`relative ${className ?? ""}`}>
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
        style={{ border: "1.5px solid var(--border)", background: "var(--surface)", fontFamily: "inherit", fontSize: 16 }}
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
  );

  return (
    <header className="sticky top-0 z-50 border-b"
      style={{ background: "rgba(255,255,255,0.97)", backdropFilter: "blur(8px)", borderColor: "var(--border)" }}>
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6">

        {/* Row 1: 로고 + (데스크탑: 검색바 + 메뉴) / (모바일: 오른쪽 버튼들) */}
        <div className="flex items-center gap-3 h-14 sm:h-20">

          {/* 로고 */}
          <Link href="/" className="shrink-0 flex items-center" onClick={() => setQuery("")}>
            <Image src="/semologo.png" alt="세모로고" width={983} height={265}
              className="h-9 sm:h-14 w-auto object-contain" priority />
          </Link>

          {/* 데스크탑 전용 검색바 */}
          <SearchBar className="hidden sm:block relative w-[480px] shrink-0 mx-auto" />

          {/* 데스크탑 우측 메뉴 */}
          <nav className="hidden sm:flex items-center gap-2 shrink-0 ml-auto">
            {NAV_LINKS.map(({ label, href }) => (
              <Link key={href} href={href}
                className="flex items-center text-sm px-3 py-1.5 rounded-lg transition-colors hover:bg-gray-100"
                style={{ color: "var(--text-secondary)" }}>
                {label}
              </Link>
            ))}
            {user?.email === ADMIN_EMAIL && (
              <Link href="/requests"
                className="text-sm px-2 py-1.5 rounded-lg transition-colors hover:bg-gray-100"
                style={{ color: "#a1a1aa", fontSize: 11 }}>
                관리
              </Link>
            )}
            {authLoaded && (
              user
                ? <UserMenu user={user} />
                : (
                  <Link href="/login"
                    className="flex text-sm px-3 py-1.5 rounded-full font-medium text-white ml-1"
                    style={{ background: "#111" }}>
                    로그인
                  </Link>
                )
            )}
          </nav>

          {/* 모바일 오른쪽: 로그인 아이콘 + 햄버거 */}
          <div className="sm:hidden flex items-center gap-1 ml-auto">
            {authLoaded && !user && (
              <Link href="/login"
                className="flex items-center justify-center w-9 h-9 rounded-full"
                style={{ background: "#f4f4f5" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                </svg>
              </Link>
            )}
            {authLoaded && user && <UserMenu user={user} />}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(v => !v)}
                className="flex items-center justify-center w-11 h-11 rounded-lg transition-colors hover:bg-gray-100"
                style={{ color: "var(--text-secondary)" }}
                aria-label="메뉴 열기">
                {menuOpen
                  ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                  : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
                }
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-44 rounded-xl border shadow-lg overflow-hidden z-50"
                  style={{ background: "#fff", borderColor: "var(--border)" }}>
                  {NAV_LINKS.map(({ label, href }) => (
                    <Link key={href} href={href}
                      onClick={() => setMenuOpen(false)}
                      className="block px-4 py-3 text-sm hover:bg-gray-50 transition-colors"
                      style={{ color: "var(--text)" }}>
                      {label}
                    </Link>
                  ))}
                  {user?.email === ADMIN_EMAIL && (
                    <Link href="/requests" onClick={() => setMenuOpen(false)}
                      className="block px-4 py-3 text-xs hover:bg-gray-50 transition-colors"
                      style={{ color: "#a1a1aa" }}>
                      관리
                    </Link>
                  )}
                  <div className="border-t" style={{ borderColor: "var(--border)" }}>
                    {authLoaded && (
                      user
                        ? <button onClick={async () => { await signOut(getClientAuth()); setMenuOpen(false); }}
                            className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-colors"
                            style={{ color: "var(--text-secondary)" }}>
                            로그아웃
                          </button>
                        : <Link href="/login" onClick={() => setMenuOpen(false)}
                            className="block px-4 py-3 text-sm font-medium hover:bg-gray-50 transition-colors"
                            style={{ color: "#111" }}>
                            로그인
                          </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 2 (모바일 전용): 검색바 */}
        <div className="sm:hidden pb-3">
          <SearchBar />
        </div>

      </div>
    </header>
  );
}

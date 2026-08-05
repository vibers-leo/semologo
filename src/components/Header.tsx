"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { getClientAuth } from "@/lib/firebase";
import { useSearch } from "@/lib/search-context";

const CDN = "https://logo.vibers.co.kr/_clients";
const VERSION = "1785892694";

interface BrandItem {
  id: string;
  name_ko: string;
  name_en: string;
  category: string;
  logo_svg: boolean;
}

let _cache: BrandItem[] | null = null;

async function loadBrands(): Promise<BrandItem[]> {
  if (_cache) return _cache;
  try {
    const res = await fetch(`${CDN}/brands.json`, { next: { revalidate: 300 } });
    const data = await res.json();
    _cache = (data.brands || []).map((b: Record<string, unknown>) => ({
      id: b.id as string,
      name_ko: (b.name_ko as string) || "",
      name_en: (b.name_en as string) || "",
      category: (b.category as string) || "",
      logo_svg: !!(b.logo_svg),
    }));
  } catch {
    _cache = [];
  }
  return _cache!;
}

function scoreMatch(b: BrandItem, q: string): number {
  const ko = b.name_ko.toLowerCase();
  const en = b.name_en.toLowerCase();
  const id = b.id.toLowerCase();
  if (ko === q || en === q) return 3;
  if (ko.startsWith(q) || en.startsWith(q)) return 2;
  if (ko.includes(q) || en.includes(q) || id.includes(q)) return 1;
  return 0;
}

// ── 유저 메뉴 ──
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

// ── 메인 헤더 ──
export default function Header() {
  const { query, setQuery } = useSearch();
  const [inputVal, setInputVal] = useState(query);
  const [results, setResults] = useState<BrandItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [allBrands, setAllBrands] = useState<BrandItem[] | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(getClientAuth(), u => {
      setUser(u);
      setAuthLoaded(true);
    });
    return unsub;
  }, []);

  // 브랜드 데이터 lazy load
  const ensureBrands = useCallback(async () => {
    if (allBrands !== null) return allBrands;
    const data = await loadBrands();
    setAllBrands(data);
    return data;
  }, [allBrands]);

  // 검색어 변경 → 결과 계산
  const handleInput = useCallback(async (val: string) => {
    setInputVal(val);
    setQuery(val);
    setActiveIdx(-1);

    if (!val.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const brands = await ensureBrands();
    const q = val.toLowerCase().trim();
    const matched = brands
      .map(b => ({ b, score: scoreMatch(b, q) }))
      .filter(({ score }) => score > 0)
      .sort((a, x) => x.score - a.score)
      .slice(0, 8)
      .map(({ b }) => b);

    setResults(matched);
    setIsOpen(matched.length > 0);
  }, [ensureBrands, setQuery]);

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!dropRef.current?.contains(e.target as Node) && !inputRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectBrand = (b: BrandItem) => {
    setInputVal(b.name_ko);
    setIsOpen(false);
    window.location.href = `/brand/${b.id}`;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      if (activeIdx >= 0 && results[activeIdx]) {
        selectBrand(results[activeIdx]);
      } else {
        setIsOpen(false);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const logoSrc = (b: BrandItem) =>
    b.logo_svg
      ? `${CDN}/${b.id}/logo.svg?v=${VERSION}`
      : `${CDN}/${b.id}/logo.png?v=${VERSION}`;

  return (
    <header className="sticky top-0 z-50 border-b"
      style={{ background: "rgba(255,255,255,0.97)", backdropFilter: "blur(8px)", borderColor: "var(--border)" }}>
      <div className="max-w-[1280px] mx-auto px-4 h-16 flex items-center gap-3">

        {/* 로고 */}
        <Link href="/" className="shrink-0 flex items-center" onClick={() => { setInputVal(""); setQuery(""); }}>
          <Image src="/semologo.png" alt="세모로고" width={280} height={87} className="h-10 w-auto object-contain" priority />
        </Link>

        {/* 검색바 */}
        <div className="relative flex-1 max-w-[640px]">
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={inputVal}
              onChange={e => handleInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={async () => {
                if (inputVal.trim()) {
                  await handleInput(inputVal);
                }
              }}
              placeholder="브랜드 검색 — 삼성, Nike, Starbucks..."
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-full border outline-none transition-colors"
              style={{ border: "1.5px solid var(--border)", background: "var(--surface)", fontFamily: "inherit" }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "#bbb")}
              onMouseLeave={e => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.borderColor = "var(--border)"; }}
              onFocusCapture={e => (e.currentTarget.style.borderColor = "#111")}
              onBlurCapture={e => (e.currentTarget.style.borderColor = "var(--border)")}
              autoComplete="off"
            />
            {inputVal && (
              <button
                onClick={() => { setInputVal(""); setQuery(""); setIsOpen(false); inputRef.current?.focus(); }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>

          {/* 자동완성 드롭다운 */}
          {isOpen && results.length > 0 && (
            <div ref={dropRef}
              className="absolute top-full mt-2 left-0 right-0 rounded-xl border shadow-xl overflow-hidden z-50"
              style={{ background: "#fff", borderColor: "#e4e4e7" }}>
              {results.map((b, idx) => {
                const src = logoSrc(b);
                const isActive = idx === activeIdx;
                return (
                  <button key={b.id} onMouseDown={() => selectBrand(b)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                    style={{ background: isActive ? "#f4f4f5" : "transparent" }}
                    onMouseEnter={() => setActiveIdx(idx)}
                  >
                    <div className="shrink-0 w-10 h-10 rounded-lg overflow-hidden border flex items-center justify-center bg-gray-50"
                      style={{ borderColor: "#f0f0f0" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" width={32} height={32}
                        style={{ width: 32, height: 32, objectFit: "contain", objectPosition: "center" }}
                        onError={e => { (e.currentTarget as HTMLImageElement).src = `${CDN}/${b.id}/logo.png?v=${VERSION}`; }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">
                        {b.name_ko}
                        {b.name_en && b.name_en !== b.name_ko && (
                          <span className="ml-1.5 text-xs font-normal text-gray-400">{b.name_en}</span>
                        )}
                      </div>
                      {b.category && <div className="text-xs text-gray-400 mt-0.5">{b.category}</div>}
                    </div>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2">
                      <path d="m9 18 6-6-6-6"/>
                    </svg>
                  </button>
                );
              })}
              <div className="px-4 py-2 border-t text-xs text-gray-400" style={{ borderColor: "#f0f0f0" }}>
                Enter로 이동 · ↑↓ 탐색 · Esc 닫기
              </div>
            </div>
          )}
        </div>

        {/* 우측 메뉴 */}
        <nav className="flex items-center gap-1 shrink-0">
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

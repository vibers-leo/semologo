"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useCallback } from "react";

function SearchBar() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const sp = new URLSearchParams();
      if (q) sp.set("q", q);
      router.push(`/?${sp.toString()}`);
    },
    [q, router]
  );

  return (
    <form onSubmit={onSubmit} className="flex-1 max-w-[400px]">
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="브랜드 검색..."
          className="w-full pl-9 pr-4 py-2 text-sm rounded-full border outline-none transition-colors"
          style={{
            border: "1px solid var(--border)",
            background: "var(--surface)",
          }}
          onFocus={(e) =>
            (e.currentTarget.style.borderColor = "var(--border-hover)")
          }
          onBlur={(e) =>
            (e.currentTarget.style.borderColor = "var(--border)")
          }
        />
      </div>
    </form>
  );
}

export default function Header() {
  return (
    <header
      className="sticky top-0 z-50 border-b"
      style={{
        background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(8px)",
        borderColor: "var(--border)",
      }}
    >
      <div className="max-w-[1280px] mx-auto px-4 h-14 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Image
            src="/semologo.png"
            alt="세모로고"
            width={108}
            height={32}
            className="h-7 w-auto object-contain"
            priority
          />
        </Link>
        <Suspense>
          <SearchBar />
        </Suspense>
        <nav className="flex items-center gap-3 shrink-0 ml-auto">
          <Link
            href="/submit"
            className="text-sm px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: "var(--text-secondary)" }}
          >
            로고 제보
          </Link>
          <Link
            href="/login"
            className="text-sm px-3 py-1.5 rounded-full font-medium text-white"
            style={{ background: "#111" }}
          >
            로그인
          </Link>
        </nav>
      </div>
    </header>
  );
}

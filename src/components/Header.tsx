"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { getClientAuth } from "@/lib/firebase";

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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {user.photoURL ? (
          <img src={user.photoURL} alt="" width={30} height={30} className="rounded-full" />
        ) : (
          <div className="w-[30px] h-[30px] rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold">
            {user.displayName?.[0] ?? "U"}
          </div>
        )}
        <span className="text-sm font-medium hidden sm:block" style={{ maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {user.displayName?.split(" ")[0]}
        </span>
      </button>
      {open && (
        <div
          className="absolute right-0 mt-2 w-40 rounded-xl border shadow-lg overflow-hidden z-50"
          style={{ background: "#fff", borderColor: "var(--border)" }}
        >
          <button
            onClick={handleSignOut}
            className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-colors"
          >
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}

export default function Header() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getClientAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  return (
    <header
      className="sticky top-0 z-50 border-b"
      style={{ background: "rgba(255,255,255,0.97)", backdropFilter: "blur(8px)", borderColor: "var(--border)" }}
    >
      <div className="max-w-[1280px] mx-auto px-4 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Image
            src="/semologo.png"
            alt="세모로고"
            width={400}
            height={124}
            className="h-14 w-auto object-contain"
            priority
          />
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            href="/requests"
            className="hidden sm:block text-sm px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: "var(--text-secondary)" }}
          >
            요청 게시판
          </Link>
          <Link
            href="/submit"
            className="hidden sm:block text-sm px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: "var(--text-secondary)" }}
          >
            로고 제보
          </Link>
          {!loading && (
            user
              ? <UserMenu user={user} />
              : (
                <Link
                  href="/login"
                  className="text-sm px-3 py-1.5 rounded-full font-medium text-white"
                  style={{ background: "#111" }}
                >
                  로그인
                </Link>
              )
          )}
        </nav>
      </div>
    </header>
  );
}

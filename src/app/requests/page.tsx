"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { getClientAuth } from "@/lib/firebase";
import { listenLogoRequests, type LogoRequest } from "@/lib/logo-requests";
import Header from "@/components/Header";
import Link from "next/link";

const ADMIN_EMAIL = "juuuno1116@gmail.com";

export default function RequestsPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [requests, setRequests] = useState<LogoRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "done">("all");

  useEffect(() => {
    const unsub = onAuthStateChanged(getClientAuth(), (user) => {
      if (user?.email === ADMIN_EMAIL) {
        setIsAdmin(true);
      } else {
        router.replace("/");
      }
      setAuthChecked(true);
    });
    return unsub;
  }, [router]);

  useEffect(() => {
    if (!isAdmin) return;
    const unsub = listenLogoRequests((list) => {
      setRequests(list);
      setLoading(false);
    });
    return unsub;
  }, [isAdmin]);

  const filtered = filter === "all" ? requests : requests.filter((r) => r.status === filter);
  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const doneCount = requests.filter((r) => r.status === "done").length;

  if (!authChecked) return null;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <Header />
      <main className="max-w-[800px] mx-auto px-4 py-10">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">로고 요청 게시판</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              누군가 요청한 로고들이에요. 검토 후 추가되면 완료로 표시됩니다.
            </p>
          </div>
          <Link
            href="/submit/"
            className="shrink-0 px-4 py-2 rounded-full text-sm font-medium text-white"
            style={{ background: "#111" }}
          >
            + 요청하기
          </Link>
        </div>

        {/* 필터 탭 */}
        <div className="flex gap-2 mb-6">
          {[
            { key: "all", label: `전체 ${requests.length}` },
            { key: "pending", label: `요청 중 ${pendingCount}` },
            { key: "done", label: `완료 ${doneCount}` },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key as typeof filter)}
              className="px-3 py-1.5 text-sm rounded-full transition-colors"
              style={
                filter === t.key
                  ? { background: "#111", color: "#fff" }
                  : { background: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 목록 */}
        {loading ? (
          <div className="text-center py-20" style={{ color: "var(--text-secondary)" }}>불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20" style={{ color: "var(--text-secondary)" }}>
            <p className="text-3xl mb-3">📋</p>
            <p className="font-medium">아직 요청이 없어요</p>
            <Link href="/submit/" className="inline-block mt-4 text-sm underline">첫 번째로 요청하기</Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((req) => (
              <div
                key={req.id}
                className="flex items-center gap-4 px-5 py-4 rounded-xl border"
                style={{ borderColor: "var(--border)", background: "#fff" }}
              >
                {/* 상태 뱃지 */}
                <span
                  className="shrink-0 text-xs px-2.5 py-1 rounded-full font-medium"
                  style={
                    req.status === "done"
                      ? { background: "rgba(34,197,94,.1)", color: "#16a34a" }
                      : { background: "rgba(234,179,8,.1)", color: "#a16207" }
                  }
                >
                  {req.status === "done" ? "완료" : "요청 중"}
                </span>

                {/* 정보 */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">
                    {req.brandName}
                    {req.brandNameEn && req.brandNameEn !== req.brandName && (
                      <span className="font-normal ml-1.5" style={{ color: "var(--text-secondary)" }}>
                        / {req.brandNameEn}
                      </span>
                    )}
                  </p>
                  {req.website && (
                    <a
                      href={req.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs hover:underline truncate block"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {req.website}
                    </a>
                  )}
                  {req.note && (
                    <p className="text-xs mt-0.5 line-clamp-1" style={{ color: "#aaa" }}>{req.note}</p>
                  )}
                </div>

                {/* 날짜 + 요청자 */}
                <div className="shrink-0 text-right">
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {req.createdAt?.toDate().toLocaleDateString("ko-KR")}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "#ccc" }}>
                    {req.userDisplayName?.split(" ")[0]}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { getClientAuth } from "@/lib/firebase";
import { listenLogoRequests, updateRequestStatus, type LogoRequest } from "@/lib/logo-requests";
import { fetchBrands, type Brand } from "@/lib/brands";
import Header from "@/components/Header";

const ADMIN_EMAIL = "juuuno1116@gmail.com";
const CDN = process.env.NEXT_PUBLIC_CDN_URL || "https://logo.vibers.co.kr/_clients";

type Tab = "stats" | "requests" | "brands";

export default function AdminPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState<Tab>("stats");

  const [requests, setRequests] = useState<LogoRequest[]>([]);
  const [reqLoading, setReqLoading] = useState(true);
  const [reqFilter, setReqFilter] = useState<"all" | "pending" | "done">("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [brandSearch, setBrandSearch] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(getClientAuth(), (user) => {
      if (user?.email === ADMIN_EMAIL) {
        setIsAdmin(true);
      } else {
        router.replace("/login");
      }
      setAuthChecked(true);
    });
    return unsub;
  }, [router]);

  useEffect(() => {
    if (!isAdmin) return;
    const unsub = listenLogoRequests((list) => {
      setRequests(list);
      setReqLoading(false);
    });
    return unsub;
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    if (brands.length > 0) return;
    setBrandsLoading(true);
    fetchBrands().then((b) => { setBrands(b); setBrandsLoading(false); });
  }, [isAdmin, brands.length]);

  const pending = requests.filter((r) => r.status === "pending");
  const done = requests.filter((r) => r.status === "done");
  const filteredReqs = reqFilter === "all" ? requests : reqFilter === "pending" ? pending : done;

  const catStats = useMemo(() => {
    const map = new Map<string, number>();
    brands.forEach((b) => { const c = b.category || "기타"; map.set(c, (map.get(c) || 0) + 1); });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [brands]);

  const svgCount = brands.filter((b) => b.logo_svg).length;
  const pngOnly = brands.filter((b) => !b.logo_svg && b.logo_png).length;

  const filteredBrands = useMemo(() => {
    if (!brandSearch) return brands;
    const q = brandSearch.toLowerCase();
    return brands.filter((b) =>
      b.name_ko.toLowerCase().includes(q) ||
      b.name_en.toLowerCase().includes(q) ||
      b.id.toLowerCase().includes(q)
    );
  }, [brands, brandSearch]);

  const handleToggleStatus = async (req: LogoRequest) => {
    if (!req.id || updatingId) return;
    setUpdatingId(req.id);
    const next = req.status === "pending" ? "done" : "pending";
    await updateRequestStatus(req.id, next);
    setUpdatingId(null);
  };

  if (!authChecked) return null;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <Header />
      <main className="max-w-[1000px] mx-auto px-4 py-10 pb-24">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">세모로고 어드민</h1>
          <span className="text-xs px-2.5 py-1 rounded-full font-bold" style={{ background: "#111", color: "#fff" }}>
            SUPER ADMIN
          </span>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 mb-8 border-b" style={{ borderColor: "var(--border)" }}>
          {([
            { key: "stats", label: "통계" },
            { key: "requests", label: `요청 관리`, badge: pending.length },
            { key: "brands", label: `브랜드 목록` },
          ] as { key: Tab; label: string; badge?: number }[]).map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="pb-2.5 px-3 text-sm font-medium transition-colors relative"
              style={{
                color: tab === t.key ? "#111" : "var(--text-secondary)",
                borderBottom: tab === t.key ? "2px solid #111" : "2px solid transparent",
              }}>
              {t.label}
              {(t.badge ?? 0) > 0 && (
                <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-bold"
                  style={{ background: "rgba(234,179,8,.15)", color: "#a16207" }}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── 통계 탭 ── */}
        {tab === "stats" && (
          <div className="space-y-6">
            {brands.length === 0 ? (
              <p className="text-center py-10" style={{ color: "var(--text-secondary)" }}>
                로딩 중... (브랜드 탭 먼저 방문하면 즉시 표시)
              </p>
            ) : (
              <>
                {/* 요약 카드 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: "총 브랜드", value: brands.length.toLocaleString(), color: "#6366f1" },
                    { label: "SVG 보유", value: svgCount.toLocaleString(), color: "#10b981" },
                    { label: "PNG only", value: pngOnly.toLocaleString(), color: "#f59e0b" },
                    { label: "카테고리 수", value: catStats.length, color: "#8b5cf6" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-xl border p-4"
                      style={{ borderColor: "var(--border)", background: "#fff" }}>
                      <p className="text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>{label}</p>
                      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* 요청 현황 */}
                <div className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "#fff" }}>
                  <p className="text-sm font-bold mb-4">로고 요청 현황</p>
                  <div className="flex gap-8">
                    <div>
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>대기 중</p>
                      <p className="text-xl font-bold" style={{ color: "#a16207" }}>{pending.length}</p>
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>완료</p>
                      <p className="text-xl font-bold" style={{ color: "#16a34a" }}>{done.length}</p>
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>전체</p>
                      <p className="text-xl font-bold">{requests.length}</p>
                    </div>
                  </div>
                </div>

                {/* 카테고리 분포 */}
                <div className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "#fff" }}>
                  <p className="text-sm font-bold mb-4">카테고리별 브랜드 수</p>
                  <div className="space-y-2">
                    {catStats.map(([cat, count]) => {
                      const pct = Math.round((count / brands.length) * 100);
                      return (
                        <div key={cat} className="flex items-center gap-3">
                          <div className="text-xs w-32 truncate shrink-0" style={{ color: "var(--text-secondary)" }}>{cat}</div>
                          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "#f4f4f5" }}>
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "#111" }} />
                          </div>
                          <div className="text-xs font-medium w-12 text-right shrink-0">{count.toLocaleString()}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── 요청 관리 탭 ── */}
        {tab === "requests" && (
          <>
            <div className="flex gap-2 mb-5">
              {[
                { key: "all", label: `전체 ${requests.length}` },
                { key: "pending", label: `대기 ${pending.length}` },
                { key: "done", label: `완료 ${done.length}` },
              ].map((t) => (
                <button key={t.key} onClick={() => setReqFilter(t.key as typeof reqFilter)}
                  className="px-3 py-1.5 text-sm rounded-full transition-colors"
                  style={reqFilter === t.key
                    ? { background: "#111", color: "#fff" }
                    : { background: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }
                  }>
                  {t.label}
                </button>
              ))}
            </div>

            {reqLoading ? (
              <div className="text-center py-20" style={{ color: "var(--text-secondary)" }}>불러오는 중...</div>
            ) : filteredReqs.length === 0 ? (
              <div className="text-center py-20" style={{ color: "var(--text-secondary)" }}>
                <p className="text-3xl mb-3">📋</p>
                <p className="font-medium">요청이 없어요</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredReqs.map((req) => (
                  <div key={req.id}
                    className="flex items-center gap-4 px-5 py-4 rounded-xl border"
                    style={{ borderColor: "var(--border)", background: "#fff" }}>
                    <button
                      onClick={() => handleToggleStatus(req)}
                      disabled={updatingId === req.id}
                      className="shrink-0 text-xs px-2.5 py-1 rounded-full font-medium transition-colors"
                      style={req.status === "done"
                        ? { background: "rgba(34,197,94,.1)", color: "#16a34a", cursor: "pointer" }
                        : { background: "rgba(234,179,8,.1)", color: "#a16207", cursor: "pointer" }
                      }>
                      {updatingId === req.id ? "..." : req.status === "done" ? "✓ 완료" : "대기 중"}
                    </button>
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
                        <a href={req.website} target="_blank" rel="noopener noreferrer"
                          className="text-xs hover:underline truncate block" style={{ color: "var(--text-secondary)" }}>
                          {req.website}
                        </a>
                      )}
                      {req.note && (
                        <p className="text-xs mt-0.5" style={{ color: "#aaa" }}>{req.note}</p>
                      )}
                    </div>
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
          </>
        )}

        {/* ── 브랜드 목록 탭 ── */}
        {tab === "brands" && (
          <>
            <div className="flex items-center gap-3 mb-5">
              <div className="relative flex-1 max-w-xs">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input type="text" value={brandSearch} onChange={(e) => setBrandSearch(e.target.value)}
                  placeholder="브랜드 검색..."
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-full border outline-none"
                  style={{ border: "1.5px solid var(--border)", background: "var(--surface)" }} />
              </div>
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {filteredBrands.length.toLocaleString()}개
              </span>
            </div>

            {brandsLoading ? (
              <div className="text-center py-20" style={{ color: "var(--text-secondary)" }}>불러오는 중...</div>
            ) : (
              <div className="flex flex-col divide-y" style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
                {filteredBrands.slice(0, 200).map((brand) => (
                  <div key={brand.id} className="flex items-center gap-3 py-2.5 px-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`${CDN}/${brand.id}/logo.${brand.logo_svg ? "svg" : "png"}`}
                      alt={`${brand.name_ko} 로고`}
                      style={{ width: 36, height: 24, objectFit: "contain", flexShrink: 0, borderRadius: 4, border: "1px solid #f0f0f2" }}
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {brand.name_ko}
                        {brand.name_en && brand.name_en !== brand.name_ko && (
                          <span className="font-normal ml-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                            {brand.name_en}
                          </span>
                        )}
                      </p>
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{brand.id}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full shrink-0"
                      style={{ background: "#f4f4f5", color: "#71717a" }}>
                      {brand.category || "기타"}
                    </span>
                    <div className="flex gap-1 shrink-0">
                      {brand.logo_svg && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#eff6ff", color: "#3b82f6" }}>SVG</span>}
                      {brand.logo_png && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#f0fdf4", color: "#22c55e" }}>PNG</span>}
                    </div>
                  </div>
                ))}
                {filteredBrands.length > 200 && (
                  <p className="text-center py-4 text-sm" style={{ color: "var(--text-secondary)" }}>
                    검색으로 범위를 좁혀주세요 (200개 이상 생략)
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

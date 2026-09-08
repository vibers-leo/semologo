"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { getClientAuth } from "@/lib/firebase";
import { listenLogoRequests, updateRequestStatus, type LogoRequest } from "@/lib/logo-requests";
import { loadQualityRanking, resolveQuality, FLAG_THRESHOLD, type QualityEntry } from "@/lib/logo-quality";
import { fetchBrands, type Brand } from "@/lib/brands";
import { CDN } from "@/lib/cdn";
import Header from "@/components/Header";
import Link from "next/link";

const ADMIN_EMAIL = "juuuno1116@gmail.com";

type Tab = "requests" | "quality";

export default function RequestsPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState<Tab>("requests");

  // 요청 게시판
  const [requests, setRequests] = useState<LogoRequest[]>([]);
  const [reqLoading, setReqLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "done">("all");
  const [updatingRequest, setUpdatingRequest] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  // 품질 순위
  const [qualityList, setQualityList] = useState<QualityEntry[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [qualityLoading, setQualityLoading] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const [resolveErr, setResolveErr] = useState<string | null>(null);

  // 신고 처리 — 실패를 조용히 삼키지 않는다
  async function handleResolve(brandId: string) {
    setResolving(brandId);
    setResolveErr(null);
    try {
      await resolveQuality(brandId);
      setQualityList(list =>
        list.map(q => (q.brandId === brandId ? { ...q, flagged: false } : q)),
      );
    } catch {
      setResolveErr("처리에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setResolving(null);
    }
  }

  async function toggleRequestStatus(request: LogoRequest) {
    if (!request.id) return;
    setUpdatingRequest(request.id);
    setRequestError(null);
    try {
      await updateRequestStatus(request.id, request.status === "done" ? "pending" : "done");
    } catch {
      setRequestError("요청 상태를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setUpdatingRequest(null);
    }
  }

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
      setReqLoading(false);
    });
    return unsub;
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin || tab !== "quality") return;
    setQualityLoading(true);
    Promise.all([loadQualityRanking(100), fetchBrands()]).then(([q, b]) => {
      setQualityList(q);
      setBrands(b);
      setQualityLoading(false);
    });
  }, [isAdmin, tab]);

  const filtered = filter === "all" ? requests : requests.filter((r) => r.status === filter);
  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const doneCount = requests.filter((r) => r.status === "done").length;
  const flaggedCount = qualityList.filter((q) => q.flagged).length;

  const brandMap = new Map(brands.map((b) => [b.id, b]));

  if (!authChecked) return null;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <Header />
      <main className="max-w-[900px] mx-auto px-4 py-10">
        {/* 페이지 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">관리자 패널</h1>
          <Link
            href="/submit/"
            className="shrink-0 px-4 py-2 rounded-full text-sm font-medium text-white"
            style={{ background: "#111" }}
          >
            + 요청하기
          </Link>
        </div>

        {/* 탭 */}
        <div className="flex gap-2 mb-6 border-b" style={{ borderColor: "var(--border)" }}>
          {([
            { key: "requests", label: `로고 요청`, count: pendingCount },
            { key: "quality",  label: `품질 낮은 로고`, count: flaggedCount, warn: true },
          ] as { key: Tab; label: string; count: number; warn?: boolean }[]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="pb-2.5 px-1 text-sm font-medium transition-colors relative"
              style={{
                color: tab === t.key ? "#111" : "var(--text-secondary)",
                borderBottom: tab === t.key ? "2px solid #111" : "2px solid transparent",
              }}
            >
              {t.label}
              {t.count > 0 && (
                <span
                  className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full"
                  style={{
                    background: t.warn ? "rgba(239,68,68,.1)" : "rgba(99,102,241,.1)",
                    color: t.warn ? "#dc2626" : "#6366f1",
                    fontWeight: 600,
                  }}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── 요청 게시판 탭 ── */}
        {tab === "requests" && (
          <>
            {requestError && (
              <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background:"rgba(239,68,68,.06)", color:"#dc2626", border:"1px solid rgba(239,68,68,.2)" }}>
                {requestError}
              </div>
            )}
            <div className="flex gap-2 mb-5">
              {[
                { key: "all",     label: `전체 ${requests.length}` },
                { key: "pending", label: `요청 중 ${pendingCount}` },
                { key: "done",    label: `완료 ${doneCount}` },
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

            {reqLoading ? (
              <div className="text-center py-20" style={{ color: "var(--text-secondary)" }}>불러오는 중...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20" style={{ color: "var(--text-secondary)" }}>
                <p className="text-3xl mb-3">📋</p>
                <p className="font-medium">요청이 없어요</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filtered.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center gap-4 px-5 py-4 rounded-xl border"
                    style={{ borderColor: "var(--border)", background: "#fff" }}
                  >
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
                        <p className="text-xs mt-0.5 line-clamp-1" style={{ color: "#aaa" }}>{req.note}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        {req.createdAt?.toDate().toLocaleDateString("ko-KR")}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleRequestStatus(req)}
                      disabled={updatingRequest === req.id}
                      className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                      style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", background: "var(--surface)" }}
                    >
                      {updatingRequest === req.id ? "저장 중…" : req.status === "done" ? "다시 열기" : "완료 처리"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── 품질 낮은 로고 탭 ── */}
        {tab === "quality" && (
          <>
            <p className="text-sm mb-5" style={{ color: "var(--text-secondary)" }}>
              🚩 교체 필요 투표 많은 순. {FLAG_THRESHOLD}표 이상이면 <span style={{ color:"#dc2626", fontWeight:600 }}>검토 필요</span> 표시.
              로고를 교체했으면 <span style={{ fontWeight:600 }}>처리 완료</span>를 눌러 목록에서 내려요.
            </p>
            {resolveErr && (
              <div className="mb-4 px-4 py-3 rounded-xl text-sm"
                style={{ background:"rgba(239,68,68,.06)", color:"#dc2626", border:"1px solid rgba(239,68,68,.2)" }}>
                {resolveErr}
              </div>
            )}
            {qualityLoading ? (
              <div className="text-center py-20" style={{ color: "var(--text-secondary)" }}>불러오는 중...</div>
            ) : qualityList.length === 0 ? (
              <div className="text-center py-20" style={{ color: "var(--text-secondary)" }}>
                <p className="text-3xl mb-3">✨</p>
                <p className="font-medium">아직 품질 투표 데이터가 없어요</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {qualityList.map((entry, i) => {
                  const brand = brandMap.get(entry.brandId);
                  const logoUrl = `${CDN}/${entry.brandId}/logo.png`;
                  return (
                    <div
                      key={entry.brandId}
                      className="flex items-center gap-4 px-4 py-3 rounded-xl border"
                      style={{
                        borderColor: entry.flagged ? "rgba(239,68,68,.3)" : "var(--border)",
                        background: entry.flagged ? "rgba(239,68,68,.03)" : "#fff",
                      }}
                    >
                      {/* 순위 */}
                      <span className="shrink-0 text-sm font-bold w-6 text-center" style={{ color: "#a1a1aa" }}>
                        {i + 1}
                      </span>

                      {/* 로고 썸네일 */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={logoUrl} alt="" style={{ width:40, height:28, objectFit:"contain", flexShrink:0, borderRadius:4, border:"1px solid #f0f0f2" }} onError={e => { e.currentTarget.style.display="none"; }} />

                      {/* 브랜드 정보 */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">
                          {brand?.name_ko || entry.brandId}
                          {brand?.name_en && brand.name_en !== brand.name_ko && (
                            <span className="font-normal ml-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                              {brand.name_en}
                            </span>
                          )}
                        </p>
                        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                          {brand?.category} · {entry.brandId}
                        </p>
                      </div>

                      {/* 투표 현황 */}
                      <div className="shrink-0 flex items-center gap-3">
                        <span className="text-xs font-medium" style={{ color:"#16a34a" }}>👍 {entry.up}</span>
                        <span className="text-xs font-medium" style={{ color: entry.down >= 3 ? "#dc2626" : "#71717a" }}>
                          🚩 {entry.down}
                        </span>
                        {entry.flagged && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background:"rgba(239,68,68,.1)", color:"#dc2626", border:"1px solid rgba(239,68,68,.2)" }}>
                            검토 필요
                          </span>
                        )}
                        {entry.flagged && (
                          <button
                            onClick={() => handleResolve(entry.brandId)}
                            disabled={resolving === entry.brandId}
                            className="text-xs px-2.5 py-1 rounded-lg transition-colors"
                            style={{ background:"#111", color:"#fff", border:"1px solid #111",
                                     opacity: resolving === entry.brandId ? 0.5 : 1,
                                     cursor: resolving === entry.brandId ? "wait" : "pointer" }}
                          >
                            {resolving === entry.brandId ? "처리 중..." : "처리 완료"}
                          </button>
                        )}
                        <a
                          href={`/#${entry.brandId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-2.5 py-1 rounded-lg transition-colors"
                          style={{ background:"#f4f4f5", color:"#52525b", border:"1px solid #e4e4e7", textDecoration:"none" }}
                        >
                          열기
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

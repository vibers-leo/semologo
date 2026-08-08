"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import {
  collection, addDoc, getDocs, doc, updateDoc, increment, query, orderBy, Timestamp,
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase";

interface RequestItem {
  id: string;
  brand_name: string;
  website?: string;
  note?: string;
  votes: number;
  created_at: Timestamp;
  status: "pending" | "done";
}

const VOTED_KEY = "semo-req-voted";

function getVoted(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(VOTED_KEY) || "[]")); }
  catch { return new Set(); }
}
function saveVoted(s: Set<string>) {
  try { localStorage.setItem(VOTED_KEY, JSON.stringify(Array.from(s))); } catch {}
}

function relTime(ts: Timestamp) {
  const s = Math.floor((Date.now() - ts.toMillis()) / 1000);
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return `${Math.floor(s / 86400)}일 전`;
}

export default function RequestPage() {
  // 폼 상태
  const [nameKo, setNameKo] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [website, setWebsite] = useState("");
  const [note, setNote] = useState("");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "sending" | "done" | "error">("idle");

  // 게시판 상태
  const [items, setItems] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [voted, setVoted] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<"votes" | "latest">("votes");
  // 투표 실패를 조용히 삼키지 않는다 (예전엔 catch {} 로 아무 반응이 없었다)
  const [voteError, setVoteError] = useState<string | null>(null);

  useEffect(() => { setVoted(getVoted()); }, []);

  const loadRequests = useCallback(async () => {
    try {
      const db = getClientDb();
      const q = query(collection(db, "logo_requests_public"), orderBy("votes", "desc"));
      const snap = await getDocs(q);
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as RequestItem)));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameKo.trim()) return;
    setSubmitStatus("sending");

    try {
      const db = getClientDb();
      const fd = new FormData();
      fd.set("brand_name", `[로고요청] ${nameKo}${nameEn ? ` / ${nameEn}` : ""}`);
      fd.set("logo_url", website);
      fd.set("memo", `[로고 요청]\n브랜드명: ${nameKo}${nameEn ? ` / ${nameEn}` : ""}\n사이트: ${website}\n메모: ${note}`);

      // Firestore 저장
      await addDoc(collection(db, "logo_requests_public"), {
        brand_name: `${nameKo}${nameEn ? ` / ${nameEn}` : ""}`,
        website: website.trim(),
        note: note.trim(),
        votes: 0,
        status: "pending",
        created_at: Timestamp.now(),
      });

      // 관리자 이메일 알림 (ai-recipe 릴레이)
      fetch("https://ai.vibers.co.kr/api/logo-submit", { method: "POST", body: fd }).catch(() => {});

      setSubmitStatus("done");
      setNameKo(""); setNameEn(""); setWebsite(""); setNote("");
      await loadRequests();
    } catch {
      setSubmitStatus("error");
    }
  };

  const handleVote = async (item: RequestItem) => {
    if (voted.has(item.id)) return;
    try {
      const db = getClientDb();
      await updateDoc(doc(db, "logo_requests_public", item.id), { votes: increment(1) });
      const newVoted = new Set(voted);
      newVoted.add(item.id);
      setVoted(newVoted);
      saveVoted(newVoted);
      setItems(prev => prev.map(x => x.id === item.id ? { ...x, votes: x.votes + 1 } : x));
      setVoteError(null);
    } catch {
      setVoteError("투표를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
      setTimeout(() => setVoteError(null), 4000);
    }
  };

  const sortedItems = [...items].sort((a, b) =>
    sortBy === "votes"
      ? b.votes - a.votes
      : b.created_at?.toMillis() - a.created_at?.toMillis()
  );

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 10,
    border: "1px solid var(--border)", background: "var(--surface)",
    color: "var(--text)", fontSize: 14, outline: "none",
    fontFamily: "inherit", boxSizing: "border-box",
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <Header />
      <main className="max-w-[720px] mx-auto px-4 py-12">

        {/* 페이지 헤더 */}
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-1 text-sm mb-4"
            style={{ color: "var(--text-secondary)", textDecoration: "none" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            세모로고 홈
          </Link>
          <h1 className="text-2xl font-black mb-1">로고 요청</h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            세모로고에 없는 브랜드를 요청해보세요.<br />
            다른 분들도 원하는 로고를 투표로 우선순위를 높일 수 있어요.
          </p>
        </div>

        {/* 요청 폼 */}
        <div className="rounded-2xl border p-6 mb-10" style={{ borderColor: "var(--border)", background: "#fff" }}>
          <h2 className="font-bold mb-4 flex items-center gap-2">
            <span className="text-xl">✏️</span> 새 로고 요청
          </h2>

          {submitStatus === "done" ? (
            <div className="text-center py-8">
              <p className="text-4xl mb-3">🎉</p>
              <p className="font-bold mb-1">요청이 접수됐어요!</p>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                검토 후 세모로고에 추가할게요.
              </p>
              <button onClick={() => setSubmitStatus("idle")}
                className="mt-4 px-5 py-2.5 rounded-full text-sm font-semibold border"
                style={{ border: "1px solid var(--border)" }}>
                또 요청하기
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1.5">
                    브랜드명 (한글) <span className="text-red-500">*</span>
                  </label>
                  <input required value={nameKo} onChange={e => setNameKo(e.target.value)}
                    placeholder="예: 배달의민족" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">브랜드명 (영문)</label>
                  <input value={nameEn} onChange={e => setNameEn(e.target.value)}
                    placeholder="예: Baemin" style={inputStyle} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">공식 홈페이지</label>
                <input type="url" value={website} onChange={e => setWebsite(e.target.value)}
                  placeholder="https://example.com" style={inputStyle} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5">메모 (선택)</label>
                <textarea rows={2} value={note} onChange={e => setNote(e.target.value)}
                  placeholder="어떤 로고가 필요한지 알려주시면 더 정확하게 추가할 수 있어요"
                  style={{ ...inputStyle, resize: "vertical", minHeight: 68, lineHeight: 1.6 }} />
              </div>
              {submitStatus === "error" && (
                <p className="text-sm" style={{ color: "#dc2626" }}>전송에 실패했어요. 다시 시도해주세요.</p>
              )}
              <button type="submit"
                disabled={submitStatus === "sending" || !nameKo.trim()}
                className="py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
                style={{ background: "#111", color: "#fff" }}>
                {submitStatus === "sending" ? "전송 중…" : "요청 보내기"}
              </button>
            </form>
          )}
        </div>

        {/* 요청 게시판 */}
        <div>
          {voteError && (
            <div role="status" className="mb-3 px-3 py-2 rounded-lg text-sm"
              style={{ background: "rgba(239,68,68,.08)", color: "#dc2626", border: "1px solid rgba(239,68,68,.2)" }}>
              {voteError}
            </div>
          )}
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg">
              다른 분들의 로고 요청
              {items.length > 0 && (
                <span className="ml-2 text-sm font-normal" style={{ color: "var(--text-secondary)" }}>
                  {items.length}건
                </span>
              )}
            </h2>
            <div className="flex gap-1">
              {(["votes", "latest"] as const).map(s => (
                <button key={s} onClick={() => setSortBy(s)}
                  className="text-xs px-3 py-1.5 rounded-full font-medium transition-colors"
                  style={sortBy === s
                    ? { background: "#111", color: "#fff" }
                    : { background: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }
                  }>
                  {s === "votes" ? "투표 순" : "최신 순"}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12" style={{ color: "var(--text-secondary)" }}>
              <p className="text-2xl mb-2">⏳</p><p className="text-sm">불러오는 중…</p>
            </div>
          ) : sortedItems.length === 0 ? (
            <div className="text-center py-12 rounded-2xl border" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
              <p className="text-3xl mb-2">📭</p>
              <p className="font-medium">아직 요청이 없어요</p>
              <p className="text-sm mt-1">첫 번째 로고를 요청해보세요!</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {sortedItems.map((item, rank) => {
                const isVoted = voted.has(item.id);
                const isDone = item.status === "done";
                return (
                  <div key={item.id}
                    className="flex items-center gap-4 p-4 rounded-xl border transition-colors"
                    style={{ borderColor: "var(--border)", background: isDone ? "#f0fdf4" : "#fff" }}>
                    {/* 순위 */}
                    <div className="shrink-0 w-8 text-center">
                      {rank < 3
                        ? <span className="text-lg">{["🥇", "🥈", "🥉"][rank]}</span>
                        : <span className="text-sm font-bold text-gray-400">{rank + 1}</span>
                      }
                    </div>

                    {/* 내용 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{item.brand_name}</span>
                        {isDone && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: "rgba(34,197,94,.12)", color: "#16a34a" }}>
                            ✓ 등록 완료
                          </span>
                        )}
                      </div>
                      {item.website && (
                        <a href={item.website} target="_blank" rel="noopener noreferrer"
                          className="text-xs mt-0.5 block truncate"
                          style={{ color: "#6366f1", textDecoration: "none" }}
                          onClick={e => e.stopPropagation()}>
                          🔗 {item.website}
                        </a>
                      )}
                      {item.note && (
                        <p className="text-xs mt-1 text-gray-500 line-clamp-2">{item.note}</p>
                      )}
                      <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                        {item.created_at ? relTime(item.created_at) : ""}
                      </p>
                    </div>

                    {/* 투표 버튼 */}
                    <button onClick={() => !isDone && handleVote(item)}
                      disabled={isVoted || isDone}
                      className="shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all"
                      style={isVoted
                        ? { background: "rgba(99,102,241,.1)", border: "1.5px solid rgba(99,102,241,.3)", color: "#6366f1", cursor: "default" }
                        : isDone
                          ? { background: "#f4f4f5", border: "1.5px solid #e4e4e7", color: "#a1a1aa", cursor: "default" }
                          : { background: "var(--surface)", border: "1.5px solid var(--border)", color: "var(--text-secondary)", cursor: "pointer" }
                      }>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill={isVoted ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                        <path d="M12 19V5M5 12l7-7 7 7"/>
                      </svg>
                      <span className="text-xs font-bold">{item.votes}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-10 pt-6 border-t text-center text-xs" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
          로고를 이미 갖고 계신가요?{" "}
          <Link href="/submit" style={{ color: "#6366f1", textDecoration: "none" }}>로고 제보하기 →</Link>
        </div>
      </main>
    </div>
  );
}

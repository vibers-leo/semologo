"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { logoImageCandidates } from "@/lib/logo-png-source";
import { trackEvent } from "@/lib/analytics";
import type { Brand } from "@/lib/brands";

type ChatMessage = { id: number; from: "visitor" | "semo"; text: string; brandId?: string };

export default function RequestPage() {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 0, from: "semo", text: "어떤 로고가 필요하세요? 이름만 남겨도 돼요." },
  ]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [recent, setRecent] = useState<Brand[]>([]);
  const [recentError, setRecentError] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadRecent() {
      try {
        const response = await fetch("/api/logo-posts?limit=20", { cache: "no-store" });
        if (!response.ok) throw new Error("recent_unavailable");
        const payload = await response.json();
        if (active) setRecent((payload.posts as Brand[]).slice(0, 5));
      } catch { if (active) setRecentError(true); }
    }
    loadRecent();
    return () => { active = false; };
  }, []);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.replace(/\s+/g, " ").trim();
    if (message.length < 2 || sending) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/logo-requests", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "요청을 저장하지 못했어요. 다시 보내 주세요.");
      const id = Date.now();
      setMessages(previous => [...previous,
        { id, from: "visitor", text: message },
        { id: id + 1, from: "semo", text: result.status === "published"
          ? "알겠어요. 이 로고는 이미 올라와 있어요. 바로 확인해 보세요."
          : "알겠어요. 최우선 수집 목록에 넣었어요. 확인한 로고부터 이곳에 올라와요.", brandId: result.brandId || undefined },
      ]);
      setDraft("");
      trackEvent("request_submitted", { has_website: /https?:\/\//i.test(message), has_note: true });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "요청을 저장하지 못했어요. 다시 보내 주세요.");
    } finally { setSending(false); }
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <Header />
      <main className="content-page py-10 sm:py-14">
        <Link href="/" className="text-sm" style={{ color: "var(--text-secondary)" }}>← 세모로고 홈</Link>
        <div className="mt-5 mb-7">
          <h1 className="text-2xl font-black mb-2">로고 요청</h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>필요한 로고를 한마디로 남겨 주세요. 공식 사이트 주소가 있으면 함께 보내도 좋아요.</p>
        </div>

        <section aria-label="로고 요청 대화" className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div aria-live="polite" className="flex flex-col gap-4 p-5 sm:p-7 min-h-[250px] max-h-[440px] overflow-y-auto">
            {messages.map(message => (
              <div key={message.id} className={`flex ${message.from === "visitor" ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words"
                  style={message.from === "visitor" ? { background: "#111", color: "#fff", borderBottomRightRadius: 5 }
                    : { background: "#f1f1f5", color: "#18181b", borderBottomLeftRadius: 5 }}>
                  {message.text}
                  {message.brandId && <Link className="block mt-2 underline font-semibold" href={`/brand/${encodeURIComponent(message.brandId)}/`}>로고 보러 가기 →</Link>}
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={send} className="border-t p-3 sm:p-4 flex gap-2" style={{ borderColor: "var(--border)" }}>
            <label htmlFor="logo-request-message" className="sr-only">필요한 로고</label>
            <input id="logo-request-message" value={draft} onChange={event => setDraft(event.target.value)}
              maxLength={240} placeholder="예: 부산국제영화제 로고 찾아줘" autoComplete="off"
              className="min-w-0 flex-1 rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
              style={{ borderColor: "var(--border)", background: "#fff", color: "#18181b" }} />
            <button type="submit" disabled={sending || draft.trim().length < 2}
              className="rounded-xl px-5 py-3 text-sm font-bold text-white disabled:opacity-40"
              style={{ background: "#111" }}>{sending ? "보내는 중" : "보내기"}</button>
          </form>
          {error && <p role="alert" className="px-4 pb-4 text-sm text-red-600">{error}</p>}
        </section>

        <section className="mt-12" aria-label="최근 수집된 로고">
          <div className="flex items-end justify-between gap-3 mb-4">
            <div><h2 className="text-lg font-bold">최근 수집된 로고</h2><p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>검수를 마치고 실제로 올라온 로고예요.</p></div>
            <Link href="/?sort=recent" className="text-sm shrink-0" style={{ color: "#635bfa" }}>더 보기 →</Link>
          </div>
          {recentError ? <p className="text-sm" style={{ color: "var(--text-secondary)" }}>최근 로고를 불러오지 못했어요. 잠시 후 다시 확인해 주세요.</p>
            : <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {recent.map(brand => <RecentLogo key={brand.id} brand={brand} />)}
            </div>}
        </section>
      </main>
    </div>
  );
}

function RecentLogo({ brand }: { brand: Brand }) {
  const [candidate, setCandidate] = useState(0);
  const images = logoImageCandidates(brand);
  return <Link href={`/brand/${encodeURIComponent(brand.id)}/`} className="block overflow-hidden rounded-xl border hover:shadow-md transition-shadow"
    style={{ borderColor: "var(--border)", background: "#fff" }}>
    <div className="h-28 flex items-center justify-center p-4" style={{ background: brand.light || brand.light_logo ? "#18181b" : "#f7f7f9" }}>
      {images[candidate] && <img src={images[candidate]} alt={`${brand.name_ko} 로고`} loading="lazy" className="max-w-full max-h-full object-contain"
        onError={() => setCandidate(current => current + 1)} />}
    </div>
    <div className="px-3 py-2.5 text-sm font-semibold truncate">{brand.name_ko}</div>
  </Link>;
}

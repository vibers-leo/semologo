"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { getClientAuth } from "@/lib/firebase";
import Header from "@/components/Header";

type ReviewStatus = "pending" | "reviewing" | "ready" | "published" | "rejected";
type Submission = {
  id: string;
  brand_name: string;
  file_name: string;
  file_ext: string;
  memo: string;
  submittedAt: string;
  status: ReviewStatus;
  bucket_url: string;
  batch_id: string;
  batch_index: number;
  batch_count: number;
  drive_archive_status: string;
  processing_status: string;
  converted_svg_key: string;
  preview_key: string;
  optimization_status: string;
  published_brand_id: string;
};

const API = "https://ai.vibers.co.kr/api/logo-submissions";
const LABELS: Record<ReviewStatus, string> = {
  pending: "검토 대기", reviewing: "보완 중", ready: "게시 준비", published: "게시 연결", rejected: "제외",
};
const previewExt = new Set(["png", "jpg", "jpeg", "webp", "tif", "tiff"]);

function SubmissionPreview({ item }: { item: Submission }) {
  const target = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!target.current) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: "200px" });
    observer.observe(target.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible || !previewExt.has(item.file_ext)) return;
    let cancelled = false;
    let objectUrl = "";
    void (async () => {
      const token = await getClientAuth().currentUser?.getIdToken();
      if (!token) return;
      const response = await fetch(`${API}/${encodeURIComponent(item.id)}/file${item.preview_key ? "?variant=preview" : ""}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok || cancelled) return;
      objectUrl = URL.createObjectURL(await response.blob());
      if (!cancelled) setUrl(objectUrl);
      else URL.revokeObjectURL(objectUrl);
    })().catch(() => {});
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [visible, item.id, item.file_ext, item.preview_key]);
  return <div ref={target} style={{ width: 120, height: 100, flexShrink: 0, display: "grid", placeItems: "center", borderRadius: 10, background: "#f4f4f5", overflow: "hidden", fontSize: 13, color: "#71717a" }}>
    {url ? <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : item.file_ext.toUpperCase() || "FILE"}
  </div>;
}

export default function SubmissionsPage() {
  const [ready, setReady] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<ReviewStatus | "all">("pending");
  const [query, setQuery] = useState("");
  const [brandIds, setBrandIds] = useState<Record<string, string>>({});

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError("");
    try {
      const token = await getClientAuth().currentUser?.getIdToken();
      if (!token) throw Error("관리자 로그인이 필요해요.");
      const response = await fetch(API, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "제보를 불러오지 못했어요.");
      if (!signal?.aborted) setItems(data.submissions || []);
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "제보를 불러오지 못했어요.");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, []);

  useEffect(() => onAuthStateChanged(getClientAuth(), user => {
    setAdmin(user?.email?.toLowerCase() === "juuuno1116@gmail.com");
    setReady(true);
  }), []);
  useEffect(() => {
    if (!admin) return;
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [admin, refresh]);

  const shown = useMemo(() => items.filter(item => (filter === "all" || item.status === filter) &&
    `${item.brand_name} ${item.file_name} ${item.memo}`.toLowerCase().includes(query.toLowerCase())), [items, filter, query]);
  const counts = useMemo(() => Object.fromEntries(Object.keys(LABELS).map(status => [status, items.filter(item => item.status === status).length])), [items]);

  async function setStatus(item: Submission, status: ReviewStatus) {
    const publishedId = (brandIds[item.id] || item.published_brand_id || "").trim();
    if (status === "published" && !publishedId) { setError("게시한 로고의 콘텐츠 ID를 먼저 입력해 주세요."); return; }
    setBusy(item.id); setError("");
    try {
      const token = await getClientAuth().currentUser?.getIdToken();
      if (status === "published") {
        const lookup = await fetch(`/api/admin/logo-posts/?id=${encodeURIComponent(publishedId)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        const result = await lookup.json();
        if (!lookup.ok || !result.published) throw Error("해당 ID의 로고 콘텐츠를 먼저 게시해 주세요.");
      }
      const response = await fetch(API, {
        method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, status, published_brand_id: status === "published" ? publishedId : item.published_brand_id }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "상태를 저장하지 못했어요.");
      setItems(previous => previous.map(existing => existing.id === item.id ? { ...existing, status, published_brand_id: status === "published" ? publishedId : existing.published_brand_id } : existing));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "상태를 저장하지 못했어요."); }
    finally { setBusy(""); }
  }

  async function download(item: Submission, variant?: "converted") {
    setBusy(item.id); setError("");
    try {
      const token = await getClientAuth().currentUser?.getIdToken();
      const response = await fetch(`${API}/${encodeURIComponent(item.id)}/file${variant ? `?variant=${variant}` : ""}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw Error("원본 파일을 가져오지 못했어요.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url; link.download = variant === "converted" ? "logo.svg" : item.file_name || "logo"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "원본 파일을 가져오지 못했어요."); }
    finally { setBusy(""); }
  }

  return <div style={{ minHeight: "100dvh", background: "var(--bg)" }}><Header /><main style={{ maxWidth: 1080, margin: "auto", padding: "32px 20px 80px" }}>
    <h1 style={{ fontSize: 26, fontWeight: 800 }}>로고 제보 검토</h1>
    <p style={{ margin: "8px 0 24px", color: "var(--text-secondary)", lineHeight: 1.6 }}>접수된 원본을 확인하고 보완해요. 검토 상태를 바꿔도 로고는 자동으로 공개되지 않아요.</p>
    {!ready ? <p>불러오는 중이에요.</p> : !admin ? <p>관리자 계정으로 로그인해 주세요. <a href="/login/">로그인</a></p> : <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        {(["pending", "reviewing", "ready", "published", "rejected", "all"] as const).map(status => <button key={status} onClick={() => setFilter(status)} aria-pressed={filter === status} style={{ border: "1px solid var(--border)", borderRadius: 999, padding: "8px 12px", background: filter === status ? "#111" : "white", color: filter === status ? "white" : "#333" }}>{status === "all" ? "전체" : LABELS[status]} {status === "all" ? items.length : counts[status]}</button>)}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}><input value={query} onChange={event => setQuery(event.target.value)} placeholder="파일명·메모 검색" aria-label="제보 검색" style={{ flex: 1, minWidth: 0, border: "1px solid var(--border)", borderRadius: 10, padding: 12, fontSize: 16 }} /><button onClick={() => void refresh()} disabled={loading}>새로고침</button></div>
      {error && <p role="alert" style={{ color: "#b91c1c", marginBottom: 14 }}>{error}</p>}
      {loading ? <p>제보를 불러오는 중이에요.</p> : shown.length === 0 ? <p>이 조건의 제보가 없어요.</p> : <div style={{ display: "grid", gap: 12 }}>
        {shown.map(item => <article key={item.id} style={{ display: "flex", gap: 16, flexWrap: "wrap", background: "white", border: "1px solid var(--border)", borderRadius: 16, padding: 16 }}>
          <SubmissionPreview item={item} />
          <div style={{ flex: 1, minWidth: 230 }}>
            <strong style={{ fontSize: 16 }}>{item.file_name || item.brand_name}</strong>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "5px 0" }}>{LABELS[item.status] || item.status} · {item.submittedAt ? new Date(item.submittedAt).toLocaleString("ko-KR") : "날짜 미확인"}{item.batch_count > 1 ? ` · 묶음 ${item.batch_index}/${item.batch_count}` : ""}</p>
            {item.memo && <p style={{ fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap", margin: "10px 0" }}>{item.memo}</p>}
            <p style={{ fontSize: 12, color: "#71717a" }}>원본: {item.drive_archive_status === "verified" ? "드라이브 보관 확인" : "버킷 보관 중"} · {item.processing_status === "converted" ? "SVG 변환 완료" : item.processing_status === "covered_by_published_logo" ? "기존 로고에 연결 완료" : item.processing_status === "manually_optimized" ? "로고 추출·최적화 완료" : item.processing_status === "conversion_failed" ? "변환 확인 필요" : item.processing_status === "conversion_requested" ? "변환 요청됨" : "품질 검토 필요"}</p>
            {previewExt.has(item.file_ext) && <p style={{ fontSize: 12, color: "#71717a" }}>미리보기: {item.optimization_status === "optimized" ? "경량본 생성 완료" : item.optimization_status === "failed" ? "최적화 확인 필요" : "처리 대기"}</p>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              <button disabled={busy === item.id} onClick={() => void download(item)}>원본 받기</button>
              {item.converted_svg_key && <button disabled={busy === item.id} onClick={() => void download(item, "converted")}>변환 SVG 받기</button>}
              {item.status === "pending" && <button disabled={busy === item.id} onClick={() => void setStatus(item, "reviewing")}>보완 시작</button>}
              {item.status !== "ready" && item.status !== "published" && <button disabled={busy === item.id} onClick={() => void setStatus(item, "ready")}>게시 준비</button>}
              {item.status !== "rejected" && <button disabled={busy === item.id} onClick={() => void setStatus(item, "rejected")}>제외</button>}
              {item.status === "rejected" && <button disabled={busy === item.id} onClick={() => void setStatus(item, "pending")}>다시 검토</button>}
            </div>
            {(item.status === "ready" || item.status === "published") && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14, alignItems: "center" }}><input aria-label={`${item.file_name} 게시 콘텐츠 ID`} value={brandIds[item.id] ?? item.published_brand_id} onChange={event => setBrandIds(previous => ({ ...previous, [item.id]: event.target.value }))} placeholder="게시한 콘텐츠 ID" style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 9, minWidth: 180 }} /><button disabled={busy === item.id} onClick={() => void setStatus(item, "published")}>게시 연결</button>{item.published_brand_id && <a href={`/brand/${encodeURIComponent(item.published_brand_id)}/`} target="_blank" rel="noopener noreferrer">콘텐츠 보기 ↗</a>}</div>}
          </div>
        </article>)}
      </div>}
      <p style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 20 }}>최신 제보 200건을 표시해요. 공개 게시와 원본 드라이브 이관은 별도 검증 후 진행해요.</p>
    </>}
  </main></div>;
}

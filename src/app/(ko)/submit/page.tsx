"use client";

import { useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { trackEvent } from "@/lib/analytics";

const MB = 1024 * 1024;
const MAX_FILE_BYTES = 50 * MB;
const MAX_TOTAL_BYTES = 300 * MB;
const MAX_FILES = 300;
const ACCEPTED_EXTENSIONS = ["svg", "png", "jpg", "jpeg", "webp", "tif", "tiff", "ai", "eps", "ps", "pdf", "cdr", "dxf", "emf", "wmf", "psd", "afdesign", "indd", "idml", "doc", "docx", "hwp", "hwpx", "zip", "7z", "rar"];
const ACCEPTED = new Set(ACCEPTED_EXTENSIONS);
const fileId = (file: File) => `${file.name}:${file.size}:${file.lastModified}`;
const formatSize = (bytes: number) => bytes < MB ? `${Math.max(1, Math.round(bytes / 1024))}KB` : `${(bytes / MB).toFixed(1)}MB`;
type Status = "idle" | "sending" | "done" | "error";

export default function SubmitPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [memo, setMemo] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [feedback, setFeedback] = useState("");
  const [sentCount, setSentCount] = useState(0);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);

  function addFiles(incoming: FileList | File[]) {
    const next = [...files];
    const seen = new Set(next.map(fileId));
    let bytes = totalBytes;
    let skipped = "";
    for (const file of Array.from(incoming)) {
      if (seen.has(fileId(file))) continue;
      const extension = file.name.split(".").pop()?.toLowerCase() || "";
      if (!ACCEPTED.has(extension)) { skipped = "이미지·디자인 원본·문서·압축 파일을 보내 주세요. 이 파일 형식은 아직 받지 않아요."; continue; }
      if (file.size === 0) { skipped = "빈 파일은 보낼 수 없어요."; continue; }
      if (file.size > MAX_FILE_BYTES) { skipped = `파일 하나는 50MB까지 보낼 수 있어요. ‘${file.name}’ 파일을 확인해 주세요.`; continue; }
      if (next.length >= MAX_FILES) { skipped = "한 번에 파일 300개까지 보낼 수 있어요. 나눠서 보내 주세요."; continue; }
      if (bytes + file.size > MAX_TOTAL_BYTES) { skipped = "한 번에 300MB까지 보낼 수 있어요. 파일을 나눠서 보내 주세요."; continue; }
      next.push(file); seen.add(fileId(file)); bytes += file.size;
    }
    setFiles(next);
    setFeedback(skipped);
    if (status === "error") setStatus("idle");
    if (fileRef.current) fileRef.current.value = "";
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) addFiles(event.target.files);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!files.length || status === "sending") return;
    setStatus("sending"); setFeedback(""); setSentCount(0);
    const batchId = crypto.randomUUID();
    const failed: File[] = [];
    let sent = 0;
    for (const [index, file] of files.entries()) {
      const data = new FormData();
      data.set("logo_file", file);
      data.set("memo", memo.trim());
      data.set("batch_id", batchId);
      data.set("batch_index", String(index + 1));
      data.set("batch_count", String(files.length));
      data.set("batch_total_bytes", String(totalBytes));
      try {
        const response = await fetch("https://ai.vibers.co.kr/api/logo-submit", { method: "POST", body: data });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || "파일을 보내지 못했어요.");
        sent += 1; setSentCount(sent);
      } catch { failed.push(file); }
    }
    if (sent) trackEvent("logo_submitted", { file_count: sent, has_file: true, has_note: Boolean(memo.trim()) });
    if (failed.length) {
      setFiles(failed);
      setFeedback(sent ? `${sent}개를 보냈어요. 남은 ${failed.length}개는 다시 보내 주세요.` : "파일을 보내지 못했어요. 잠시 후 다시 시도해 주세요.");
      setStatus("error");
    } else {
      setFiles([]); setStatus("done");
    }
  }

  function reset() {
    setFiles([]); setMemo(""); setStatus("idle"); setFeedback(""); setSentCount(0);
  }

  return <div className="min-h-screen" style={{ background: "var(--bg)" }}><Header />
    <main className="content-page py-10 pb-24 sm:py-14">
      <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">← 세모로고 홈</Link>
      {status === "done" ? <section className="mx-auto max-w-xl py-16 text-center">
        <span aria-hidden="true" className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-2xl text-emerald-700">✓</span>
        <h1 className="mt-5 text-3xl font-black">파일을 잘 받았어요</h1>
        <p className="mt-3 leading-7 text-gray-600">{sentCount}개 파일을 전달받았어요. 이름과 분류를 확인한 뒤 로고에 반영할게요.</p>
        <div className="mt-8 flex justify-center gap-3"><button onClick={reset} className="rounded-xl bg-[#111] px-5 py-3 text-sm font-bold text-white">다른 파일 보내기</button><Link href="/" className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold">로고 둘러보기</Link></div>
      </section> : <div className="mx-auto max-w-3xl">
        <div className="mt-7"><p className="text-xs font-bold tracking-[0.2em] text-indigo-600">SEND US A LOGO</p><h1 className="mt-3 text-4xl font-black tracking-tight">로고 제보</h1>
          <p className="mt-4 text-base leading-8 text-gray-600">로고 파일만 보내주세요. 이름과 카테고리, 공식 출처는 저희가 확인할게요. 여러 파일을 한 번에 골라도 돼요.</p></div>
        <form onSubmit={handleSubmit} className="mt-9 space-y-6">
          <div onDrop={onDrop} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
            className={`rounded-[24px] border-2 border-dashed p-7 text-center transition-colors sm:p-10 ${dragging ? "border-indigo-500 bg-indigo-50" : "border-gray-300 bg-[#f8f8fa]"}`}>
            <span aria-hidden="true" className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">↥</span>
            <p className="mt-4 text-lg font-bold">파일을 놓거나 선택해 주세요</p>
            <p className="mt-2 text-sm leading-6 text-gray-500">SVG·PNG·JPG·WEBP 등 이미지와 벡터 파일<br />AI·INDD·DOC·HWP·ZIP 등 원본과 문서 파일</p>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={status === "sending"} className="mt-5 rounded-xl bg-[#111] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">파일 여러 개 선택하기</button>
            <input ref={fileRef} type="file" multiple accept={ACCEPTED_EXTENSIONS.map(extension => `.${extension}`).join(",")} onChange={onFileChange} className="sr-only" aria-label="로고 파일 선택" />
            <p className="mt-4 text-xs text-gray-500">파일당 최대 50MB · 한 번에 최대 300MB</p>
          </div>

          {files.length > 0 && <section aria-label="선택한 파일" className="rounded-[22px] border border-gray-200 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">선택한 파일 <span className="text-indigo-600">{files.length}개</span></h2><p className="text-sm text-gray-500">{formatSize(totalBytes)} / 300MB</p></div>
            <ul className="mt-4 divide-y divide-gray-100">{files.map(file => <li key={fileId(file)} className="flex items-center gap-3 py-3"><span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-[11px] font-bold uppercase text-gray-600">{file.name.split(".").pop()}</span><span className="min-w-0 flex-1 truncate text-sm" title={file.name}>{file.name}</span><span className="shrink-0 text-xs text-gray-500">{formatSize(file.size)}</span><button type="button" disabled={status === "sending"} onClick={() => setFiles(current => current.filter(item => fileId(item) !== fileId(file)))} className="shrink-0 rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100" aria-label={`${file.name} 제거`}>✕</button></li>)}</ul>
          </section>}

          <div><label htmlFor="logo-submit-memo" className="block text-sm font-bold">메모 <span className="font-normal text-gray-500">선택</span></label><p className="mt-1 text-sm text-gray-500">알려주고 싶은 브랜드명이나 출처가 있다면 적어주세요.</p><textarea id="logo-submit-memo" value={memo} onChange={event => setMemo(event.target.value)} maxLength={1000} rows={3} placeholder="예: 공식 홈페이지에서 받은 파일이에요" className="mt-3 w-full rounded-xl border border-gray-300 bg-white p-4 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /></div>
          {feedback && <p role="alert" className={`rounded-xl px-4 py-3 text-sm ${status === "error" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>{feedback}</p>}
          {status === "sending" && <p role="status" className="text-sm text-gray-600">{files.length}개 중 {sentCount}개 전달했어요. 창을 닫지 말아 주세요.</p>}
          <button type="submit" disabled={!files.length || status === "sending"} className="w-full rounded-xl bg-[#111] px-5 py-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{status === "sending" ? "파일 보내는 중…" : status === "error" ? "남은 파일 다시 보내기" : `${files.length}개 파일 보내기`}</button>
          <p className="text-center text-xs leading-6 text-gray-500">받은 파일은 확인 후 반영해요. 브랜드 로고의 사용 권한과 출처도 함께 살펴볼게요.</p>
        </form>
      </div>}
    </main><Footer />
  </div>;
}

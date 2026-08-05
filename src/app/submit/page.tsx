"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import Header from "@/components/Header";

const CATEGORIES = [
  "금융","식품·음료","IT·테크","패션·뷰티","자동차",
  "유통·쇼핑","건설·중공업","엔터테인먼트","통신","의료·바이오",
  "소셜미디어","소프트웨어·개발","IT·클라우드","전자/IT","암호화폐","기타",
];

type Status = "idle" | "sending" | "done" | "error";

export default function SubmitPage() {
  const [nameKo, setNameKo]     = useState("");
  const [nameEn, setNameEn]     = useState("");
  const [category, setCategory] = useState("");
  const [domain, setDomain]     = useState("");
  const [memo, setMemo]         = useState("");
  const [file, setFile]         = useState<File | null>(null);
  const [preview, setPreview]   = useState<string | null>(null);
  const [status, setStatus]     = useState<Status>("idle");
  const fileRef = useRef<HTMLInputElement>(null);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setFile(f);
    if (f) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nameKo || !nameEn || !category) return;
    setStatus("sending");

    const fd = new FormData();
    fd.set("brand_name", `${nameKo} / ${nameEn}`);
    fd.set("category", category);
    fd.set("logo_url", domain);
    fd.set("memo", memo);
    if (file) fd.set("logo_file", file);

    try {
      const res = await fetch("https://ai.vibers.co.kr/api/logo-submit", { method: "POST", body: fd });
      const json = await res.json();
      setStatus(json.success ? "done" : "error");
    } catch {
      setStatus("error");
    }
  }

  function reset() {
    setStatus("idle");
    setNameKo(""); setNameEn(""); setCategory(""); setDomain(""); setMemo("");
    setFile(null); setPreview(null);
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <Header />
      <main className="max-w-[600px] mx-auto px-4 py-12">

        {status === "done" ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">✅</p>
            <h1 className="text-2xl font-bold mb-2">제보 완료!</h1>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
              소중한 제보 감사해요.<br />검토 후 세모로고에 반영할게요.
            </p>
            <div className="flex gap-3 justify-center">
              <Link href="/" className="px-5 py-2.5 rounded-full text-sm font-semibold text-white" style={{ background: "#111" }}>
                홈으로
              </Link>
              <button onClick={reset} className="px-5 py-2.5 rounded-full text-sm font-semibold border" style={{ border: "1px solid var(--border)" }}>
                또 제보하기
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <Link href="/" className="inline-flex items-center gap-1 text-sm mb-4" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6"/></svg>
                세모로고 홈
              </Link>
              <h1 className="text-2xl font-black mb-1">로고 제보하기</h1>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                세모로고에 없는 브랜드 로고를 알려주세요.<br />검토 후 반영할게요.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">

              {/* 로고 파일 업로드 */}
              <div>
                <label className="block text-sm font-semibold mb-2">
                  로고 파일
                  <span className="font-normal ml-2" style={{ color: "var(--text-secondary)" }}>SVG 또는 PNG 권장</span>
                </label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-all"
                  style={{ borderColor: file ? "#6366f1" : "var(--border)", background: file ? "rgba(99,102,241,.04)" : "var(--surface)" }}
                >
                  {preview ? (
                    <div className="flex flex-col items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={preview} alt="preview" style={{ maxHeight: 72, maxWidth: "70%", objectFit: "contain" }} />
                      <span className="text-xs font-semibold" style={{ color: "#6366f1" }}>{file?.name}</span>
                      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>클릭해서 변경</span>
                    </div>
                  ) : (
                    <>
                      <div className="text-3xl mb-2">📁</div>
                      <div className="text-sm" style={{ color: "var(--text-secondary)" }}>클릭해서 파일 선택</div>
                      <div className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>SVG · PNG · JPG · WEBP</div>
                    </>
                  )}
                </div>
                <input ref={fileRef} type="file" accept=".svg,.png,.jpg,.jpeg,.webp" onChange={onFileChange} className="hidden" />
              </div>

              {/* 브랜드명 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1.5">브랜드명 (한글) <span className="text-red-500">*</span></label>
                  <input required value={nameKo} onChange={e => setNameKo(e.target.value)} placeholder="예: 삼성전자" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5">브랜드명 (영문) <span className="text-red-500">*</span></label>
                  <input required value={nameEn} onChange={e => setNameEn(e.target.value)} placeholder="예: Samsung" style={inputStyle} />
                </div>
              </div>

              {/* 카테고리 */}
              <div>
                <label className="block text-sm font-semibold mb-1.5">카테고리 <span className="text-red-500">*</span></label>
                <select required value={category} onChange={e => setCategory(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                  <option value="">카테고리를 선택하세요</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* 공식 홈페이지 */}
              <div>
                <label className="block text-sm font-semibold mb-1.5">공식 홈페이지 <span className="text-xs font-normal" style={{ color: "var(--text-secondary)" }}>(선택)</span></label>
                <input type="url" value={domain} onChange={e => setDomain(e.target.value)} placeholder="https://example.com" style={inputStyle} />
              </div>

              {/* 메모 */}
              <div>
                <label className="block text-sm font-semibold mb-1.5">메모 <span className="text-xs font-normal" style={{ color: "var(--text-secondary)" }}>(선택)</span></label>
                <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={3}
                  placeholder="로고 출처, 특이사항 등 자유롭게 적어주세요"
                  style={{ ...inputStyle, resize: "vertical", minHeight: 80, lineHeight: 1.6 }} />
              </div>

              {status === "error" && (
                <div className="rounded-lg p-3 text-sm" style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.25)", color: "#dc2626" }}>
                  전송에 실패했어요. 잠시 후 다시 시도해주세요.
                </div>
              )}

              <button
                type="submit"
                disabled={status === "sending" || !nameKo || !nameEn || !category}
                className="py-3.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "#111", color: "#fff", fontSize: 15 }}
              >
                {status === "sending" ? "전송 중…" : "제보 보내기"}
              </button>

              <p className="text-xs text-center" style={{ color: "var(--text-secondary)" }}>
                제보하신 로고는 검토 후 세모로고에 반영돼요.<br />
                상업적 이용이 금지된 로고는 등록되지 않을 수 있어요.
              </p>
            </form>
          </>
        )}
      </main>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 14,
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

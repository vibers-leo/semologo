"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged, signInWithPopup, type User } from "firebase/auth";
import { getClientAuth, googleProvider } from "@/lib/firebase";
import { submitLogoRequest } from "@/lib/logo-requests";
import Link from "next/link";
import Header from "@/components/Header";

export default function SubmitPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    brandName: "",
    brandNameEn: "",
    website: "",
    note: "",
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(getClientAuth(), (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(getClientAuth(), googleProvider);
    } catch {
      // 팝업 취소 등 무시
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.brandName.trim()) return;
    setSubmitting(true);
    try {
      const reqId = await submitLogoRequest({
        userId: user.uid,
        userEmail: user.email ?? "",
        userDisplayName: user.displayName ?? "",
        brandName: form.brandName.trim(),
        brandNameEn: form.brandNameEn.trim(),
        website: form.website.trim(),
        note: form.note.trim(),
      });

      // 알림 전송 (ai-recipe relay)
      await fetch("https://ai.vibers.co.kr/api/logo-request-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: reqId,
          brandName: form.brandName,
          brandNameEn: form.brandNameEn,
          website: form.website,
          note: form.note,
          userEmail: user.email,
          userDisplayName: user.displayName,
        }),
      }).catch(() => { /* 알림 실패해도 요청은 저장됨 */ });

      setDone(true);
    } catch (err) {
      console.error(err);
      alert("요청 저장 중 오류가 발생했어요. 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <Header />
      <main className="max-w-[600px] mx-auto px-4 py-12">
        {loading ? null : !user ? (
          /* 미로그인 */
          <div className="text-center py-16">
            <p className="text-4xl mb-4">🔐</p>
            <h1 className="text-xl font-bold mb-2">로그인이 필요해요</h1>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
              로고 요청은 로그인 후 이용할 수 있어요.
            </p>
            <button
              onClick={handleLogin}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium text-white"
              style={{ background: "#111" }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Google로 로그인
            </button>
          </div>
        ) : done ? (
          /* 제출 완료 */
          <div className="text-center py-16">
            <p className="text-4xl mb-4">✅</p>
            <h1 className="text-xl font-bold mb-2">요청이 접수됐어요!</h1>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
              검토 후 로고가 추가되면 요청 게시판에 완료로 표시돼요.
            </p>
            <div className="flex gap-3 justify-center">
              <Link
                href="/requests/"
                className="px-4 py-2 rounded-full text-sm font-medium border"
                style={{ borderColor: "var(--border)" }}
              >
                요청 목록 보기
              </Link>
              <button
                onClick={() => { setDone(false); setForm({ brandName: "", brandNameEn: "", website: "", note: "" }); }}
                className="px-4 py-2 rounded-full text-sm font-medium text-white"
                style={{ background: "#111" }}
              >
                추가 요청하기
              </button>
            </div>
          </div>
        ) : (
          /* 폼 */
          <>
            <div className="mb-8">
              <h1 className="text-2xl font-bold">로고 요청</h1>
              <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                등록을 원하는 브랜드 로고를 알려주세요. 검토 후 추가해 드릴게요.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">브랜드명 (한글) *</label>
                <input
                  type="text"
                  required
                  value={form.brandName}
                  onChange={(e) => setForm({ ...form, brandName: e.target.value })}
                  placeholder="예: 삼성전자"
                  className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-colors"
                  style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#111")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">브랜드명 (영문)</label>
                <input
                  type="text"
                  value={form.brandNameEn}
                  onChange={(e) => setForm({ ...form, brandNameEn: e.target.value })}
                  placeholder="예: Samsung Electronics"
                  className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-colors"
                  style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#111")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">공식 홈페이지</label>
                <input
                  type="url"
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  placeholder="https://www.samsung.com"
                  className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-colors"
                  style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#111")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">추가 메모</label>
                <textarea
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="SVG 파일 위치, 특이사항 등 자유롭게 적어주세요."
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-colors resize-none"
                  style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#111")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {user.displayName}({user.email})로 제출
                </p>
                <button
                  type="submit"
                  disabled={submitting || !form.brandName.trim()}
                  className="px-6 py-2.5 rounded-full text-sm font-medium text-white transition-opacity disabled:opacity-40"
                  style={{ background: "#111" }}
                >
                  {submitting ? "제출 중..." : "요청하기"}
                </button>
              </div>
            </form>
          </>
        )}
      </main>
    </div>
  );
}

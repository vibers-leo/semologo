"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { getClientAuth } from "@/lib/firebase";
import { deleteLogoPost, listLogoPosts, saveLogoPost, toLogoPost, type LogoPost } from "@/lib/logo-posts";
import { INDEX_REVIEW_BRANDS } from "@/lib/index-candidate-review-submissions";
import Header from "@/components/Header";

const ADMIN_EMAIL = "juuuno1116@gmail.com";

export default function AdminPostsPage() {
  const [ready, setReady] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [posts, setPosts] = useState<LogoPost[]>([]);
  const [error, setError] = useState("");

  async function refresh() {
    try { setPosts(await listLogoPosts()); }
    catch { setError("게시물을 불러오지 못했어요. Firestore 권한을 확인해 주세요."); }
  }

  useEffect(() => onAuthStateChanged(getClientAuth(), user => {
    const ok = user?.email === ADMIN_EMAIL;
    setAdmin(ok); setReady(true); if (ok) refresh();
  }), []);

  if (!ready) return <><Header /><p style={{ padding: 80, textAlign: "center" }}>불러오는 중…</p></>;
  if (!admin) return null;

  async function archive(post: LogoPost) {
    await saveLogoPost({ ...post, status: "archived", updated_at: new Date().toISOString() });
    await refresh();
  }

  async function publish(post: LogoPost) {
    await saveLogoPost({ ...post, status: "published", published_at: post.published_at || new Date().toISOString(), updated_at: new Date().toISOString() });
    await refresh();
  }

  async function remove(post: LogoPost) {
    if (!window.confirm(`${post.name_ko} 게시물을 삭제할까요?`)) return;
    await deleteLogoPost(post.id); await refresh();
  }

  async function importCandidates() {
    const existing = new Set(posts.map(post => post.id));
    const candidates = INDEX_REVIEW_BRANDS.filter(brand => !existing.has(brand.id));
    for (const brand of candidates) await saveLogoPost(toLogoPost(brand, { status: "draft", author_uid: getClientAuth().currentUser?.uid }));
    await refresh();
  }

  return <div style={{ minHeight: "100vh", background: "var(--bg)" }}><Header /><main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 16px" }}>
    <h1 style={{ fontSize: 24, fontWeight: 800 }}>CMS 로고 게시물</h1>
    <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: "6px 0 20px" }}>신규 수집 로고를 게시·보관·삭제합니다. 기존 정적 카탈로그는 그대로 유지됩니다.</p>
    <button onClick={importCandidates} style={{ padding: "9px 13px", borderRadius: 9, background: "#111", color: "#fff", border: 0, marginBottom: 18 }}>신규 수집 후보를 초안으로 가져오기 ({INDEX_REVIEW_BRANDS.length})</button>
    {error && <p role="alert" style={{ color: "#dc2626", fontSize: 13 }}>{error}</p>}
    {!error && posts.length === 0 && <p style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>게시된 CMS 로고가 아직 없어요.</p>}
    <div style={{ display: "grid", gap: 10 }}>{posts.map(post => <article key={post.id} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: 14, display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 100, height: 60, display: "grid", placeItems: "center", background: "#f4f4f5", borderRadius: 8 }}><img src={typeof post.logo_svg === "string" ? post.logo_svg : (typeof post.logo_png === "string" ? post.logo_png : "")} alt="" style={{ maxWidth: "88px", maxHeight: "48px" }} /></div>
      <div style={{ flex: 1 }}><b>{post.name_ko}</b><div style={{ fontSize: 12, color: "#71717a" }}>{post.category} · {post.status}</div></div>
      {post.status === "draft" && <button onClick={() => publish(post)} style={{ padding: "7px 10px", background: "#6366f1", color: "#fff", border: 0, borderRadius: 7 }}>게시</button>}
      {post.status === "published" && <button onClick={() => archive(post)} style={{ padding: "7px 10px" }}>보관</button>}
      <button onClick={() => remove(post)} style={{ padding: "7px 10px", color: "#dc2626" }}>삭제</button>
    </article>)}</div>
  </main></div>;
}

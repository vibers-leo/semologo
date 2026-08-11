"use client";

/**
 * 운영 허브.
 *
 * 역할을 나눴다:
 *   · 깊은 통계·문의  → FanEasy(Vibers) Admin — 여러 사이트를 한 곳에서 본다
 *   · 방문 통계        → Google Analytics
 *   · 요청 접수 처리   → /requests (이 사이트 안에서 바로)
 *   · 로고 DB 현황     → 여기 (세모로고에만 있는 데이터라 밖에서 못 본다)
 *
 * 예전엔 이 페이지에 요청 목록이 통째로 또 있었다. /requests 와 완전히 겹쳐서
 * 두 곳을 다 고쳐야 했고 한쪽만 고치면 갈라졌다. 목록은 /requests 하나로 모았다.
 */

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { getClientAuth } from "@/lib/firebase";
import { fetchBrands, type Brand } from "@/lib/brands";
import Header from "@/components/Header";

const ADMIN_EMAIL = "juuuno1116@gmail.com";
const CDN = process.env.NEXT_PUBLIC_CDN_URL || "https://logo.vibers.co.kr/_clients";

/** 외부 운영 도구 — 주소가 바뀌면 여기만 고친다 */
const FANEASY_ADMIN = "https://faneasy.kr/admin";
const GA_PROPERTY = "https://analytics.google.com/analytics/web/#/p548184496/reports/intelligenthome";

export default function AdminPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(getClientAuth(), (user) => {
      if (user?.email === ADMIN_EMAIL) setIsAdmin(true);
      else router.replace("/");
      setAuthChecked(true);
    });
    return unsub;
  }, [router]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchBrands().then(setBrands).finally(() => setLoading(false));
  }, [isAdmin]);

  const stats = useMemo(() => {
    const cat = new Map<string, number>();
    let svg = 0, pngOnly = 0, noKorean = 0;
    const han = /[가-힣]/;
    for (const b of brands) {
      cat.set(b.category || "기타", (cat.get(b.category || "기타") || 0) + 1);
      if (b.logo_svg) svg++;
      else if (b.logo_png) pngOnly++;
      if (!han.test(b.name_ko || "")) noKorean++;
    }
    return {
      cats: [...cat.entries()].sort((a, b) => b[1] - a[1]),
      svg, pngOnly, noKorean,
    };
  }, [brands]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return brands.filter(b =>
      (b.name_ko || "").toLowerCase().includes(q) ||
      (b.name_en || "").toLowerCase().includes(q) ||
      b.id.toLowerCase().includes(q)
    ).slice(0, 30);
  }, [brands, search]);

  if (!authChecked) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <Header />
        <p style={{ padding: "80px 0", textAlign: "center", color: "var(--text-secondary)", fontSize: 14 }}>
          불러오는 중…
        </p>
      </div>
    );
  }
  if (!isAdmin) return null;

  const card = {
    background: "#fff", border: "1px solid var(--border)", borderRadius: 16, padding: "18px 20px",
  } as const;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Header />
      <main style={{ maxWidth: 860, margin: "0 auto", padding: "26px 16px 72px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>운영</h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 22 }}>
          깊은 통계와 문의는 통합 어드민에서, 로고 DB 현황은 여기에서 봐요.
        </p>

        {/* 외부 도구 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12, marginBottom: 14 }}>
          {[
            { href: FANEASY_ADMIN, emoji: "🗂", title: "통합 어드민", desc: "여러 사이트의 통계·문의를 한 곳에서", ext: true },
            { href: GA_PROPERTY, emoji: "📈", title: "방문 통계 (GA4)", desc: "유입·검색어·페이지별 방문", ext: true },
            { href: "/requests", emoji: "📮", title: "요청·제보 접수", desc: "들어온 로고 요청과 품질 신고 처리", ext: false },
          ].map(({ href, emoji, title, desc, ext }) => {
            const inner = (
              <>
                <div style={{ fontSize: 20, marginBottom: 8 }}>{emoji}</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>
                  {title}{ext && <span style={{ fontSize: 11, color: "#a1a1aa", marginLeft: 5 }}>↗</span>}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{desc}</div>
              </>
            );
            const style = { ...card, textDecoration: "none", color: "inherit", display: "block" } as const;
            return ext
              ? <a key={title} href={href} target="_blank" rel="noopener noreferrer" style={style}>{inner}</a>
              : <Link key={title} href={href} style={style}>{inner}</Link>;
          })}
        </div>

        {/* 로고 DB 현황 — 세모로고에만 있는 데이터라 외부 어드민이 볼 수 없다 */}
        <section style={{ ...card, marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#71717a", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 14 }}>
            로고 DB 현황
          </div>
          {loading ? (
            <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>불러오는 중…</p>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 12, marginBottom: 16 }}>
                {[
                  { label: "총 브랜드", value: brands.length, color: "#6366f1" },
                  { label: "SVG 보유", value: stats.svg, color: "#10b981" },
                  { label: "PNG 만", value: stats.pngOnly, color: "#f59e0b" },
                  { label: "한글명 없음", value: stats.noKorean, color: "#dc2626" },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 3 }}>{label}</p>
                    <p style={{ fontSize: 22, fontWeight: 800, color }}>{value.toLocaleString()}</p>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 11.5, color: "#a1a1aa", lineHeight: 1.6, margin: 0 }}>
                한글명이 없으면 한국어로 검색해도 안 나와요. 채우려면{" "}
                <code style={{ fontSize: 11 }}>brand-logos/scripts/fill-korean-names.py</code>
              </p>

              <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>카테고리별</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {stats.cats.slice(0, 14).map(([c, n]) => (
                    <span key={c} style={{ fontSize: 11.5, padding: "4px 9px", borderRadius: 999, background: "#f4f4f5", color: "#52525b" }}>
                      {c} <b>{n.toLocaleString()}</b>
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>

        {/* 브랜드 찾기 */}
        <section style={card}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#71717a", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 10 }}>
            브랜드 찾기
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름·id 로 검색 (예: 삼성, samsung)"
            style={{ width: "100%", padding: "9px 12px", borderRadius: 10, fontSize: 13,
                     border: "1px solid var(--border)", background: "#f9f9f9", outline: "none" }}
          />
          {search && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 2 }}>
              {filtered.length === 0 ? (
                <p style={{ fontSize: 12.5, color: "var(--text-secondary)", padding: "8px 0" }}>결과 없어요</p>
              ) : filtered.map((b) => (
                <a key={b.id} href={`/brand/${b.id}/`} target="_blank" rel="noopener noreferrer"
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 8px", borderRadius: 8,
                           textDecoration: "none", color: "inherit", fontSize: 12.5 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${CDN}/${b.id}/logo.png`} alt="" width={30} height={20}
                    style={{ objectFit: "contain", flexShrink: 0 }}
                    onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                  <span style={{ fontWeight: 600 }}>{b.name_ko}</span>
                  <span style={{ color: "var(--text-secondary)" }}>{b.id}</span>
                  <span style={{ marginLeft: "auto", fontSize: 11, color: b.logo_svg ? "#10b981" : "#a1a1aa" }}>
                    {b.logo_svg ? "SVG" : "PNG"}
                  </span>
                </a>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

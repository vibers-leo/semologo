"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { getClientAuth } from "@/lib/firebase";
import { SUPPORT, API_PERKS, apiRequestTemplate } from "@/lib/support";
import Header from "@/components/Header";

export default function MyPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(getClientAuth(), (u) => {
      if (!u) router.replace("/login");
      setUser(u);
      setChecked(true);
    });
    return unsub;
  }, [router]);

  const template = apiRequestTemplate(user?.email ?? undefined);

  const copyTemplate = async () => {
    try {
      await navigator.clipboard.writeText(template);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드가 막힌 환경 — 아래 상자에서 직접 긁어 가면 된다
    }
  };

  if (!checked) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <Header />
        <div style={{ padding: "80px 0", textAlign: "center", color: "var(--text-secondary)", fontSize: 14 }}>
          불러오는 중…
        </div>
      </div>
    );
  }
  if (!user) return null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Header />
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "28px 16px 72px" }}>

        {/* 인사 */}
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 5 }}>마이페이지</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {user.displayName ? `${user.displayName}님, ` : ""}반가워요 👋
          </p>
        </div>

        {/* API 키 발급 */}
        <section style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 16, padding: "22px 20px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#71717a", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 10 }}>
            API 키 발급
          </div>

          <h2 style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.4, marginBottom: 8 }}>
            커피 한 잔이면 API 키 드려요 ☕
          </h2>
          <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text-secondary)", marginBottom: 18 }}>
            코딩하다가 로고 하나 찾으러 검색창 열고, 저장하고, 이름 바꾸고…
            그러다 흐름 끊기잖아요. 그거 없애려고 만들었어요.
          </p>

          {/* 무엇이 열리나 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
            {API_PERKS.map((p) => (
              <div key={p.title} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ fontSize: 17, lineHeight: 1.4 }}>{p.emoji}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{p.title}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{p.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* 순서 */}
          <div style={{ background: "#f9f9f9", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 16px 14px", marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 12 }}>이렇게 하면 돼요</div>
            {[
              ["1", "커피 한 잔 사주기", "아래 버튼을 누르면 후원 페이지로 가요"],
              ["2", "메시지에 신청서 남기기", "메일 주소랑 어디에 쓸 건지 한 줄이면 충분해요"],
              ["3", "메일로 키 받기", "확인하는 대로 보내드릴게요"],
            ].map(([n, t, d]) => (
              <div key={n} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <span style={{ flexShrink: 0, width: 19, height: 19, borderRadius: 999, background: "#111", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {n}
                </span>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{t}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{d}</div>
                </div>
              </div>
            ))}
          </div>

          {/* 신청서 — 그대로 복사해서 후원 메시지에 붙이면 된다 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>후원 메시지에 붙여넣을 내용</span>
              <button onClick={copyTemplate}
                style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 7, cursor: "pointer",
                         background: copied ? "#16a34a" : "#f4f4f5", color: copied ? "#fff" : "#52525b",
                         border: `1px solid ${copied ? "#16a34a" : "var(--border)"}`, transition: "all .15s" }}>
                {copied ? "✅ 복사됨" : "📋 복사"}
              </button>
            </div>
            <pre style={{ margin: 0, background: "#f9f9f9", border: "1px solid var(--border)", borderRadius: 10,
                          padding: "10px 12px", fontSize: 12, lineHeight: 1.7, color: "#52525b",
                          whiteSpace: "pre-wrap", wordBreak: "break-all", fontFamily: "inherit" }}>
              {template}
            </pre>
          </div>

          <a href={SUPPORT.url} target="_blank" rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                     width: "100%", padding: "13px 0", borderRadius: 12, fontSize: 14, fontWeight: 700,
                     background: "#FFDD00", color: "#111", textDecoration: "none" }}>
            ☕ 커피 사주고 API 키 신청하기
          </a>

          <p style={{ fontSize: 11.5, lineHeight: 1.6, color: "#a1a1aa", marginTop: 12, marginBottom: 0 }}>
            정가로 파는 상품이 아니라 후원이에요. 커피 한 잔이면 충분하고, 그 이상은 마음 가는 만큼만요.
            키는 사람이 직접 만들어 보내드려서 조금 기다리셔야 할 수 있어요.
            궁금한 건 <a href={`mailto:${SUPPORT.contactEmail}`} style={{ color: "#6366f1" }}>{SUPPORT.contactEmail}</a> 로 편하게요.
          </p>
        </section>

        {/* 아직 없는 것들 — 없는 걸 있는 척하지 않는다 */}
        <section style={{ marginTop: 16, background: "#fff", border: "1px dashed var(--border)", borderRadius: 16, padding: "18px 20px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>곧 생길 것들 🚧</div>
          <p style={{ fontSize: 12, lineHeight: 1.7, color: "var(--text-secondary)", margin: 0 }}>
            찜한 로고 모아보기 · 내가 만든 리스트 · 제보한 로고 현황.
            준비되는 대로 여기에 붙일게요.
          </p>
        </section>
      </main>
    </div>
  );
}

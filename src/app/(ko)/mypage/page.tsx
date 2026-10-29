"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { getClientAuth } from "@/lib/firebase";
import Header from "@/components/Header";
import MyLogoWalls from "@/components/MyLogoWalls";

export default function MyPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(getClientAuth(), (u) => {
      if (!u) router.replace("/login");
      setUser(u);
      setChecked(true);
    });
    return unsub;
  }, [router]);

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

        <MyLogoWalls user={user} />

        <section style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 16, padding: "22px 20px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#71717a", letterSpacing: ".08em", marginBottom: 10 }}>개발자 파일럿</div>
          <h2 style={{ fontSize: 19, fontWeight: 800, marginBottom: 8 }}>API 키와 사용량을 한곳에서 관리해요</h2>
          <p style={{ fontSize: 13, lineHeight: 1.8, color: "var(--text-secondary)", marginBottom: 18 }}>API 키 발급·회수와 로고월 기능의 사용 한도를 확인할 수 있어요. 지금은 초대된 계정으로 운영 파일럿을 진행해요.</p>
          <a href="/developers/" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "11px 16px", borderRadius: 8, background: "#675cf0", color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>개발자 콘솔 열기</a>
        </section>

        {/* 아직 없는 것들 — 없는 걸 있는 척하지 않는다 */}
        <section style={{ marginTop: 16, background: "#fff", border: "1px dashed var(--border)", borderRadius: 16, padding: "18px 20px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>곧 생길 것들 🚧</div>
          <p style={{ fontSize: 12, lineHeight: 1.7, color: "var(--text-secondary)", margin: 0 }}>
            제보한 로고 현황.
            준비되는 대로 여기에 붙일게요.
          </p>
        </section>
      </main>
    </div>
  );
}

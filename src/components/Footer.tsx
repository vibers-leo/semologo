"use client";

import Link from "next/link";
import { useState } from "react";

const YEAR = new Date().getFullYear();

export default function Footer() {
  const [open, setOpen] = useState(false);
  const [bizOpen, setBizOpen] = useState(false);

  return (
    <>
      {/* 하단 고정 1줄 바 */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40"
        style={{ background: "#0f0f10", borderTop: "1px solid #1f1f23" }}>

        {/* 펼쳐지는 풀 패널 */}
        {open && (
          <div style={{ borderBottom: "1px solid #1f1f23", padding: "32px 24px 24px", maxWidth: 1280, margin: "0 auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 32, alignItems: "start" }}>

              {/* 좌측 */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#ffffff", letterSpacing: "-.02em" }}>세모로고</div>
                <p style={{ fontSize: 11, color: "#52525b", margin: 0 }}>© {YEAR} Vibers. All rights reserved.</p>
                <p style={{ fontSize: 11, lineHeight: 1.8, color: "#71717a", margin: 0 }}>
                  모든 로고의 저작권은 각 브랜드에게 있습니다.<br />
                  로고 사용 시 해당 브랜드의 브랜드 가이드라인을 따라주세요.
                </p>
                <p style={{ fontSize: 11, color: "#71717a", margin: 0 }}>
                  제휴 및 광고 문의{" "}
                  <a href="mailto:contact@semologo.com" style={{ color: "#a1a1aa", textDecoration: "underline", textUnderlineOffset: 3 }}>
                    contact@semologo.com
                  </a>
                </p>
                <div style={{ display: "flex", gap: 12, fontSize: 11 }}>
                  <Link href="/terms" style={{ color: "#71717a", textDecoration: "none" }}>이용약관</Link>
                  <span style={{ color: "#3f3f46" }}>|</span>
                  <Link href="/privacy" style={{ color: "#71717a", textDecoration: "none" }}>개인정보처리방침</Link>
                </div>
                <div>
                  <button
                    onClick={() => setBizOpen(o => !o)}
                    style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#52525b", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    사업자 정보
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                      style={{ transform: bizOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }}>
                      <path d="m6 9 6 6 6-6"/>
                    </svg>
                  </button>
                  {bizOpen && (
                    <div style={{ marginTop: 6, fontSize: 13, color: "#52525b", lineHeight: 1.9 }}>
                      상호: 주식회사 계발자들&nbsp;|&nbsp;대표: 김정원&nbsp;|&nbsp;개인정보관리책임자: 이준호<br />
                      문의: <a href="mailto:contact@semologo.com" style={{ color: "#71717a", textDecoration: "underline" }}>contact@semologo.com</a>
                    </div>
                  )}
                </div>
              </div>

              {/* 우측 링크 */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#ffffff", marginBottom: 4 }}>메뉴</div>
                {[
                  { label: "로고 제보", href: "/submit" },
                  { label: "로고 요청", href: "/request" },
                  { label: "자주 묻는 질문", href: "/faq" },
                  { label: "광고 문의", href: "mailto:contact@semologo.com" },
                ].map(({ label, href }) =>
                  href.startsWith("mailto") ? (
                    <a key={label} href={href} style={{ fontSize: 11, color: "#71717a", textDecoration: "none", whiteSpace: "nowrap" }}>{label}</a>
                  ) : (
                    <Link key={label} href={href} style={{ fontSize: 11, color: "#71717a", textDecoration: "none", whiteSpace: "nowrap" }}>{label}</Link>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {/* 항상 보이는 1줄 바 */}
        {/* 좁은 화면에서 height:44 고정이라 내용이 안 들어가 단어 중간에서
            줄바꿈되고 겹쳐 보였다. 높이를 최소값으로 바꾸고 줄바꿈을 허용하되,
            링크 자체는 nowrap 으로 묶어 '더보 기' 처럼 쪼개지지 않게 한다. */}
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "8px 24px", minHeight: 44, display: "flex", flexWrap: "wrap", rowGap: 6, columnGap: 12, alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: "#52525b", whiteSpace: "nowrap" }}>
            © {YEAR} 주식회사 계발자들 · 세모로고
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", rowGap: 6 }}>
            <Link href="/submit" style={{ fontSize: 12, color: "#71717a", textDecoration: "none", whiteSpace: "nowrap" }}>로고 제보</Link>
            <Link href="/request" style={{ fontSize: 12, color: "#71717a", textDecoration: "none", whiteSpace: "nowrap" }}>로고 요청</Link>
            <button
              onClick={() => setOpen(o => !o)}
              style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#a1a1aa", background: "none", border: "none", cursor: "pointer", padding: 0, whiteSpace: "nowrap" }}>
              {open ? "접기" : "더보기"}
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}>
                <path d="m6 9 6 6 6-6"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* 하단 고정 바 높이만큼 본문 여백 */}
      <div style={{ height: 44 }} />
    </>
  );
}

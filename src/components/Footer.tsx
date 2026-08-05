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
                  <a href="mailto:contact@vibers.co.kr" style={{ color: "#a1a1aa", textDecoration: "underline", textUnderlineOffset: 3 }}>
                    contact@vibers.co.kr
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
                    style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#52525b", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    사업자 정보
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                      style={{ transform: bizOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }}>
                      <path d="m6 9 6 6 6-6"/>
                    </svg>
                  </button>
                  {bizOpen && (
                    <div style={{ marginTop: 6, fontSize: 10, color: "#52525b", lineHeight: 1.9 }}>
                      상호: 비버스&nbsp;|&nbsp;대표: 권기원&nbsp;|&nbsp;개인정보관리책임자: 권기원<br />
                      문의: <a href="mailto:contact@vibers.co.kr" style={{ color: "#71717a", textDecoration: "underline" }}>contact@vibers.co.kr</a>
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
                  { label: "광고 문의", href: "mailto:contact@vibers.co.kr" },
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
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px", height: 44, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: "#52525b" }}>
            © {YEAR} Vibers · 세모로고
          </span>
          <div style={{ display: "flex", align: "center", gap: 16 }}>
            <Link href="/submit" style={{ fontSize: 12, color: "#71717a", textDecoration: "none" }}>로고 제보</Link>
            <Link href="/request" style={{ fontSize: 12, color: "#71717a", textDecoration: "none" }}>로고 요청</Link>
            <button
              onClick={() => setOpen(o => !o)}
              style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#a1a1aa", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
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

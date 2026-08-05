"use client";

import Link from "next/link";
import { useState } from "react";

const YEAR = new Date().getFullYear();

export default function Footer() {
  const [bizOpen, setBizOpen] = useState(false);

  return (
    <footer style={{ background: "#0f0f10", borderTop: "1px solid #1f1f23", color: "#a1a1aa" }}>
      <div style={{ maxWidth: 1600, margin: "0 auto", padding: "48px 24px 32px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 48 }}>

          {/* ── 좌측 ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 520 }}>
            {/* 브랜드명 */}
            <div style={{ fontSize: 20, fontWeight: 800, color: "#ffffff", letterSpacing: "-.02em" }}>
              세모로고
            </div>

            {/* 카피라이트 */}
            <p style={{ fontSize: 12, color: "#52525b", marginTop: -8 }}>
              © {YEAR} Vibers. All rights reserved.
            </p>

            {/* 저작권 고지 */}
            <p style={{ fontSize: 12, lineHeight: 1.8, color: "#71717a" }}>
              모든 로고의 저작권은 각 브랜드에게 있습니다.<br />
              로고 사용 시 해당 브랜드의 브랜드 가이드라인을 따라주세요.
            </p>

            {/* 연락처 */}
            <p style={{ fontSize: 12, color: "#71717a" }}>
              제휴 및 광고 문의{" "}
              <a href="mailto:contact@vibers.co.kr"
                style={{ color: "#a1a1aa", textDecoration: "underline", textUnderlineOffset: 3 }}>
                contact@vibers.co.kr
              </a>
            </p>

            {/* 약관 링크 */}
            <div style={{ display: "flex", gap: 12, fontSize: 12 }}>
              <Link href="/terms"
                style={{ color: "#71717a", textDecoration: "none" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#e4e4e7")}
                onMouseLeave={e => (e.currentTarget.style.color = "#71717a")}>
                이용약관
              </Link>
              <span style={{ color: "#3f3f46" }}>|</span>
              <Link href="/privacy"
                style={{ color: "#71717a", textDecoration: "none" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#e4e4e7")}
                onMouseLeave={e => (e.currentTarget.style.color = "#71717a")}>
                개인정보처리방침
              </Link>
            </div>

            {/* 사업자 정보 아코디언 */}
            <div>
              <button
                onClick={() => setBizOpen(o => !o)}
                style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#52525b", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                세모로고 사업자 정보
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  style={{ transform: bizOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }}>
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              </button>
              {bizOpen && (
                <div style={{ marginTop: 8, fontSize: 11, color: "#52525b", lineHeight: 1.9 }}>
                  상호: 비버스&nbsp;|&nbsp;대표: 권기원&nbsp;|&nbsp;
                  개인정보관리책임자: 권기원<br />
                  문의:{" "}
                  <a href="mailto:contact@vibers.co.kr"
                    style={{ color: "#71717a", textDecoration: "underline" }}>
                    contact@vibers.co.kr
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* ── 우측 네비 ── */}
          <div style={{ display: "flex", gap: 56 }}>
            {/* 세모로고 */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#ffffff", marginBottom: 14, letterSpacing: "-.01em" }}>
                세모로고
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "로고 제보", href: "/submit" },
                  { label: "로고 요청", href: "/request" },
                  { label: "자주 묻는 질문", href: "/faq" },
                  { label: "광고 문의", href: "mailto:contact@vibers.co.kr" },
                ].map(({ label, href }) => (
                  href.startsWith("mailto") ? (
                    <a key={label} href={href}
                      style={{ fontSize: 12, color: "#71717a", textDecoration: "none", whiteSpace: "nowrap" }}
                      onMouseEnter={e => (e.currentTarget.style.color = "#e4e4e7")}
                      onMouseLeave={e => (e.currentTarget.style.color = "#71717a")}>
                      {label}
                    </a>
                  ) : (
                    <Link key={label} href={href}
                      style={{ fontSize: 12, color: "#71717a", textDecoration: "none", whiteSpace: "nowrap" }}
                      onMouseEnter={e => (e.currentTarget.style.color = "#e4e4e7")}
                      onMouseLeave={e => (e.currentTarget.style.color = "#71717a")}>
                      {label}
                    </Link>
                  )
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

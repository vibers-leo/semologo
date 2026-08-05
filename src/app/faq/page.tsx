"use client";

import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";

const FAQS = [
  {
    q: "세모로고는 어떤 서비스인가요?",
    a: "세모로고는 국내외 2,700개 이상의 브랜드 로고를 SVG·PNG 형식으로 무료 제공하는 서비스입니다. '세상 모든 로고'를 쉽게 찾고 다운받을 수 있도록 만들었어요.",
  },
  {
    q: "로고를 상업적으로 사용해도 되나요?",
    a: "모든 로고의 저작권은 각 브랜드에게 있습니다. 상업적 사용 전 반드시 해당 브랜드의 브랜드 가이드라인을 확인하고, 필요 시 해당 브랜드의 허락을 받으세요. 세모로고는 로고를 참조·탐색 목적으로 제공하며 상업적 사용에 대한 책임을 지지 않습니다.",
  },
  {
    q: "원하는 브랜드 로고가 없어요. 어떻게 요청하나요?",
    a: "상단 메뉴 '로고 요청'을 클릭해 브랜드명과 웹사이트를 입력하면 요청이 접수됩니다. 다른 이용자들의 투표로 우선순위가 높아지면 더 빨리 추가될 수 있어요.",
  },
  {
    q: "내가 가진 고품질 로고를 제보할 수 있나요?",
    a: "네! 상단 메뉴 '로고 제보'에서 SVG·PNG 파일을 제출할 수 있습니다. 검토 후 세모로고에 반영됩니다.",
  },
  {
    q: "SVG와 PNG 중 어떤 걸 써야 하나요?",
    a: "확대해도 깨지지 않아야 한다면 SVG, 호환성이 중요하다면 PNG를 선택하세요. 웹/앱 개발에는 SVG가 권장되며, 문서·발표자료에는 PNG 800px 버전이 적합합니다.",
  },
  {
    q: "다크 배경용 로고는 어떻게 받나요?",
    a: "브랜드 상세 화면의 다크 프리뷰 아래 '반전 PNG (다크용)' 버튼이 있으면 다운받을 수 있습니다. 단색 검정 로고의 경우 자동으로 흑백 반전된 버전을 생성해드립니다.",
  },
  {
    q: "로고가 잘못됐거나 더 좋은 버전이 있어요.",
    a: "브랜드 상세 화면 우측의 '더 좋은 버전 제보하기'를 이용해주세요. 공식 로고 URL이나 파일을 첨부하면 더 빠르게 반영됩니다.",
  },
  {
    q: "광고 문의는 어떻게 하나요?",
    a: "contact@vibers.co.kr 로 문의주세요. 배너 광고, 스폰서십 등 다양한 방식으로 협력할 수 있습니다.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b" style={{ borderColor: "var(--border)" }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-4 text-left"
        style={{ background: "none", border: "none", cursor: "pointer" }}>
        <span className="font-semibold text-sm pr-4" style={{ color: "var(--text)" }}>{q}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform .2s", color: "var(--text-secondary)" }}>
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>
      {open && (
        <p className="pb-4 text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.8 }}>{a}</p>
      )}
    </div>
  );
}

export default function FaqPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      <Header />
      <main className="flex-1 max-w-[720px] mx-auto px-4 py-12">
        <Link href="/" className="inline-flex items-center gap-1 text-sm mb-8"
          style={{ color: "var(--text-secondary)", textDecoration: "none" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="m15 18-6-6 6-6"/>
          </svg>
          세모로고 홈
        </Link>

        <h1 className="text-2xl font-black mb-1">자주 묻는 질문</h1>
        <p className="text-sm mb-10" style={{ color: "var(--text-secondary)" }}>
          궁금한 점이 있으면 아래에서 확인해보세요.
        </p>

        <div>
          {FAQS.map((faq, i) => (
            <FaqItem key={i} q={faq.q} a={faq.a} />
          ))}
        </div>

        <div className="mt-12 p-6 rounded-2xl text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="font-bold mb-1">원하는 답변을 못 찾으셨나요?</p>
          <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
            이메일로 문의주시면 빠르게 답변드릴게요.
          </p>
          <a href="mailto:contact@vibers.co.kr"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white"
            style={{ background: "#111", textDecoration: "none" }}>
            ✉️ contact@vibers.co.kr
          </a>
        </div>
      </main>
      <Footer />
    </div>
  );
}

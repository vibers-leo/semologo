import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "이용약관 — 세모로고",
};

export default function TermsPage() {
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

        <h1 className="text-2xl font-black mb-2">이용약관</h1>
        <p className="text-sm mb-10" style={{ color: "var(--text-secondary)" }}>시행일: 2026년 8월 1일</p>

        <div className="flex flex-col gap-8 text-sm" style={{ lineHeight: 1.9, color: "var(--text)" }}>

          <section>
            <h2 className="font-bold text-base mb-3">제1조 (목적)</h2>
            <p>본 약관은 비버스(이하 "회사")가 운영하는 세모로고(semo.vibers.co.kr, 이하 "서비스")의 이용과 관련하여 회사와 이용자 간의 권리·의무 및 책임 사항을 규정함을 목적으로 합니다.</p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-3">제2조 (정의)</h2>
            <ul className="flex flex-col gap-2 pl-4" style={{ listStyleType: "disc" }}>
              <li>"서비스"란 회사가 제공하는 브랜드 로고 검색·다운로드 플랫폼을 의미합니다.</li>
              <li>"이용자"란 서비스에 접속하여 이용하는 모든 사람을 의미합니다.</li>
              <li>"로고"란 서비스에서 제공되는 각 브랜드의 로고 이미지(SVG, PNG 등)를 의미합니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-base mb-3">제3조 (서비스 이용)</h2>
            <ul className="flex flex-col gap-2 pl-4" style={{ listStyleType: "disc" }}>
              <li>서비스는 누구나 무료로 이용할 수 있습니다.</li>
              <li>로그인(Google OAuth)은 로고 제보 등 일부 기능 이용 시 필요할 수 있습니다.</li>
              <li>회사는 서비스의 일부 또는 전부를 사전 고지 없이 변경·중단할 수 있습니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-base mb-3">제4조 (저작권 및 지식재산권)</h2>
            <ul className="flex flex-col gap-2 pl-4" style={{ listStyleType: "disc" }}>
              <li>서비스에서 제공되는 모든 로고의 저작권은 각 브랜드 또는 해당 저작권자에게 귀속됩니다.</li>
              <li>세모로고는 로고를 수집·정리하여 참조 목적으로 제공하며, 로고 자체에 대한 저작권을 주장하지 않습니다.</li>
              <li>이용자는 로고 사용 시 해당 브랜드의 브랜드 가이드라인 및 저작권법을 준수해야 합니다.</li>
              <li>상업적 목적의 로고 사용 전, 반드시 해당 브랜드 소유자의 허락을 받으시기 바랍니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-base mb-3">제5조 (금지 행위)</h2>
            <ul className="flex flex-col gap-2 pl-4" style={{ listStyleType: "disc" }}>
              <li>서비스 또는 서버에 과도한 부하를 유발하는 행위(무단 대량 크롤링 등)</li>
              <li>타인의 권리를 침해하는 방식으로 로고를 사용하는 행위</li>
              <li>서비스의 정상적인 운영을 방해하는 행위</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-base mb-3">제6조 (면책)</h2>
            <p>회사는 로고의 정확성·완전성에 대해 보증하지 않으며, 이용자가 로고를 사용함으로써 발생하는 분쟁·손해에 대해 책임을 지지 않습니다.</p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-3">제7조 (문의)</h2>
            <p>이용약관에 관한 문의는 아래로 연락주세요.</p>
            <p className="mt-2">이메일:{" "}
              <a href="mailto:contact@vibers.co.kr" style={{ color: "#6366f1" }}>contact@vibers.co.kr</a>
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}

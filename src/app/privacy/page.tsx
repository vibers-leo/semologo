import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침 — 세모로고",
};

export default function PrivacyPage() {
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

        <h1 className="text-2xl font-black mb-2">개인정보처리방침</h1>
        <p className="text-sm mb-10" style={{ color: "var(--text-secondary)" }}>시행일: 2026년 8월 1일</p>

        <div className="flex flex-col gap-8 text-sm" style={{ lineHeight: 1.9, color: "var(--text)" }}>

          <section>
            <h2 className="font-bold text-base mb-3">1. 수집하는 개인정보</h2>
            <p className="mb-2">세모로고는 최소한의 정보만 수집합니다.</p>
            <ul className="flex flex-col gap-2 pl-4" style={{ listStyleType: "disc" }}>
              <li><strong>Google 로그인 시:</strong> 이름, 이메일, 프로필 사진 (Google OAuth 제공 정보)</li>
              <li><strong>로고 제보 시:</strong> 이메일(선택), 제보 내용</li>
              <li><strong>자동 수집:</strong> 서비스 이용 기록, 접속 IP, 브라우저 정보 (Google Analytics)</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-base mb-3">2. 수집 목적</h2>
            <ul className="flex flex-col gap-2 pl-4" style={{ listStyleType: "disc" }}>
              <li>서비스 제공 및 운영</li>
              <li>로고 제보·요청 처리</li>
              <li>서비스 품질 개선 (통계 분석)</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-base mb-3">3. 보유 및 이용 기간</h2>
            <p>개인정보는 수집 목적이 달성되면 즉시 파기합니다. 단, 관계 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.</p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-3">4. 제3자 제공</h2>
            <p>세모로고는 이용자의 개인정보를 제3자에게 제공하지 않습니다. 단, 아래의 경우는 예외입니다.</p>
            <ul className="flex flex-col gap-2 pl-4 mt-2" style={{ listStyleType: "disc" }}>
              <li>이용자가 사전에 동의한 경우</li>
              <li>법령에 의해 요청된 경우</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-base mb-3">5. 외부 서비스</h2>
            <ul className="flex flex-col gap-2 pl-4" style={{ listStyleType: "disc" }}>
              <li><strong>Google Analytics:</strong> 서비스 이용 통계 분석</li>
              <li><strong>카카오 애드핏:</strong> 광고 제공 (카카오 개인정보처리방침 적용)</li>
              <li><strong>Firebase (Google):</strong> 인증 및 데이터 저장</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-base mb-3">6. 이용자 권리</h2>
            <p>이용자는 언제든지 본인의 개인정보 열람, 정정, 삭제를 요청할 수 있습니다.</p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-3">7. 쿠키</h2>
            <p>세모로고는 서비스 이용 편의를 위해 쿠키와 localStorage를 사용합니다. 브라우저 설정에서 쿠키를 거부할 수 있으나, 일부 기능이 제한될 수 있습니다.</p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-3">8. 개인정보보호 책임자</h2>
            <p>개인정보 관련 문의 및 불만 처리는 아래로 연락주세요.</p>
            <ul className="flex flex-col gap-1 mt-2 pl-4" style={{ listStyleType: "none" }}>
              <li>책임자: 권기원</li>
              <li>이메일:{" "}
                <a href="mailto:contact@vibers.co.kr" style={{ color: "#6366f1" }}>contact@vibers.co.kr</a>
              </li>
            </ul>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}

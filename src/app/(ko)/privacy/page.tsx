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

        <h1 className="text-2xl font-black mb-2">개인정보처리방침</h1><section className="mt-8 rounded-xl border p-5 text-sm leading-7"><h2 className="font-bold">광고·제휴 문의</h2><p>문의 답변을 위해 담당자 이름, 이메일, 회사명(선택), 문의 내용과 최초 유입 경로를 수집해요. 접수일부터 1년간 보관 후 삭제해요. 문의는 관리자 화면에 저장하고 운영자 이메일로 알림을 보내요. 동의하지 않으면 문의를 접수할 수 없어요.</p></section>
        <p className="text-sm mb-10" style={{ color: "var(--text-secondary)" }}>최종 갱신: 2026년 10월 11일</p>

        <div className="flex flex-col gap-8 text-sm" style={{ lineHeight: 1.9, color: "var(--text)" }}>

          <section>
            <h2 className="font-bold text-base mb-3">1. 수집하는 개인정보</h2>
            <p className="mb-2">세모로고는 최소한의 정보만 수집합니다.</p>
            <ul className="flex flex-col gap-2 pl-4" style={{ listStyleType: "disc" }}>
              <li><strong>Google 로그인 시:</strong> 이름, 이메일, 프로필 사진 (Google OAuth 제공 정보)</li>
              <li><strong>로고 제보 시:</strong> 이메일(선택), 제보 내용</li>
              <li><strong>서비스 이용 분석:</strong> 익명 방문 세션, UTM 유입 경로, 페이지 방문, 검색어, 로고 열람 및 다운로드 선택, 기기·브라우저 종류를 기록합니다. 이메일·이름과 연결하지 않으며 원본 IP를 저장하지 않습니다. 이 기록은 90일 후 삭제합니다.</li>
              <li><strong>자동 수집:</strong> 서비스 이용 기록, 접속 IP, 브라우저 정보 (Google Analytics)</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-base mb-3">모바일 앱과 서버 접속 기록</h2>
            <p>모바일 앱의 저장 목록은 기기에 보관되며 웹 회원 계정과 동기화되지 않습니다. PNG 공유에 쓰는 임시 파일은 공유 처리가 끝나면 삭제합니다. 앱에는 로그인·광고·방문 분석 SDK가 포함되어 있지 않습니다.</p>
            <p className="mt-2">로고 검색과 이미지 전송 과정에서 서버에는 검색어가 포함된 요청 경로, 접속 IP, 브라우저·기기 정보, 참조 페이지가 접속 로그로 남습니다. 이는 로고 제공, 장애 확인 및 서비스 운영에 사용합니다. 웹 서버 접속 로그는 주 단위로 순환하고 이전 로그 4개를 보관합니다. 앞서 안내한 90일 이용 분석 기록과는 별도입니다.</p>
            <p className="mt-2">전체 로고 구성을 브라우저에서 열면 웹사이트의 로그인·분석·광고 정책이 적용됩니다.</p>
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
              <li><strong>Adsterra:</strong> 배너 광고 제공을 위해 광고 식별자, IP 주소, 브라우저·기기 정보, 광고 노출·반응 정보 등이 처리될 수 있습니다. 제공사의 쿠키 및 개인정보 처리 방식이 적용되며, 자세한 내용은 <a href="https://adsterra.com/privacy-policy/" target="_blank" rel="noopener noreferrer" style={{ color: "#6366f1" }}>개인정보 처리방침</a>과 <a href="https://adsterra.com/cookies/" target="_blank" rel="noopener noreferrer" style={{ color: "#6366f1" }}>쿠키 안내</a>를 확인해 주세요.</li>
              <li><strong>Firebase (Google):</strong> 인증 및 데이터 저장</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-base mb-3">6. 이용자 권리</h2>
            <p>이용자는 언제든지 본인의 개인정보 열람, 정정, 삭제를 요청할 수 있습니다.</p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-3">7. 쿠키</h2>
            <p>세모로고와 외부 광고·분석 제공사는 서비스 운영, 광고 제공 및 성과 측정을 위해 쿠키 또는 유사 식별자를 사용할 수 있습니다. 외부 제공사의 처리·보관 방식은 각 제공사의 정책을 따릅니다. 브라우저 설정에서 쿠키를 차단하거나 삭제할 수 있으며, 광고 관련 선택·권리 문의는 개인정보 보호책임자 이메일로 접수해 주세요.</p>
          </section>

          <section>
            <h2 className="font-bold text-base mb-3">8. 개인정보보호 책임자</h2>
            <p>개인정보 관련 문의 및 불만 처리는 아래로 연락주세요.</p>
            <ul className="flex flex-col gap-1 mt-2 pl-4" style={{ listStyleType: "none" }}>
              <li>책임자: 권기원</li>
              <li>이메일:{" "}
                <a href="mailto:vibers@vibers.co.kr" style={{ color: "#6366f1" }}>vibers@vibers.co.kr</a>
              </li>
            </ul>
          </section>
        </div>
      <section className="mt-8"><h2 className="font-bold">사이트 즐겨찾기 및 방문 통계</h2><p className="mt-3 text-sm leading-7">사이트 즐겨찾기는 브라우저가 관리하며 SemoLogo는 북마크 정보를 받거나 저장하지 않아요. 서비스 개선을 위해 Google Analytics와 FanEasy를 통해 방문 경로, 캠페인(UTM), 기기 정보, 체류시간 등 이용 통계를 수집해요.</p></section>
        </main>
      <Footer />
    </div>
  );
}

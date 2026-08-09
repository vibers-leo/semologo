"use client";

import { useEffect, useState } from "react";

/**
 * Vibers 광고 서버(ai.vibers.co.kr) 게재 슬롯.
 * iframe 한 줄이 계약의 전부 — 어떤 광고가 나올지, 소재 교체, 노출/클릭 집계는
 * 전부 광고 서버가 처리한다. 이 컴포넌트는 뷰포트에 맞는 포맷만 고른다.
 *   PC(≥768px): 1600×163 (+28px 팝아웃 헤드룸 = 1600:191)
 *   모바일: 640×210
 */
const AD_SERVER = "https://ai.vibers.co.kr";

export default function VibersAdSlot({ slot = "home_top" }: { slot?: string }) {
  const [format, setFormat] = useState<"pc" | "mobile" | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setFormat(mq.matches ? "pc" : "mobile");
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  if (!format) return null;

  const ratio = format === "pc" ? "1600 / 191" : "640 / 210";

  return (
    <div style={{ width: "100%", aspectRatio: ratio }}>
      <iframe
        src={`${AD_SERVER}/api/ads/frame?app=semologo&format=${format}&slot=${slot}`}
        title="sponsored"
        scrolling="no"
        loading="eager"
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
        style={{ width: "100%", height: "100%", border: 0, display: "block" }}
      />
    </div>
  );
}

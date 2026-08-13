"use client";

import { useEffect, useState } from "react";

/**
 * Vibers 광고 서버(ai.vibers.co.kr) 게재 슬롯.
 * iframe 한 줄이 계약의 전부 — 어떤 광고가 나올지, 소재 교체, 노출/클릭 집계는
 * 전부 광고 서버가 처리한다. 이 컴포넌트는 뷰포트에 맞는 포맷만 고른다.
 *   PC(≥768px): 1600×163 (+28px 팝아웃 헤드룸 = 1600:191)
 *   모바일: 640×210 (+22px 팝아웃 헤드룸 = 640:232)
 */
const AD_SERVER = "https://ai.vibers.co.kr";

/**
 * 세션 식별자 — 광고 서버가 같은 방문자에게 같은 광고를 보여주기 위해 쓴다(sticky).
 * 매번 다른 광고가 뜨면 스크롤·페이지 이동마다 배너가 바뀌어 산만하고,
 * "이 방문자는 A를 보고 안 눌렀다"는 해석도 성립하지 않는다.
 * sessionStorage라 탭을 닫으면 사라지고, 개인을 식별하지 않는 난수다.
 */
function getSessionId(): string {
  const KEY = "vibers_ad_sid";
  let sid = sessionStorage.getItem(KEY);
  if (!sid) {
    sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(KEY, sid);
  }
  return sid;
}

export default function VibersAdSlot({ slot = "home_top" }: { slot?: string }) {
  const [format, setFormat] = useState<"pc" | "mobile" | null>(null);
  const [sid, setSid] = useState<string>("");

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setFormat(mq.matches ? "pc" : "mobile");
    apply();
    setSid(getSessionId());
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  if (!format) return null;

  const ratio = format === "pc" ? "1600 / 191" : "640 / 232";

  return (
    <div style={{ width: "100%", aspectRatio: ratio }}>
      <iframe
        /* key: 뷰포트가 PC↔모바일로 바뀌면 iframe을 새로 마운트한다.
           같은 엘리먼트를 재사용하면 src만 바뀌어도 이전 포맷 배너가 남아 있을 수 있다. */
        key={format}
        src={`${AD_SERVER}/api/ads/frame?app=semologo&format=${format}&slot=${slot}&sid=${sid}`}
        title="sponsored"
        scrolling="no"
        loading="eager"
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
        style={{ width: "100%", height: "100%", border: 0, display: "block" }}
      />
    </div>
  );
}

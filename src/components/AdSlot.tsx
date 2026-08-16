"use client";

import Script from "next/script";

const AD_UNIT = "DAN-mQaGw76tAmtsCYKZ";

/** 데스크톱 우측 고정 영역용 카카오 애드핏 단위. */
export default function AdSlot() {
  return (
    <div className="w-[160px]" aria-label="광고">
      <ins
        className="kakao_ad_area"
        style={{ display: "none" }}
        data-ad-unit={AD_UNIT}
        data-ad-width="160"
        data-ad-height="600"
      />
      <Script
        id="kakao-adfit"
        src="https://t1.kakaocdn.net/kas/static/ba.min.js"
        strategy="afterInteractive"
      />
    </div>
  );
}

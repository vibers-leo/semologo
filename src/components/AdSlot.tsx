"use client";

import Script from "next/script";

const AD_UNIT = "DAN-JxagUgEMnuAikltM";

/** 카카오 애드핏 단위. 목록 첫 화면에만 한 번 배치한다. */
export default function AdSlot() {
  return (
    <div className="flex justify-center py-2" aria-label="광고">
      <ins
        className="kakao_ad_area"
        style={{ display: "none" }}
        data-ad-unit={AD_UNIT}
        data-ad-width="300"
        data-ad-height="250"
      />
      <Script
        id="kakao-adfit"
        src="https://t1.kakaocdn.net/kas/static/ba.min.js"
        strategy="afterInteractive"
      />
    </div>
  );
}

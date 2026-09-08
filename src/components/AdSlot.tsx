"use client";

import { useEffect, useRef } from "react";

const AD_UNIT = "DAN-mQaGw76tAmtsCYKZ";
const ADFIT_SRC = "https://t1.kakaocdn.net/kas/static/ba.min.js";

/**
 * 데스크톱 우측 고정 영역용 카카오 애드핏 단위 (160×600).
 *
 * ⚠️ 애드핏 ba.min.js 는 **로드 시점에 한 번** `ins.kakao_ad_area` 를 스캔한다.
 *    이 컴포넌트는 dynamic(ssr:false) 로 늦게 마운트되므로 next/script 로 넣으면
 *    스크립트가 먼저 돌고 슬롯은 나중에 생겨 광고 요청이 영영 안 나갔다
 *    (2026-09-08 실측: ba.min.js 200, 광고 요청 0건, ins display:none 유지).
 *    그래서 슬롯이 DOM 에 붙은 **뒤에** 스크립트 태그를 직접 삽입한다.
 *    이미 로드된 경우엔 태그를 지우고 다시 넣어 재스캔시킨다.
 */
export default function AdSlot() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    // 슬롯은 이 effect 시점에 이미 DOM 에 있다 (ref 가 잡혔다)
    document.querySelectorAll<HTMLScriptElement>(`script[src="${ADFIT_SRC}"]`).forEach((s) => s.remove());
    const s = document.createElement("script");
    s.src = ADFIT_SRC;
    s.async = true;
    s.charset = "utf-8";
    host.appendChild(s);
    return () => {
      s.remove();
    };
  }, []);

  return (
    <div ref={ref} className="w-[160px]" aria-label="광고">
      <ins
        className="kakao_ad_area"
        style={{ display: "none" }}
        data-ad-unit={AD_UNIT}
        data-ad-width="160"
        data-ad-height="600"
      />
    </div>
  );
}

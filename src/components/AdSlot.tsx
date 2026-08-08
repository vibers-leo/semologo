"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

interface Props {
  slot: string;
  format?: "auto" | "rectangle" | "horizontal";
  className?: string;
  style?: React.CSSProperties;
}

const PUBLISHER_ID = process.env.NEXT_PUBLIC_ADSENSE_ID || "ca-pub-7704550771011130";

/**
 * 광고가 안 채워지면 스스로 접힌다.
 *
 * 예전엔 wrapper 에 minHeight:90px 를 걸어놔서, AdSense 가 광고를 못 채워도
 * 90~102px 짜리 빈 띠가 그대로 남았다. 목록에서는 12개 카드마다 하나씩 생겨
 * '아무것도 없는 빈 카드'처럼 보였다 (실측: 슬롯 7개 전부 미노출).
 *
 * AdSense 는 채우지 못하면 <ins> 에 data-ad-status="unfilled" 를 붙인다.
 * 그걸 관찰해서 컨테이너를 없앤다. 상태를 못 읽는 경우(스크립트 차단 등)를
 * 대비해 일정 시간 뒤 높이가 여전히 0이면 그때도 접는다.
 */
export default function AdSlot({ slot, format = "auto", className = "", style }: Props) {
  const insRef = useRef<HTMLModElement>(null);
  const [state, setState] = useState<"pending" | "filled" | "empty">("pending");

  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      setState("empty");
      return;
    }

    const el = insRef.current;
    if (!el) return;

    // 높이로 판단하면 안 된다. AdSense 는 채울지 정하기 **전에** 먼저
    // 자리(90px)를 잡아두기 때문에, offsetHeight 를 보면 미노출인데도
    // '채워짐'으로 오판한다. data-ad-status 만 믿는다.
    const check = () => {
      const status = el.getAttribute("data-ad-status");
      if (status === "unfilled") { setState("empty"); return true; }
      if (status === "filled") { setState("filled"); return true; }
      return false;
    };

    if (check()) return;
    const obs = new MutationObserver(() => { if (check()) obs.disconnect(); });
    obs.observe(el, { attributes: true, attributeFilter: ["data-ad-status", "style"] });

    // 상태 속성이 끝내 안 붙는 경우(차단·비승인 등)의 안전망
    const t = setTimeout(() => { if (!check()) setState("empty"); }, 3000);
    return () => { obs.disconnect(); clearTimeout(t); };
  }, []);

  if (state === "empty") return null;

  // 채워지기 전에는 공간을 잡지 않는다 — 빈 띠가 보이는 것보다
  // 채워질 때 살짝 밀리는 편이 낫다.
  const wrapperStyle: React.CSSProperties =
    state === "filled" ? { ...style } : { ...style, minHeight: 0, height: 0, overflow: "hidden" };

  return (
    <div className={className} style={wrapperStyle}>
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: "block", ...(state === "filled" ? style : { minHeight: 0 }) }}
        data-ad-client={PUBLISHER_ID}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}

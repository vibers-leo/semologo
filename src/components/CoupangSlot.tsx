"use client";

/**
 * 쿠팡 파트너스 위젯 슬롯.
 *
 * 쿠팡이 주는 기본 스니펫은 전역 스크립트(`ads-partners.coupang.com/g.js`)를
 * 불러 `new PartnersCoupang.G(...)` 를 호출하는 방식인데, 정적 export + React
 * 환경에서는 스크립트 로드 시점과 마운트 시점이 엇갈려 위젯이 안 뜨는 일이 잦다.
 * 쿠팡이 같이 제공하는 **iframe 위젯 주소**를 직접 쓰면 그 문제가 없다.
 *
 * `referrerPolicy="unsafe-url"` 은 쿠팡 스니펫이 쓰는 값 그대로다 —
 * 유입 경로를 넘겨야 실적이 집계된다. 빼면 수수료가 안 잡힐 수 있다.
 *
 * 환경변수가 없으면 **아무것도 렌더하지 않는다.** 가입·승인 전에 배포돼도
 * 빈 상자가 남지 않는다.
 */

const WIDGET_ID = process.env.NEXT_PUBLIC_COUPANG_WIDGET_ID;
const TRACKING_CODE = process.env.NEXT_PUBLIC_COUPANG_TRACKING_CODE;

interface Props {
  /** 위젯 픽셀 크기. 사이드바 폭(약 240px)에 맞춘 정사각형이 기본 */
  size?: number;
  /** 유입 지면 구분용 (쿠팡 리포트에서 어느 자리가 버는지 본다) */
  subId?: string;
}

export default function CoupangSlot({ size = 240, subId = "brand" }: Props) {
  if (!WIDGET_ID || !TRACKING_CODE) return null;

  const src =
    `https://ads-partners.coupang.com/widgets.html` +
    `?id=${WIDGET_ID}&template=carousel&trackingCode=${TRACKING_CODE}` +
    `&subId=${encodeURIComponent(subId)}&width=${size}&height=${size}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <iframe
        src={src}
        width={size}
        height={size}
        title="쿠팡 파트너스 추천 상품"
        frameBorder={0}
        scrolling="no"
        referrerPolicy="unsafe-url"
        loading="lazy"
        style={{ border: 0, maxWidth: "100%", display: "block" }}
      />
      {/* 공정위 추천·보증 심사지침 + 쿠팡 파트너스 정책상 필수 고지.
          빼면 제재 사유가 된다. 눈에 보이는 위치여야 한다. */}
      <p style={{ fontSize: 11, lineHeight: 1.5, color: "#a1a1aa", textAlign: "center", margin: 0 }}>
        이 광고는 쿠팡 파트너스 활동의 일환으로,
        <br />
        이에 따른 일정액의 수수료를 제공받습니다.
      </p>
    </div>
  );
}

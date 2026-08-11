/**
 * 후원 · API 키 — 단일 출처.
 *
 * 문구가 마이페이지·FAQ·안내 메일로 흩어지면 서로 다른 말을 하게 된다.
 * 여기 한 곳만 고치면 전부 같은 말을 한다. (monopage `lib/plans.ts` 와 같은 방식)
 *
 * ■ '평생'·'무제한'이라고 못 박지 않는다
 * 커피 한 잔 후원과 큰 금액 후원에 같은 것을 약속할 수 없다. 화면에서
 * 기간과 한도를 확정하지 않고, 발급할 때 개별로 안내한다.
 *
 * ■ 처리 시간을 숫자로 약속하지 않는다
 * 사람이 직접 발급하는 구조라 "24시간 내" 같은 말은 지키지 못할 때가 생긴다.
 */

export const SUPPORT = {
  /** 후원 창구 — 2026-08-11 접속 확인(HTTP 200) */
  url: "https://buymeacoffee.com/vibers",
  channel: "Buy Me a Coffee",
  /** 발급 안내를 받을 주소 */
  contactEmail: "vibers.leo@gmail.com",
} as const;

/** 후원 메시지에 붙여 넣을 신청서. 이메일이 있으면 채워서 준다. */
export function apiRequestTemplate(email?: string): string {
  return [
    "세모로고 API 키 신청합니다 ☕",
    `회신 메일: ${email || "(받으실 메일 주소)"}`,
    "어디에 쓰실 건가요: ",
  ].join("\n");
}

/** API 로 열리는 것들 — 한 곳에서만 정의한다 */
export const API_PERKS = [
  { emoji: "🔎", title: "브랜드 검색", desc: "6,825개를 이름·초성으로 찾아요" },
  { emoji: "🖼", title: "SVG · PNG 바로 사용", desc: "다운로드 없이 URL 로 붙여요" },
  { emoji: "🧩", title: "로고 변형", desc: "심볼만, 워드마크만 골라 써요" },
] as const;

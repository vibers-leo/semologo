"use client";

/**
 * 브랜드 히트 전송. 순위(인기순)의 원천이다.
 *
 * ⚠️ 사용자 흐름을 절대 막지 않는다 — 실패해도 조용히 넘어간다.
 *    다운로드 버튼이 집계 때문에 느려지면 본말전도다.
 * 이탈 시점(dwell)에는 fetch 가 취소되므로 sendBeacon 을 쓴다.
 */

export type HitType = "download" | "ad" | "view" | "search" | "dwell";

/** 세션 구분자 — 같은 사람이 새로고침으로 점수를 올리는 걸 막는다 */
function sid(): string {
  try {
    const k = "semologo_sid";
    let v = sessionStorage.getItem(k);
    if (!v) { v = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem(k, v); }
    return v;
  } catch { return ""; }
}

export function sendHit(id: string, type: HitType) {
  if (!id) return;
  const body = JSON.stringify({ id, type, sid: sid() });
  try {
    // 이탈 중에도 확실히 나가야 하는 건 beacon 으로
    if (type === "dwell" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/hit/", new Blob([body], { type: "application/json" }));
      return;
    }
    fetch("/api/hit/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch { /* 집계 실패가 화면을 막지 않는다 */ }
}

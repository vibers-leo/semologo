"use client";

type EventParams = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    gtag?: (command: "event", eventName: string, params?: EventParams) => void;
  }
}

/** GA가 차단됐거나 아직 로드되지 않은 환경에서도 사용자 흐름을 멈추지 않는다. */
export function trackEvent(eventName: string, params: EventParams = {}) {
  window.gtag?.("event", eventName, params);
}

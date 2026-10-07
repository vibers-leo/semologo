"use client";

type EventParams = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    gtag?: (command: "event", eventName: string, params?: EventParams) => void;
  }
}

/** GA가 차단됐거나 아직 로드되지 않은 환경에서도 사용자 흐름을 멈추지 않는다. */
export function trackEvent(eventName: string, params: EventParams = {}) {
  try { window.gtag?.("event", eventName, params); } catch { /* Optional GA must not block first-party tracking. */ }
  if (!['page_view', 'search_submitted', 'search_no_result', 'brand_opened', 'logo_downloaded'].includes(eventName) || location.pathname.startsWith('/admin')) return;
  try {
    const key = `semologo.visit.${new Date().toISOString().slice(0, 10)}`;
    let sessionId = sessionStorage.getItem(key);
    if (!sessionId) { sessionId = crypto.randomUUID(); sessionStorage.setItem(key, sessionId); }
    const attributionKey = `${key}.attribution`;
    let attribution = sessionStorage.getItem(attributionKey);
    if (!attribution) {
      const query = new URLSearchParams(location.search);
      const values: Record<string, string> = { landing_path: location.pathname, referrer: document.referrer };
      for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) values[k] = query.get(k)?.slice(0, 80) || '';
      attribution = JSON.stringify(values); sessionStorage.setItem(attributionKey, attribution);
    }
    void fetch('/api/traffic', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: sessionId, event: eventName, params, path: location.pathname, attribution: JSON.parse(attribution) }), keepalive: true }).catch(() => {});
  } catch { /* Analytics must never block browsing, including disabled storage. */ }
}

"use client";
import { useEffect } from "react";
const API = `${(process.env.NEXT_PUBLIC_FANEASY_API_BASE || "https://www.faneasy.kr").replace(/\/$/, "")}/api/track-view`;
// Only campaign parameters are retained: search terms, tokens and arbitrary query values are excluded.
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
let pending: Promise<void> | undefined;
export default function ViewTracker() {
  useEffect(() => {
    if (!/^(www\.)?semologo\.com$/.test(location.hostname)) return;
    let cleanup = () => {};
    try {
      const day = new Date().toISOString().slice(0, 10);
      const key = `viewed_semologo_${day}`;
      const sidKey = `semologo.visit.${day}`;
      let sessionId = sessionStorage.getItem(sidKey);
      if (!sessionId) { sessionId = crypto.randomUUID(); sessionStorage.setItem(sidKey, sessionId); }
      const qs = new URLSearchParams();
      const params = new URLSearchParams(location.search);
      UTM_KEYS.forEach(k => {const value = params.get(k); if(value) qs.set(k, value.slice(0, 80));});
      const landingPath = location.pathname + (qs.size ? `?${qs}` : "");
      let referrer = "";
      try {if(document.referrer) {const url = new URL(document.referrer); referrer = url.origin + url.pathname;}} catch {}
      if (!sessionStorage.getItem(key) && !pending) {
        pending = fetch(API, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({siteId: "semologo", sessionId, landingPath, referrer}), keepalive: true})
          .then(res => {if(res.ok) sessionStorage.setItem(key, "1");})
          .catch(() => {}).finally(() => {pending = undefined;});
      }
      const baseline = Number(sessionStorage.getItem(`semologo.dwell.${day}`) || 0);
      let visibleAt = document.visibilityState === "visible" ? Date.now() : 0;
      let elapsed = baseline;
      const report = () => {
        if(visibleAt) {elapsed += Date.now() - visibleAt; visibleAt = 0;}
        sessionStorage.setItem(`semologo.dwell.${day}`, String(elapsed));
        if(sessionStorage.getItem(key) && new Date().toISOString().slice(0, 10) === day)
          void fetch(API, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({siteId: "semologo", sessionId, dwellMs: elapsed}), keepalive: true}).catch(() => {});
      };
      const visibility = () => {if(document.visibilityState === "hidden") report(); else visibleAt = Date.now();};
      const safeReport = () => {try {report();} catch {}};
      document.addEventListener("visibilitychange", visibility); window.addEventListener("pagehide", safeReport);
      cleanup = () => {document.removeEventListener("visibilitychange", visibility); window.removeEventListener("pagehide", safeReport);};
    } catch { /* Analytics must never prevent logo browsing. */ }
    return cleanup;
  }, []);
  return null;
}

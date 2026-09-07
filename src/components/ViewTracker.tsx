"use client";

import { useEffect } from "react";

/**
 * 팬이지 어드민 "누적 방문" 집계 비콘.
 *
 * 세모로고는 NCP 독립 배포라 팬이지의 /api/track-view 를 절대경로로 부른다
 * (faneasy/apps/bizon/components/view-tracker.tsx 와 같은 패턴, 2026-09-07 편입).
 * 같은 세션·같은 날짜에는 한 번만 센다. 집계 실패가 페이지에 영향을 주면 안 된다.
 */
const API_BASE = (process.env.NEXT_PUBLIC_FANEASY_API_BASE || "https://www.faneasy.kr").replace(/\/$/, "");
const SITE_ID = "semologo";

export default function ViewTracker() {
  useEffect(() => {
    try {
      const key = `viewed_${SITE_ID}_${new Date().toISOString().slice(0, 10)}`;
      if (sessionStorage.getItem(key)) return;
      fetch(`${API_BASE}/api/track-view`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: SITE_ID,
          landingPath: location.pathname,
          referrer: document.referrer || null,
        }),
        keepalive: true,
      })
        .then(() => sessionStorage.setItem(key, "1"))
        .catch(() => {});
    } catch {
      /* sessionStorage 차단 환경 — 조용히 넘어간다 */
    }
  }, []);
  return null;
}

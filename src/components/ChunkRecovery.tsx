"use client";
import { useEffect } from "react";

/**
 * 배포 직후, 옛 HTML 을 캐시에서 받은 브라우저는 사라진 JS 청크를 요청해
 * ChunkLoadError 로 멈춘다. 화면에는 서버 렌더분만 남고 목록이 안 채워진다.
 * 2026-09-01 에 실제로 그렇게 홈이 60개에서 멈췄다.
 *
 * 캐시 헤더를 짧게 잡는 게 근본 대책이지만, **이미 열려 있는 탭은 못 구한다.**
 * 그 경우 한 번만 강제 새로고침해서 새 HTML 을 받게 한다.
 *
 * 무한 새로고침을 막으려고 sessionStorage 에 표시를 남긴다 — 한 세션에 한 번뿐이다.
 */
const KEY = "semologo:chunk-reload";

export default function ChunkRecovery() {
  useEffect(() => {
    const isChunkError = (m: unknown) =>
      typeof m === "string" &&
      /ChunkLoadError|Loading chunk \d+ failed|Failed to load chunk/i.test(m);

    const recover = () => {
      try {
        if (sessionStorage.getItem(KEY)) return;   // 이미 한 번 시도했다
        sessionStorage.setItem(KEY, "1");
      } catch {
        return;   // 스토리지가 막힌 환경이면 아무것도 하지 않는다
      }
      location.reload();
    };

    const onError = (e: ErrorEvent) => {
      if (isChunkError(e.message) || isChunkError(String(e.error?.name))) recover();
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      if (isChunkError(r?.message) || isChunkError(r?.name)) recover();
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}

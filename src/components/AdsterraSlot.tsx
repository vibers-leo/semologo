"use client";

import { useEffect, useRef, useState } from "react";

type Format = "wide" | "compact";
const WIDE_KEY = process.env.NEXT_PUBLIC_ADSTERRA_728_KEY || "";
const COMPACT_KEY = process.env.NEXT_PUBLIC_ADSTERRA_320_KEY || "";

// These two snippets come directly from semologo.com's Adsterra publisher dashboard.
// Do not edit dimensions, keys, or source URLs independently of a fresh dashboard code.
const UNITS = {
  wide: {
    width: 728, height: 90,
    code: `<script>
  atOptions = {
    'key' : '${WIDE_KEY}',
    'format' : 'iframe',
    'height' : 90,
    'width' : 728,
    'params' : {}
  };
</script>
<script src="https://bellnewyork.org/22/${WIDE_KEY}"></script>`,
  },
  compact: {
    width: 320, height: 50,
    code: `<script>
  atOptions = {
    'key' : '${COMPACT_KEY}',
    'format' : 'iframe',
    'height' : 50,
    'width' : 320,
    'params' : {}
  };
</script>
<script src="https://bellnewyork.org/22/${COMPACT_KEY}"></script>`,
  },
} as const;

/** A single responsive placement. Ad requests are globally disabled in preview mode. */
export default function AdsterraSlot({ placement }: { placement: "wide" | "compact" }) {
  const host = useRef<HTMLDivElement>(null);
  const injected = useRef(false);
  const [format, setFormat] = useState<Format | null>(null);
  const preview = process.env.NEXT_PUBLIC_AD_PREVIEW_MODE === "1";
  const enabled = process.env.NEXT_PUBLIC_ADSTERRA_ENABLED === "1";
  const expectedFormat: Format = placement;

  useEffect(() => {
    const wideViewport = window.matchMedia("(min-width: 1200px)");
    const compactViewport = window.matchMedia("(min-width: 360px)");
    const applyViewport = () => setFormat(wideViewport.matches ? "wide" : compactViewport.matches ? "compact" : null);
    applyViewport();
    wideViewport.addEventListener("change", applyViewport);
    compactViewport.addEventListener("change", applyViewport);
    return () => {
      wideViewport.removeEventListener("change", applyViewport);
      compactViewport.removeEventListener("change", applyViewport);
    };
  }, []);

  useEffect(() => {
    if (!enabled || preview || !format || format !== expectedFormat || !host.current) return;
    const unit = UNITS[format];
    if (!unit.code.includes("/22/") || unit.code.includes("/22/</script>")) return;
    // Execute the original dashboard snippet unchanged, preserving its two script tags.
    const template = document.createElement("template");
    template.innerHTML = unit.code;
    if (!template.content.querySelector<HTMLScriptElement>("script[src]") || injected.current) return;
    injected.current = true;
    template.content.querySelectorAll("script").forEach((original) => {
      const script = document.createElement("script");
      for (const attribute of Array.from(original.attributes)) script.setAttribute(attribute.name, attribute.value);
      script.textContent = original.textContent || "";
      host.current!.appendChild(script);
    });
    // Adsterra permits repeating the same static banner code; each placement gets its own script node.
    return () => {
      host.current?.replaceChildren();
      injected.current = false;
    };
  }, [enabled, preview, format, expectedFormat]);

  if (!preview && !enabled) return null;
  const placementClass = placement === "compact" ? "adsterra-slot--compact-only" : "adsterra-slot--wide-only";
  if (!format) return <div className={`adsterra-slot adsterra-slot--initial ${placementClass}`} aria-label="광고 공간" />;
  if (format !== expectedFormat) return null;
  const unit = UNITS[format];
  return (
    <div className={`adsterra-slot adsterra-slot--${format} ${placementClass}`} aria-label="광고">
      <span className="adsterra-label">광고</span>
      {preview && <div className="adsterra-preview" style={{ width: unit.width, height: unit.height }}>
        <span>Adsterra 미리보기</span><small>{unit.width} × {unit.height} · 실제 광고 요청 없음</small>
      </div>}
      {enabled && !preview && <div ref={host} className="adsterra-unit" style={{ width: unit.width, height: unit.height }} />}
    </div>
  );
}

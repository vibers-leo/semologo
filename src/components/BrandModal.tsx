"use client";

import { useEffect, useRef } from "react";
import { Brand } from "@/lib/brands";
import BrandInner from "./BrandInner";

interface Props {
  brand: Brand;
  onClose: () => void;
  allBrands?: Brand[];
  onSelectBrand?: (brand: Brand) => void;
}

export default function BrandModal({ brand, onClose, allBrands = [], onSelectBrand }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLButtonElement>("[data-brand-close]")?.focus({ preventScroll: true });
    return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={brand.name_ko || brand.name_en}
      className="brand-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-5"
      onKeyDown={event => {
        if (event.key !== "Tab") return;
        const controls = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]') ?? [])].filter(el => el.getClientRects().length > 0);
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}
      onClick={onClose}
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
    >
      <BrandInner
        brand={brand}
        onClose={onClose}
        allBrands={allBrands}
        onSelectBrand={onSelectBrand}
        isPage={false}
      />
    </div>
  );
}

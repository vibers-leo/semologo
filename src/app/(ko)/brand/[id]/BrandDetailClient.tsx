"use client";

import { useLocale } from "@/lib/locale-context";
import type { Brand } from "@/lib/brands";
import BrandInner from "@/components/BrandInner";

interface Props {
  brand: Brand;
  relatedBrands: Brand[];
}

export default function BrandDetailClient({ brand, relatedBrands }: Props) {
  const {path} = useLocale();
  return (
    <div style={{ padding: "24px 16px", minHeight: "100vh", background: "var(--bg)" }}>
      <BrandInner
        brand={brand}
        allBrands={relatedBrands}
        isPage={true}
        onClose={() => { window.location.href = path("/"); }}
      />
    </div>
  );
}

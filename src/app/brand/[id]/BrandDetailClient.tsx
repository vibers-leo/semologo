"use client";

import type { Brand } from "@/lib/brands";
import BrandInner from "@/components/BrandInner";

interface Props {
  brand: Brand;
  relatedBrands: Brand[];
}

export default function BrandDetailClient({ brand, relatedBrands }: Props) {
  return (
    <div style={{ padding: "24px 16px", minHeight: "100vh", background: "var(--bg)" }}>
      <BrandInner
        brand={brand}
        allBrands={relatedBrands}
        isPage={true}
        onClose={() => { window.location.href = "/"; }}
      />
    </div>
  );
}

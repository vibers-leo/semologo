"use client";

import { Brand } from "@/lib/brands";
import BrandInner from "./BrandInner";

interface Props {
  brand: Brand;
  onClose: () => void;
  allBrands?: Brand[];
  onSelectBrand?: (brand: Brand) => void;
}

export default function BrandModal({ brand, onClose, allBrands = [], onSelectBrand }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-5"
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

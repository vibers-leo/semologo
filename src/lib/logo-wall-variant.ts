import type { Brand, VariantRecord } from './brands';
import { CDN, VERSION } from './cdn';
import type { CardBackground } from './logo-wall-layout';
export type WallLogo = Brand & { scale?: number; variantKey?: string; variantLabel?: string; cardBackground?: CardBackground };
export const wallLogoKey = (brand: WallLogo) => `${brand.id}:${brand.variantKey || ''}`;
const safeFile = (file: string | undefined, ext: string) => Boolean(file && !file.includes('..') && new RegExp(`^(?:[\\w-]+/)*[\\w.-]+\\.${ext}$`).test(file));
/** Select only a manifest-owned PNG. Never accept arbitrary client URLs. */
export function wallVariant(brand: Brand, variant: VariantRecord): WallLogo | null {
  if (!safeFile(variant.files?.png, 'png') || (variant.files.svg && !safeFile(variant.files.svg, 'svg'))) return null;
  if (brand.rejected_asset_files?.includes(variant.files.png!)) return null;
  const light = /^(white|reversed|negative)$/i.test(variant.color);
  return { ...brand, variantKey: variant.key, variantLabel: variant.label, logo_png: variant.files.png!,
    preview_png: `${CDN}/${brand.id}/${variant.files.png}?v=${VERSION}`, logo_svg: variant.files.svg || false,
    has_png: true, has_svg: Boolean(variant.files.svg), light, light_logo: light, dark_variant: light ? 'white' : false };
}

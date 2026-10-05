import type { Brand } from './brands';
import { applyQualityReview } from './logo-quality-review';
/** Migrated CMS records keep asset flags inside metadata, unlike catalog Brands. */
export function cmsBrand(id: string, payload: Record<string, unknown>): Brand {
  const metadata = payload.metadata && typeof payload.metadata === 'object' ? payload.metadata as Record<string, unknown> : {};
  const brand = { ...metadata, ...payload, id } as unknown as Brand;
  for (const field of ['logo_png', 'logo_svg', 'preview_png', 'has_png', 'has_svg', 'light', 'light_logo', 'dark_variant'] as const) {
    if (payload[field] == null && metadata[field] != null) Object.assign(brand, { [field]: metadata[field] });
  }
  return applyQualityReview(brand);
}

/** Restore missing fields in old wall snapshots without changing their display names. */
export function logoWallAsset(id: string, payload: Record<string, unknown>, snapshot: Record<string, unknown>): Brand {
  const current = cmsBrand(id, payload);
  return applyQualityReview({ ...current, ...snapshot, id,
    name_ko: typeof snapshot.name === 'string' ? snapshot.name : current.name_ko,
    logo_png: (snapshot.logo_png ?? current.logo_png) as Brand['logo_png'],
    logo_svg: (snapshot.logo_svg ?? current.logo_svg) as Brand['logo_svg'],
    has_png: (snapshot.has_png ?? current.has_png) as Brand['has_png'],
    light: current.light || current.light_logo || current.dark_variant === 'white' ? true : (current.light ?? snapshot.light as Brand['light']),
    preview_png: current.preview_png ?? snapshot.preview_png as Brand['preview_png'],
  });
}

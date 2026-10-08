import { applyPresentation } from './logo-presentation';
import { applyReviewedAssets } from './reviewed-logo-assets';
import records from './logo-quality-review.json';
import type { Brand } from './brands';
import { CDN, VERSION } from './cdn';
export const QUALITY_REVIEWS: Record<string, { status: string; reason: string; reviewed_at: string; down_at_review: number; replacement_id?: string; preview_file?: string; light?: boolean }> = records;
export function applyQualityReview(brand: Brand): Brand {
  brand = applyReviewedAssets(brand);
  const review = QUALITY_REVIEWS[brand.id];
  if (!review) return applyPresentation(brand);
  return applyPresentation({ ...brand,
    ...(review.status === 'quarantined' || review.status === 'merged' ? { hidden: true, hidden_reason: review.reason } : {}),
    ...(review.replacement_id ? { variant_of: review.replacement_id } : {}),
    ...(review.preview_file ? { preview_png: `${CDN}/${brand.id}/${review.preview_file}?v=${VERSION}`, light: review.light ?? brand.light } : {}),
  });
}

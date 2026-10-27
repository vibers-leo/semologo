import { applyPresentation, validPresentation } from './logo-presentation';
import { applyReviewedAssets } from './reviewed-logo-assets';
import records from './logo-quality-review.json';
import countryCategories from './reviewed-country-categories-20261010.json';
const reviewedCategories: Record<string,string> = countryCategories;
import type { Brand } from './brands';
import { CDN, VERSION } from './cdn';
export const QUALITY_REVIEWS: Record<string, { status: string; reason: string; reviewed_at: string; down_at_review: number; replacement_id?: string; preview_file?: string; light?: boolean }> = records;
export function applyQualityReview(brand: Brand): Brand {
  const savedPresentation = brand.presentation;
  const rejectedFiles = brand.rejected_asset_files;
  brand = applyReviewedAssets(brand);
  // A bundled review must not resurrect files rejected by a later CMS review.
  if (rejectedFiles?.length) brand = { ...brand,
    rejected_asset_files: [...new Set([...(brand.rejected_asset_files ?? []), ...rejectedFiles])],
  };
  // Explicit administrator choices take precedence over bundled review defaults.
  if (validPresentation(savedPresentation)) brand = { ...brand, presentation: savedPresentation };
  if (reviewedCategories[brand.id]) brand = { ...brand, category: reviewedCategories[brand.id] };
  const review = QUALITY_REVIEWS[brand.id];
  if (!review) return applyPresentation(brand);
  return applyPresentation({ ...brand,
    ...(review.status === 'quarantined' || review.status === 'merged' ? { hidden: true, hidden_reason: review.reason } : {}),
    ...(review.replacement_id ? { variant_of: review.replacement_id } : {}),
    ...(review.preview_file ? { preview_png: `${CDN}/${brand.id}/${review.preview_file}?v=${VERSION}`, light: review.light ?? brand.light } : {}),
  });
}

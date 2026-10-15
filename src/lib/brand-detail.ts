import 'server-only';
import { cache } from 'react';
import { fetchBrand as fetchCatalogBrand, type Brand } from './brands';
import { trafficDb } from './traffic-db';
import { cmsBrand } from './cms-brand';
import { SUBMITTED_BRANDS } from './submissions';
import { SIMPLE_ICONS_BRANDS } from './simple-icons-submissions';
import { STREAMING_SUBMISSIONS } from './streaming-submissions';
import { INDEX_REVIEW_BRANDS } from './index-candidate-review-submissions';
import { applyReviewedAssets } from './reviewed-logo-assets';

const registered = new Map([...SUBMITTED_BRANDS, ...SIMPLE_ICONS_BRANDS,
  ...STREAMING_SUBMISSIONS, ...INDEX_REVIEW_BRANDS].map(brand => [brand.id, brand]));

/** Read one CMS row instead of loading the entire catalog for missing per-brand JSON. */
export const fetchBrand = cache(async (id: string): Promise<Brand | null> => {
  if (process.env.DB_VIBERS_MAIN_URL) {
    try {
      const result = await trafficDb().query(
        "SELECT payload,status FROM semologo.logo_posts WHERE id=$1", [id],
      );
      const row = result.rows[0];
      if (row) return row.status === 'published' ? cmsBrand(id, row.payload) : null;
    } catch {
      // Keep the existing catalog available during a temporary CMS outage.
    }
  }
  const local = registered.get(id);
  return local ? applyReviewedAssets(local) : fetchCatalogBrand(id);
});

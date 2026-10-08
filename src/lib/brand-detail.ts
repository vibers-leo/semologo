import 'server-only';
import { cache } from 'react';
import { fetchBrand as fetchCatalogBrand, type Brand } from './brands';
import { trafficDb } from './traffic-db';
import { cmsBrand } from './cms-brand';

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
  return fetchCatalogBrand(id);
});

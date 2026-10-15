import 'server-only';
import { fetchBrandsSlim, isIndexableBrand, type Brand } from './brands';
import { cmsBrand } from './cms-brand';
import { trafficDb } from './traffic-db';

/** CMS-only publications belong in the sitemap before the large CDN catalog is rebuilt. */
export async function fetchSitemapBrands(): Promise<Brand[]> {
  const catalog = (await fetchBrandsSlim()).filter(isIndexableBrand);
  if (!process.env.DB_VIBERS_MAIN_URL) return catalog;
  try {
    const result = await trafficDb().query(
      "SELECT id,payload FROM semologo.logo_posts WHERE status='published' AND payload ? 'logo_published_at'",
    );
    const known = new Set(catalog.map(brand => brand.id));
    const supplement = result.rows
      .map(row => cmsBrand(row.id, row.payload))
      .filter(brand => !known.has(brand.id) && isIndexableBrand(brand));
    return [...catalog, ...supplement];
  } catch {
    return catalog;
  }
}

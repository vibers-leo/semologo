import { fetchVariants, type VariantManifest } from './brands';
import type { PoolClient } from 'pg';
/** The current CMS version wins over a build/CDN snapshot, including freshly published assets. */
export async function currentWallManifest(id:string,db:{query:PoolClient['query']}):Promise<VariantManifest|null>{
  const r=await db.query("SELECT asset_manifest->'variants' manifest FROM semologo.logo_versions WHERE brand_id=$1 AND is_current LIMIT 1",[id]);
  const m=r.rows[0]?.manifest;
  return m&&Array.isArray(m.variants)?m:fetchVariants(id);
}

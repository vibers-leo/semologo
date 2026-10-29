import { fetchVariants } from '@/lib/brands';
import { trafficDb } from '@/lib/traffic-db';

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!id || id.length > 200 || !/^[\p{L}\p{N}._-]+$/u.test(id)) {
    return Response.json({ error: 'invalid_brand' }, { status: 400 });
  }
  // Published CMS versions are authoritative when a duplicate collection adds
  // files or compositions after the build's reviewed snapshot was generated.
  // An empty list is also authoritative: quarantined artwork must not return
  // through a stale bundled/CDN snapshot. Missing manifests still use fallback.
  let manifest = null;
  try {
    const rows = await trafficDb().query(`SELECT asset_manifest->'variants' manifest
      FROM semologo.logo_versions WHERE brand_id=$1 AND is_current LIMIT 1`, [id]);
    const current = rows.rows[0]?.manifest;
    if (current && Array.isArray(current.variants)) manifest = current;
  } catch { /* Keep the archive available during a database interruption. */ }
  if (!manifest) manifest = await fetchVariants(id);
  return Response.json(manifest, { headers: {
    'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=60',
  } });
}

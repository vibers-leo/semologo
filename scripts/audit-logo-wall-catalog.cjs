// Read-only aggregate audit. Missing flags are candidates, not proof of a broken image.
const { Pool } = require('pg');
async function main() {
  if (!process.env.DB_VIBERS_MAIN_URL) throw new Error('database unavailable');
  const pool = new Pool({ connectionString: process.env.DB_VIBERS_MAIN_URL, max: 1, connectionTimeoutMillis: 5000 });
  const db = await pool.connect();
  try {
    await db.query('BEGIN READ ONLY');
    await db.query("SET LOCAL statement_timeout='30s'");
    const stats = await db.query(`SELECT count(*)::int AS published_records,
      count(*) FILTER(WHERE coalesce(payload->>'name_ko',payload->>'name_en','')='')::int AS missing_name,
      count(*) FILTER(WHERE coalesce(payload->>'logo_png','') NOT IN ('','false') OR coalesce(payload->>'has_png',payload#>>'{metadata,has_png}')='true')::int AS png_declared,
      count(*) FILTER(WHERE coalesce(payload->>'logo_svg','') NOT IN ('','false') OR coalesce(payload->>'has_svg',payload#>>'{metadata,has_svg}')='true')::int AS svg_declared,
      count(*) FILTER(WHERE coalesce(payload->>'logo_png','') IN ('','false') AND coalesce(payload->>'has_png',payload#>>'{metadata,has_png}','false')<>'true'
        AND coalesce(payload->>'logo_svg','') IN ('','false') AND coalesce(payload->>'has_svg',payload#>>'{metadata,has_svg}','false')<>'true')::int AS no_asset_declared
      FROM semologo.logo_posts WHERE status='published'`);
    const reviews = await db.query('SELECT status,count(*)::int AS count FROM semologo.logo_quality_reviews GROUP BY status ORDER BY status');
    await db.query('COMMIT');
    console.log(JSON.stringify({ checked_at: new Date().toISOString(), scope: 'all published metadata; no asset byte downloads', ...stats.rows[0], quality_reviews: reviews.rows }, null, 2));
  } finally { db.release(); await pool.end(); }
}
main().catch(() => { console.error('catalog audit failed'); process.exitCode = 1; });

const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DB_VIBERS_MAIN_URL, max: 1 });
async function resolveOfficial(name) {
  const search = new URL('https://www.wikidata.org/w/api.php');
  search.search = new URLSearchParams({ action: 'wbsearchentities', search: name, language: /[가-힣]/.test(name) ? 'ko' : 'en', format: 'json', limit: '5' }).toString();
  const found = await fetch(search, { headers: { 'User-Agent': 'SemoLogo-request-source-review/1.0 (https://semologo.com/)' }, signal: AbortSignal.timeout(5000) }).then(r => r.json());
  const exact = (found.search || []).filter(item => item.match?.text?.toLocaleLowerCase() === name.toLocaleLowerCase());
  if (exact.length !== 1 || !/^Q\d+$/.test(exact[0].id)) return null;
  const entity = new URL('https://www.wikidata.org/w/api.php');
  entity.search = new URLSearchParams({ action: 'wbgetentities', ids: exact[0].id, props: 'claims', format: 'json' }).toString();
  const details = await fetch(entity, { headers: { 'User-Agent': 'SemoLogo-request-source-review/1.0 (https://semologo.com/)' }, signal: AbortSignal.timeout(5000) }).then(r => r.json());
  const values = (details.entities?.[exact[0].id]?.claims?.P856 || []).map(item => item.mainsnak?.datavalue?.value).filter(Boolean);
  if (values.length !== 1) return null;
  const url = new URL(values[0]);
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password || url.port) return null;
  url.protocol = 'https:';
  return url.origin;
}
(async () => {
  const unresolved = await pool.query(`SELECT id,requested_name FROM semologo.logo_request_queue
    WHERE status='pending' AND official_url IS NULL AND (source_checked_at IS NULL OR source_checked_at<now()-interval '1 day')
    ORDER BY priority DESC,request_count DESC,created_at ASC LIMIT 5`);
  for (const row of unresolved.rows) {
    let official = null;
    try { official = await resolveOfficial(row.requested_name); } catch { /* Network failures are retried tomorrow. */ }
    await pool.query(`UPDATE semologo.logo_request_queue SET official_url=COALESCE(official_url,$2),source_checked_at=now(),updated_at=now()
      WHERE id=$1 AND status='pending'`, [row.id,official]);
  }
  const pending = await pool.query(`SELECT id,official_url FROM semologo.logo_request_queue
    WHERE status='pending' AND official_url IS NOT NULL
    ORDER BY priority DESC,request_count DESC,created_at ASC LIMIT 12`);
  const active = await pool.query(`SELECT id,fleet_job_id FROM semologo.logo_request_queue
    WHERE status='discovering' AND fleet_job_id IS NOT NULL LIMIT 50`);
  process.stdout.write(JSON.stringify({ pending: pending.rows, active: active.rows }));
})().finally(() => pool.end()).catch(error => { console.error(error.code || error.name); process.exitCode = 1; });

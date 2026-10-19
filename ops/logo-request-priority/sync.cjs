const fs = require('node:fs');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DB_VIBERS_MAIN_URL, max: 1 });
(async () => {
  const updates = JSON.parse(fs.readFileSync(0, 'utf8'));
  for (const row of updates) {
    const status = ['succeeded','review_required','failed','cancelled'].includes(row.status) ? 'review_required' : 'discovering';
    await pool.query(`UPDATE semologo.logo_request_queue SET status=$2,fleet_job_id=$3,updated_at=now()
      WHERE id=$1 AND status IN ('pending','discovering')`, [row.id,status,row.jobId]);
  }
  const published = await pool.query(`UPDATE semologo.logo_request_queue q
    SET status='published',published_brand_id=p.id,updated_at=now()
    FROM semologo.logo_posts p
    WHERE q.status<>'published' AND p.status='published'
      AND (lower(p.payload->>'name_ko')=lower(q.requested_name)
        OR regexp_replace(lower(p.payload->>'name_ko'), '^(재단법인|사단법인|주식회사|\\(주\\))', '')=lower(q.requested_name)
        OR lower(p.payload->>'name_en')=lower(q.requested_name))
    RETURNING q.id`);
  console.log(JSON.stringify({ synced: updates.length, published: published.rowCount }));
})().finally(() => pool.end()).catch(error => { console.error(error.code || error.name); process.exitCode = 1; });

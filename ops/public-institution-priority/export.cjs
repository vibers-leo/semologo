// Read the live official roster; do not mistake catalog candidates for collection.
const {Pool} = require('pg');
const fs=require('node:fs');
const pool = new Pool({connectionString: process.env.DB_VIBERS_MAIN_URL, max: 1});
(async () => {
  const result = await pool.query(`WITH latest AS (
    SELECT DISTINCT ON(collection_id) * FROM semologo.collection_snapshots
    WHERE collection_id=ANY($1::text[]) ORDER BY collection_id,as_of DESC,id DESC
  ) SELECT s.collection_id,s.id snapshot_id,s.source_url,m.member_key,m.name,
      m.metadata->>'homepage' homepage
    FROM latest s JOIN semologo.collection_members m ON m.snapshot_id=s.id
    LEFT JOIN semologo.logo_posts p ON p.id=m.brand_id
    WHERE NOT coalesce(m.review_status='verified' AND m.metadata->>'png_verified'='true'
      AND p.status='published',false)
    ORDER BY CASE s.collection_id WHEN 'kr-public-enterprises' THEN 0
      WHEN 'kr-quasi-government' THEN 1 ELSE 2 END,m.name`,
    [['kr-public-enterprises','kr-quasi-government','kr-other-public-institutions']]);
  const input=fs.readFileSync(0,'utf8').trim();
  const quality=input?JSON.parse(input):{ready:[],unresolved:[]};
  process.stdout.write(JSON.stringify({checkedAt:new Date().toISOString(),
    members:[...quality.ready,...result.rows],qualityUnresolved:quality.unresolved}));
})().finally(() => pool.end()).catch(e => {console.error(e.code || e.name);process.exitCode=1;});

// Only the nine identities visually reviewed in this batch may update roster coverage.
const fs=require('node:fs');const{Pool}=require('pg');
const proof=JSON.parse(fs.readFileSync(0,'utf8')).rows;
const reviewed=new Set(['gongu-ci-1575','gongu-ci-1378','gongu-ci-1642','gongu-ci-1630',
 'gongu-ci-1625','gongu-ci-1583','gongu-ci-1578','gongu-ci-1574','korean-environmental-education-network']);
const pool=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});
(async()=>{const c=await pool.connect();const changed=[];try{
 await c.query('BEGIN');
 for(const r of proof.filter(r=>reviewed.has(r.id))){
  const q=await c.query(`WITH latest AS (
    SELECT DISTINCT ON(collection_id) id,collection_id FROM semologo.collection_snapshots
    WHERE collection_id=ANY($1::text[]) ORDER BY collection_id,as_of DESC,id DESC
   ) UPDATE semologo.collection_members m SET brand_id=$2,review_status='verified',
     metadata=m.metadata||$3::jsonb
   FROM latest s,semologo.logo_posts p
   WHERE m.snapshot_id=s.id AND p.id=$2 AND p.status='published'
    AND p.payload->>'asset_review_status' LIKE 'verified-%'
    AND p.payload->'presentation'->>'file'=$4 AND m.name=p.payload->>'name_ko'
    AND (m.brand_id IS NULL OR m.brand_id=$2) AND m.metadata->'candidates' ? p.id
   RETURNING s.collection_id,m.name,m.brand_id`,[
    ['kr-public-enterprises','kr-quasi-government','kr-other-public-institutions','kr-public-institutions'],
    r.id,JSON.stringify({brand_id:r.id,png_verified:true,identity_reviewed:true,
     public_catalog_verified:true,png_url:'https://logo.vibers.co.kr/_clients/'+r.id+'/'+r.file,
     asset_sha256:r.sha256,review_evidence:'2026-10-25 official source + PNG byte verification + manual contact-sheet identity review'}),r.file]);
  changed.push(...q.rows);
 }
 await c.query('COMMIT');console.log(JSON.stringify({membersUpdated:changed.length,rows:changed}));
}catch(e){await c.query('ROLLBACK');throw e}finally{c.release();}})().finally(()=>pool.end()).catch(e=>{console.error(e.message);process.exitCode=1});

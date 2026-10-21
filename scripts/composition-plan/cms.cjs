// Concatenate policy.cjs before this file; execute in the existing semologo container.
const {Pool}=require('pg');const fs=require('node:fs');const mode=process.argv[2],revision=process.argv[3];
const db=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1,connectionTimeoutMillis:5000,statement_timeout:20000});
const schema=`CREATE TABLE IF NOT EXISTS semologo.logo_composition_plan (
 brand_id text PRIMARY KEY REFERENCES semologo.logo_posts(id),name text NOT NULL,domain text,source_pages jsonb NOT NULL DEFAULT '[]',slots jsonb NOT NULL,priority integer NOT NULL DEFAULT 0,priority_reasons jsonb NOT NULL DEFAULT '[]',interactions integer NOT NULL DEFAULT 0,last_audited_at timestamptz NOT NULL DEFAULT now(),next_collect_at timestamptz NOT NULL DEFAULT now(),attempts integer NOT NULL DEFAULT 0,last_job_id uuid,last_job_status text,code_revision text NOT NULL);
 CREATE INDEX IF NOT EXISTS logo_composition_due ON semologo.logo_composition_plan(next_collect_at,priority DESC);
 CREATE TABLE IF NOT EXISTS semologo.logo_composition_decisions(brand_id text NOT NULL REFERENCES semologo.logo_posts(id),slot text NOT NULL CHECK(slot IN ('symbol','wordmark','horizontal','vertical')),state text NOT NULL CHECK(state IN ('not_offered')),evidence_url text NOT NULL,note text NOT NULL,reviewed_at timestamptz NOT NULL,PRIMARY KEY(brand_id,slot));
 CREATE TABLE IF NOT EXISTS semologo.logo_composition_attempts(job_id uuid PRIMARY KEY,brand_id text NOT NULL REFERENCES semologo.logo_posts(id),domain text NOT NULL,requested_slots jsonb NOT NULL,status text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),result_manifest_key text,code_revision text NOT NULL);
 CREATE INDEX IF NOT EXISTS logo_composition_attempt_brand ON semologo.logo_composition_attempts(brand_id,created_at DESC);`;
async function main(){
 if(mode==='init'){await db.query(schema);return {schema:'ready'}}
 if(mode==='refresh'){
 const c=await db.connect();try{await c.query('BEGIN');await c.query("SELECT pg_advisory_xact_lock(hashtextextended('semologo-composition-refresh',0))");
 const rows=(await c.query(`WITH demand AS (SELECT params->>'brand_id' id,count(*)::int n FROM semologo.traffic_events WHERE created_at>now()-interval '30 days' AND event IN ('brand_opened','logo_downloaded') GROUP BY 1)
 SELECT p.id,p.payload,v.asset_manifest->'variants' manifest,coalesce(d.n,0) interactions,
 EXISTS(SELECT 1 FROM semologo.logo_request_queue q WHERE q.published_brand_id=p.id) requested
 FROM semologo.logo_posts p LEFT JOIN semologo.logo_versions v ON v.brand_id=p.id AND v.is_current LEFT JOIN demand d ON d.id=p.id LEFT JOIN semologo.logo_composition_plan plan ON plan.brand_id=p.id
 WHERE p.status='published' AND coalesce(p.payload->>'hidden','false')<>'true' AND coalesce(p.payload->>'merged_into','')='' AND coalesce(p.payload->>'variant_of','')='' AND (plan.brand_id IS NULL OR plan.last_audited_at<now()-interval '6 hours')
 ORDER BY (p.id=ANY($1)) DESC,(coalesce(d.n,0)>=10) DESC,(p.payload->>'category'='공공·기관') DESC,coalesce(d.n,0) DESC,p.updated_at DESC,p.id LIMIT 200`,[SEEDS])).rows;
 const decisions=(await c.query('select * from semologo.logo_composition_decisions where brand_id=any($1)',[rows.map(r=>r.id)])).rows;
 for(const r of rows){const p=r.payload,slots=compositionCoverage(r.manifest,p.rejected_asset_files,decisions.filter(x=>x.brand_id===r.id)),rank=priorityFor(r),domain=domainOf(p),sources=[...new Set([p.official_source_page,p.ci_page_url,p.website].filter(x=>typeof x==='string'&&/^https?:\/\//.test(x)))];
 await c.query(`INSERT INTO semologo.logo_composition_plan(brand_id,name,domain,source_pages,slots,priority,priority_reasons,interactions,code_revision) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(brand_id) DO UPDATE SET name=excluded.name,domain=excluded.domain,source_pages=excluded.source_pages,slots=excluded.slots,priority=excluded.priority,priority_reasons=excluded.priority_reasons,interactions=excluded.interactions,last_audited_at=now(),code_revision=excluded.code_revision`,[r.id,p.name_ko||p.name_en||r.id,domain,JSON.stringify(sources),JSON.stringify(slots),rank.priority,JSON.stringify(rank.reasons),r.interactions,revision]);}
 await c.query('COMMIT');return {refreshed:rows.length}}catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}}
 if(mode==='pending'){
 const pending=(await db.query(`SELECT x.* FROM semologo.logo_composition_plan x JOIN semologo.logo_posts p ON p.id=x.brand_id WHERE x.domain IS NOT NULL AND x.next_collect_at<=now() AND p.status='published' AND coalesce(p.payload->>'merged_into','')='' AND coalesce(p.payload->>'hidden','false')<>'true'
 AND EXISTS(SELECT 1 FROM jsonb_each(x.slots) s WHERE s.value->>'state' IN ('collect_needed','unassessed','review_required'))
 AND NOT EXISTS(SELECT 1 FROM semologo.logo_composition_attempts a WHERE a.brand_id=x.brand_id AND a.status IN ('queued','running'))
 AND NOT EXISTS(SELECT 1 FROM semologo.logo_posts other WHERE other.id<>x.brand_id AND other.status='published' AND coalesce(other.payload->>'merged_into','')='' AND coalesce(other.payload->>'hidden','false')<>'true' AND lower(regexp_replace(coalesce(other.payload->>'domain',''),'^(www\\.)',''))=x.domain)
 ORDER BY x.priority DESC,x.next_collect_at,x.brand_id LIMIT 20`)).rows;
 const active=(await db.query("SELECT job_id,brand_id FROM semologo.logo_composition_attempts WHERE status IN ('queued','running') ORDER BY created_at DESC LIMIT 100")).rows;
 return {pending:pending.map(x=>({...x,requested_slots:Object.keys(x.slots).filter(k=>!['available_verified','not_offered'].includes(x.slots[k].state)),cycle:x.next_collect_at})),active};}
 if(mode==='sync'){
 throw Error('Sync uses its separate bundle');}
 if(mode==='report'){
 const summary=(await db.query("SELECT count(*)::int brands,count(*) FILTER(WHERE domain IS NULL)::int source_needed,count(*) FILTER(WHERE last_job_status='queued' OR last_job_status='running')::int collecting,max(last_audited_at) audited_at FROM semologo.logo_composition_plan")).rows[0];
 const states=(await db.query("SELECT key slot,value->>'state' state,count(*)::int n FROM semologo.logo_composition_plan CROSS JOIN LATERAL jsonb_each(slots) GROUP BY 1,2 ORDER BY 1,2")).rows;
 const top=(await db.query('SELECT brand_id,name,domain,slots,source_pages,priority,priority_reasons,attempts,last_job_id,last_job_status,next_collect_at FROM semologo.logo_composition_plan ORDER BY priority DESC,brand_id LIMIT 100')).rows;
 return {at:new Date().toISOString(),revision,summary,states,top};}
 throw Error('Unknown mode');
}
main().then(x=>console.log(JSON.stringify(x))).catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.end());

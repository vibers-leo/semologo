"""Publish audited memberships to existing CMS collection tables, without touching logos."""
from pathlib import Path
import subprocess,json,sys
root=Path(__file__).resolve().parents[1]
report=json.loads((Path(sys.argv[1]) if len(sys.argv)>1 else root/'marketing/assets/collection-coverage/coverage.json').read_text())
script="const report="+json.dumps(report,ensure_ascii=False)+";\n"+r'''
const {Pool}=require('pg');
(async()=>{const pool=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});const db=await pool.connect();try{
await db.query('BEGIN');await db.query("SET LOCAL statement_timeout='30s'");
for(const c of report.collections){
let sid=c.id+'-'+c.as_of;
await db.query(`INSERT INTO semologo.collections(id,name,scope) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET name=excluded.name,scope=excluded.scope`,[c.id,c.name,JSON.stringify({source_kind:c.source_kind,sector:c.sector,country:c.country,sport:c.sport,league:c.league,season:c.season,roster_status:c.roster_status,scope_note:c.scope_note,checked_at:report.checked_at,policy:'identity review + public catalog + decoded PNG; name candidates are not completion'})]);
const snap=await db.query(`INSERT INTO semologo.collection_snapshots(id,collection_id,as_of,source_url,source_revision,expected_count,count_unit) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(collection_id,as_of) DO UPDATE SET source_url=excluded.source_url,source_revision=excluded.source_revision,expected_count=excluded.expected_count RETURNING id`,[sid,c.id,c.as_of,c.source_url,c.source_revision,c.total,c.count_unit]);sid=snap.rows[0].id;
for(const m of c.members){
await db.query(`INSERT INTO semologo.collection_members(snapshot_id,member_key,name,brand_id,metadata,review_status) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(snapshot_id,member_key) DO UPDATE SET brand_id=excluded.brand_id,metadata=excluded.metadata,review_status=excluded.review_status WHERE semologo.collection_members.review_status<>'verified' OR excluded.review_status='verified'`,[sid,m.member_key,m.name,m.brand_id,JSON.stringify(m),m.png_verified?'verified':m.brand_id?'matched':'pending']);
}
}
await db.query('COMMIT');console.log('PASS persisted collection memberships: '+report.collections.map(c=>c.id+' '+c.verified+'/'+c.total).join(', '));
}catch(e){await db.query('ROLLBACK');console.error('collection transaction failed: '+e.code);process.exitCode=1;}finally{db.release();await pool.end()}})();
'''
subprocess.run(['ssh','vibers','docker exec -i semologo node -'],input=script,text=True,check=True)

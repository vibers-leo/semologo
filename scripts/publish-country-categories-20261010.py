"""Apply audited category changes with a full-payload concurrency guard and backup."""
from pathlib import Path
import json,subprocess,hashlib
root=Path(__file__).resolve().parents[1]
out=root/'marketing/assets/country-category-audit-20261010'
backup=json.loads((out/'cms-backup.json').read_text());release=json.loads((out/'release.json').read_text())
patches=release['patches'];assert set(patches)=={b['id'] for b in backup}
rows=[{'id':b['id'],'before':b['payload'],'category':patches[b['id']]['category']} for b in backup]
script='const rows='+json.dumps(rows,ensure_ascii=False)+';'+r'''
const {Pool}=require('pg');(async()=>{const pool=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});const db=await pool.connect();try{
await db.query('BEGIN');for(const row of rows){const current=await db.query('SELECT payload FROM semologo.logo_posts WHERE id=$1 FOR UPDATE',[row.id]);if(!current.rowCount)throw Error('Missing '+row.id);const p=current.rows[0].payload;
if(p.category===row.category)continue;
const result=await db.query("UPDATE semologo.logo_posts SET payload=jsonb_set(payload,'{category}',to_jsonb($2::text)),updated_at=now() WHERE id=$1 AND payload=$3::jsonb",[row.id,row.category,JSON.stringify(row.before)]);if(result.rowCount!==1)throw Error('Concurrent change '+row.id);}
await db.query('COMMIT');console.log('PASS category migration '+rows.length);
const result=await db.query("SELECT payload->>'category' category,count(*)::int count FROM semologo.logo_posts WHERE id=ANY($1::text[]) GROUP BY 1 ORDER BY 1",[rows.map(r=>r.id)]);console.log(JSON.stringify(result.rows));
}catch(e){await db.query('ROLLBACK');console.error(e.message);process.exitCode=1;}finally{db.release();await pool.end()}})();'''
subprocess.run(['ssh','vibers','docker exec -i semologo node -'],input=script,text=True,check=True)
(out/'published.json').write_text(json.dumps({'patched':len(rows),'backup_sha256':hashlib.sha256((out/'cms-backup.json').read_bytes()).hexdigest(),'status':'category-only guarded transaction'},indent=2)+'\n')

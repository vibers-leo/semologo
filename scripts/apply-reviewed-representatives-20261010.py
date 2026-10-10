"""Apply visually approved vote winners after CDN and manifest publication."""
import json
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[1]
folder = root / 'marketing/assets/representative-votes-20261010'
assert (folder / 'published.json').exists()
approved = json.loads((folder / 'approved.json').read_text())
verified = json.loads((folder / 'cdn-verification.json').read_text())
for row in approved:
    assert row['decision'] == 'visually-reviewed-approved'
    choice = row['presentation']
    assert choice['bg'] in ('light', 'dark')
    assert choice['file'].startswith('sources/representative-votes-20261010/')
    assert '..' not in choice['file'] and choice['file'].endswith('.png')
    assert any(v['key'] == f"_clients/{row['id']}/{choice['file']}" and v['sha256'] == row['sha256'] and v['cdn_verified'] for v in verified)
script = 'const rows=' + json.dumps(approved) + ';' + r'''
const {Pool}=require('pg');
(async()=>{const pool=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});const db=await pool.connect();
try{await db.query('BEGIN');for(const row of rows){
const q=await db.query('SELECT payload,status FROM semologo.logo_posts WHERE id=$1 FOR UPDATE',[row.id]);
if(q.rowCount!==1||q.rows[0].status!=='published'||q.rows[0].payload.hidden||q.rows[0].payload.merged_into)throw Error('Canonical required '+row.id);
await db.query('UPDATE semologo.logo_posts SET payload=payload||$2::jsonb,updated_at=now() WHERE id=$1',[row.id,JSON.stringify({presentation:row.presentation})]);
}await db.query('COMMIT');console.log('PASS reviewed representative choices applied',rows.length);
}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();await pool.end();}})().catch(e=>{console.error(e.message);process.exitCode=1});
'''
subprocess.run(['ssh', 'vibers', 'docker', 'exec', '-i', 'semologo', 'node', '-'], input=script, text=True, check=True)
(folder / 'representatives-applied.json').write_text(json.dumps({'status': 'applied', 'brands': [r['id'] for r in approved]}, indent=2) + '\n')

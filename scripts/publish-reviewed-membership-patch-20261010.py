"""Promote individually reviewed memberships without replacing a source roster."""
import argparse, hashlib, json, subprocess
from pathlib import Path
root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('patch', type=Path)
args = parser.parse_args()
patch = json.loads(args.patch.read_text())
for member in patch['members']:
    assert member['identity_reviewed'] and member['png_verified'] and member['public_catalog_verified']
    file = (root / member['file']).resolve()
    assert file.is_relative_to(root / 'marketing/assets')
    assert hashlib.sha256(file.read_bytes()).hexdigest() == member['asset_sha256']
script = 'const patch=' + json.dumps(patch, ensure_ascii=False) + ';' + r'''
const {Pool}=require('pg');(async()=>{const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});const d=await p.connect();try{
await d.query('BEGIN');
const snapshot=await d.query('SELECT expected_count,as_of::text FROM semologo.collection_snapshots WHERE id=$1 AND collection_id=$2 FOR UPDATE',[patch.snapshot_id,patch.collection_id]);
if(snapshot.rowCount!==1||snapshot.rows[0].expected_count!==patch.expected_count||snapshot.rows[0].as_of!==patch.as_of)throw Error('Source roster changed');
const before=await d.query("SELECT member_key,brand_id FROM semologo.collection_members WHERE snapshot_id=$1 AND review_status='verified'",[patch.snapshot_id]);
for(const m of patch.members){
const old=await d.query('SELECT name,brand_id,review_status FROM semologo.collection_members WHERE snapshot_id=$1 AND member_key=$2 FOR UPDATE',[patch.snapshot_id,m.member_key]);
if(old.rowCount!==1||old.rows[0].name!==m.name)throw Error('Roster identity mismatch');
if(old.rows[0].review_status==='verified'&&old.rows[0].brand_id!==m.brand_id)throw Error('Existing review conflict');
const brand=await d.query("SELECT payload FROM semologo.logo_posts WHERE id=$1 AND status='published'",[m.brand_id]);
if(brand.rowCount!==1||brand.rows[0].payload.hidden||brand.rows[0].payload.merged_into)throw Error('Published canonical required');
await d.query("UPDATE semologo.collection_members SET brand_id=$3,metadata=metadata||$4::jsonb,review_status='verified' WHERE snapshot_id=$1 AND member_key=$2",[patch.snapshot_id,m.member_key,m.brand_id,JSON.stringify(m)]);
}
const after=await d.query("SELECT member_key,brand_id FROM semologo.collection_members WHERE snapshot_id=$1 AND review_status='verified'",[patch.snapshot_id]);
if(before.rows.some(x=>!after.rows.some(y=>x.member_key===y.member_key&&x.brand_id===y.brand_id)))throw Error('Prior reviewed membership changed');
await d.query('COMMIT');console.log('PASS '+patch.collection_id+' verified '+before.rowCount+' → '+after.rowCount+'; source roster unchanged');
}catch(e){await d.query('ROLLBACK');throw e;}finally{d.release();await p.end();}})().catch(e=>{console.error(e.message);process.exitCode=1});
'''
subprocess.run(['ssh', 'vibers', 'docker exec -i semologo node -'], input=script, text=True, check=True)

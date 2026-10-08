"""Preserve duplicate rows and versions, linking them to a reviewed canonical content."""
import argparse,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SQL='''CREATE TABLE IF NOT EXISTS semologo.logo_content_merges (
 source_brand_id text PRIMARY KEY REFERENCES semologo.logo_posts(id),
 target_brand_id text NOT NULL REFERENCES semologo.logo_posts(id),
 reviewed_at timestamptz NOT NULL DEFAULT now(), reason text NOT NULL,
 evidence jsonb NOT NULL, CHECK(source_brand_id<>target_brand_id));
 CREATE INDEX IF NOT EXISTS logo_content_merges_target_idx ON semologo.logo_content_merges(target_brand_id);'''
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--schema-only',action='store_true');args=parser.parse_args()
 proofs=[] if args.schema_only else json.loads((ROOT/'marketing/assets/background-merge-review-20261008/merge-proofs.json').read_text())
 assert len({p['source'] for p in proofs})==len(proofs)
 assert not ({p['source'] for p in proofs}&{p['target'] for p in proofs}), 'Chained merges need separate review'
 script='const schema='+json.dumps(SQL)+';const pairs='+json.dumps(proofs)+';'+r'''const {Pool}=require('pg');(async()=>{const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});const d=await p.connect();try{await d.query('BEGIN');await d.query(schema);await d.query('LOCK TABLE semologo.logo_content_merges IN SHARE ROW EXCLUSIVE MODE');for(const pair of pairs){const {source,target}=pair;const old=await d.query('SELECT source_brand_id,target_brand_id FROM semologo.logo_content_merges WHERE source_brand_id=ANY($1) OR target_brand_id=$2',[[source,target],source]);if(old.rows.some(r=>r.source_brand_id!==source||r.target_brand_id!==target))throw Error('Conflicting or chained merge '+source);const rows=await d.query('SELECT id,payload FROM semologo.logo_posts WHERE id=ANY($1) FOR UPDATE',[[source,target]]);if(rows.rowCount!==2)throw Error('Missing identity');const from=rows.rows.find(r=>r.id===source).payload;if(from.merged_into!==target)throw Error('Asset release must be published first');await d.query('INSERT INTO semologo.logo_content_merges(source_brand_id,target_brand_id,reason,evidence) VALUES($1,$2,$3,$4) ON CONFLICT(source_brand_id) DO NOTHING',[source,target,'동일 로고 · 원본 및 주소 이력 보존',JSON.stringify(pair)]);}await d.query('COMMIT');console.log('PASS preserved content merges '+pairs.length);}catch(e){await d.query('ROLLBACK');throw e;}finally{d.release();await p.end();}})().catch(e=>{console.error(e.message);process.exitCode=1;});'''
 subprocess.run(['ssh','vibers','docker exec -i semologo node -'],input=script,text=True,check=True)
if __name__=='__main__':main()

"""Correct source attribution and verify all released official baseball variants in CMS."""
from pathlib import Path
import json,subprocess,sys
R=Path(__file__).resolve().parents[1];release=json.loads((Path(sys.argv[1]) if len(sys.argv)>1 else R/'src/lib/reviewed-baseball-20261012.json').read_text())
script='const release='+json.dumps(release,ensure_ascii=False)+';'+r'''
const {Pool}=require('pg');(async()=>{const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});const d=await p.connect();try{await d.query('BEGIN');let n=0;
for(const [id,m] of Object.entries(release.variants)){
 const r=await d.query('SELECT payload,status FROM semologo.logo_posts WHERE id=$1 FOR UPDATE',[id]);if(r.rowCount!==1||r.rows[0].status!=='published'||r.rows[0].payload.hidden)throw Error('Invalid identity '+id);
 const versions=await d.query('SELECT id,asset_manifest FROM semologo.logo_versions WHERE brand_id=$1 AND is_current FOR UPDATE',[id]);if(versions.rowCount!==1)throw Error('Missing current version '+id);
 for(const v of m.variants){if(!versions.rows[0].asset_manifest?.variants?.variants.some(x=>x.key===v.key&&JSON.stringify(x.files)===JSON.stringify(v.files))) {const x=versions.rows[0].asset_manifest?.variants?.variants.find(x=>x.key===v.key);if(!x||Object.keys(v.files).some(k=>x.files[k]!==v.files[k]))throw Error('Missing files '+id);}}
 const patch=release.patches[id],aliases=[...new Set([...(r.rows[0].payload.aliases||[]),...(patch.aliases||[])])];const update={aliases};if(patch.logo_published_at)update.logo_published_at=patch.logo_published_at;for(const field of ['name_ko','name_en','history_note'])if(typeof patch[field]==='string')update[field]=patch[field];
 await d.query('UPDATE semologo.logo_posts SET payload=payload||$2::jsonb,updated_at=now() WHERE id=$1',[id,JSON.stringify(update)]);
 if(patch.id===id)await d.query("UPDATE semologo.logo_versions SET label='공식 사이트 수록 로고 · 벡터 검수',source_note='공식 공개 자산을 수집하고 SVG 및 PNG를 검수함. 로고 도입 연도는 미확인.',source_url=$2,review_status='verified',verified_at=now() WHERE id=$1",[versions.rows[0].id,patch.official_source_page]);n++;
}await d.query('COMMIT');console.log('PASS official source attribution, preserved manifests and search aliases: '+n+' clubs');}catch(e){await d.query('ROLLBACK');throw e;}finally{d.release();await p.end();}})().catch(e=>{console.error(e.message);process.exitCode=1});'''
subprocess.run(['ssh','vibers','docker exec -i semologo node -'],input=script,text=True,check=True)

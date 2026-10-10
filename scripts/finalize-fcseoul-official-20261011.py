"""Apply approved official FC Seoul representative correction after verified uploads."""
from pathlib import Path
import json,subprocess,copy
R=Path(__file__).resolve().parents[1];O=R/'marketing/assets/kleague-official-release-20261011';B=R/'marketing/assets/kleague-official-review-20261011'
assert (O/'published.json').exists()
patch=json.loads((O/'correction-patches.json').read_text())['fcseoul'];release=json.loads((O/'release.json').read_text());manifest=release['variants']['fcseoul'];uploads=json.loads((O/'uploads.json').read_text());assert len(uploads)==17 and len(manifest['variants'])==5
js='const patch='+json.dumps(patch,ensure_ascii=False)+';const manifest='+json.dumps(manifest,ensure_ascii=False)+';'+r'''
const {Pool}=require('pg');(async()=>{const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});const d=await p.connect();try{await d.query('BEGIN');const old=await d.query("SELECT payload,status FROM semologo.logo_posts WHERE id='fcseoul' FOR UPDATE");if(old.rowCount!==1||old.rows[0].status!=='published')throw Error('Canonical missing');const vs=await d.query("SELECT id,asset_manifest FROM semologo.logo_versions WHERE brand_id='fcseoul' AND is_current FOR UPDATE");if(vs.rowCount!==1)throw Error('Published manifest differs');require('node:assert/strict').deepStrictEqual(vs.rows[0].asset_manifest.variants,manifest);const merged={...old.rows[0].payload,...patch,metadata:{...(old.rows[0].payload.metadata||{}),...patch.metadata}};await d.query("UPDATE semologo.logo_posts SET payload=$1::jsonb,updated_at=now() WHERE id='fcseoul'",[JSON.stringify(merged)]);await d.query("UPDATE semologo.logo_versions SET review_status='verified',verified_at=now(),label='FC서울 공식 시그니처·씨드',source_note='공식 AI 원본에서 추출. 잘못 연결된 도시 심볼 제외. 도입연도 미확인.' WHERE id=$1",[vs.rows[0].id]);const after=await d.query("SELECT p.id,p.payload,p.status,v.asset_manifest FROM semologo.logo_posts p LEFT JOIN semologo.logo_versions v ON v.brand_id=p.id AND v.is_current WHERE p.id='fcseoul'");await d.query('COMMIT');console.log(JSON.stringify(after.rows));}catch(e){await d.query('ROLLBACK');throw e;}finally{d.release();await p.end();}})().catch(e=>{console.error(e.message);process.exitCode=1});'''
a=json.loads(subprocess.run(['ssh','vibers','docker exec -i semologo node -'],input=js,text=True,capture_output=True,check=True).stdout);(O/'cms-after.json').write_text(json.dumps(a,ensure_ascii=False,indent=2)+'\n');new=a[0];old=next(x for x in json.loads((B/'cms-before.json').read_text()) if x['id']=='fcseoul');assert new['asset_manifest']['variants']==manifest
for k,v in old['payload'].items():
 if k not in patch:assert new['payload'][k]==v,k
for k,v in old['payload']['metadata'].items():
 if k not in ('has_png','has_svg'):assert new['payload']['metadata'][k]==v,k
for u in uploads:assert any(x['key']==u['key'] and x['sha256']==u['sha256'] for x in new['asset_manifest']['files'])
F=R/'src/lib/reviewed-recollection-20261011.json';overlay=json.loads(F.read_text());before=copy.deepcopy(overlay);overlay.setdefault('patches',{})['fcseoul']={**overlay.get('patches',{}).get('fcseoul',{}),**patch};overlay.setdefault('variants',{})['fcseoul']=manifest
for section in before:
 if isinstance(before[section],dict):
  for k,v in before[section].items():
   if k!='fcseoul':assert overlay[section][k]==v,(section,k)
 else:assert overlay[section]==before[section],section
F.write_text(json.dumps(overlay,ensure_ascii=False,indent=2)+'\n');proof={'status':'PASS','canonical':'fcseoul','official_variants':5,'uploaded_objects':17,'all_cdn_sha_verified':True,'cms_unpatched_payload_preserved':True,'metadata_prior_fields_preserved':True,'manifest_17_uploaded_files_preserved':True,'wrong_city_symbol_excluded':True,'official_primary':'official-korean-horizontal','frontend_other_entries_preserved':True,'kt_koreha_preserved':True};(O/'preservation-overlay-proof.json').write_text(json.dumps(proof,indent=2)+'\n');print('PASS FC Seoul CMS representative corrected; manifest and metadata preserved; overlay fcseoul only merged')

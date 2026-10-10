"""Apply full representative patches only after owned immutable assets pass CDN verification."""
from pathlib import Path
import argparse,json,subprocess,hashlib,io,urllib.parse
from PIL import Image
from lxml import etree as E
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--release-dir',required=True,type=Path);a=parser.parse_args();folder=a.release_dir.resolve();assert folder.is_relative_to(ROOT/'marketing/assets')
patchfile=folder/'correction-patches.json';patches=json.loads(patchfile.read_text()) if patchfile.exists() else json.loads((folder/'release.json').read_text())['patches'];uploads=json.loads((folder/'uploads.json').read_text());owned={u['key']:u for u in uploads};verified={x['key'] for x in json.loads((folder/'cdn-verification.json').read_text()) if x.get('cdn_verified')};assert patches
proof=[]
def verify(id,file,kind):
 assert isinstance(file,str);key=urllib.parse.unquote(file.split('logo.vibers.co.kr/',1)[1]) if file.startswith('https://logo.vibers.co.kr/') else '_clients/'+id+'/'+file
 assert key.startswith('_clients/'+id+'/') and key in owned and key in verified
 raw=subprocess.run(['curl','--fail','--silent','--show-error','--max-time','30','https://logo.vibers.co.kr/'+urllib.parse.quote(key,safe='/')],capture_output=True,check=True).stdout;assert hashlib.sha256(raw).hexdigest()==owned[key]['sha256']
 if kind=='png':im=Image.open(io.BytesIO(raw));im.load();assert im.format=='PNG'
 else:
  t=E.fromstring(raw);assert not t.xpath('//*[local-name()="image" or local-name()="script" or local-name()="foreignObject"]');assert not any(v.startswith(('http:','https:','javascript:')) for el in t.iter() for k,v in el.attrib.items() if k.endswith('href'))
 proof.append({'id':id,'key':key,'sha256':owned[key]['sha256'],'kind':kind})
for id,p in patches.items():
 for file in [p['logo_png'],p['preview_png'],p['presentation']['file']]:verify(id,file,'png')
 if p.get('has_svg') is True:
  assert any(isinstance(p.get(k),str) for k in ['logo_svg','svg_transparent']), 'Owned SVG path required'
  for f in [p.get('logo_svg'),p.get('svg_transparent')]:
   if isinstance(f,str):verify(id,f,'svg')
(folder/'fullpatch-cdn-proof.json').write_text(json.dumps(proof,indent=2)+'\n')
snapshot=json.loads((ROOT/'ops/reviews/quality-and-representative-20261010-latest.json').read_text());quality=next(x['entries'] for x in snapshot['data'] if x['collection']=='logo_quality');reviews={}
for row in quality:
 if row['id'] in patches:
  down=int(row['fields'].get('down',{}).get('integerValue','0'));reviews[row['id']]={'status':'repaired','reason':'검수된 원본 기반 PNG 복구 및 안전한 대표 이미지 지정','reviewed_at':'2026-10-10','down_at_review':down,'preview_file':patches[row['id']]['logo_png'],'light':patches[row['id']]['presentation'].get('bg')=='dark'}
data={'patches':patches,'reviews':reviews,'vote_snapshot':{r['id']:r['fields'] for r in quality if r['id'] in reviews}}
js='const data='+json.dumps(data,ensure_ascii=False)+';'+r'''
const {Pool}=require('pg');(async()=>{let p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});let d=await p.connect();try{await d.query('BEGIN');let before=[];for(const id of Object.keys(data.patches)){let b=await d.query('SELECT id,payload,status FROM semologo.logo_posts WHERE id=$1 FOR UPDATE',[id]);if(b.rowCount!==1||b.rows[0].status!=='published'||b.rows[0].payload.hidden||b.rows[0].payload.merged_into)throw Error('Canonical guard '+id);let q=await d.query('SELECT * FROM semologo.logo_quality_reviews WHERE brand_id=$1',[id]);before.push({brand:b.rows[0],quality:q.rows})}console.log(JSON.stringify(before));await d.query('ROLLBACK')}finally{d.release();await p.end()}})().catch(e=>{console.error(e.message);process.exitCode=1});'''
r=subprocess.run(['ssh','vibers','docker exec -i semologo node -'],input=js,text=True,capture_output=True,check=True);before=json.loads(r.stdout);backup=folder/'fullpatch-before.json';assert not backup.exists(),'Already applied or interrupted; inspect saved backup before replay';backup.write_text(json.dumps(before,ensure_ascii=False,indent=2)+'\n')
js='const data='+json.dumps(data,ensure_ascii=False)+';const before='+json.dumps(before,ensure_ascii=False)+';'+r'''
const {Pool}=require('pg');(async()=>{let p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});let d=await p.connect();try{await d.query('BEGIN');for(const [id,raw] of Object.entries(data.patches)){let b=await d.query('SELECT payload,status FROM semologo.logo_posts WHERE id=$1 FOR UPDATE',[id]);if(b.rowCount!==1||b.rows[0].status!=='published'||b.rows[0].payload.hidden||b.rows[0].payload.merged_into||JSON.stringify(b.rows[0].payload)!==JSON.stringify(before.find(x=>x.brand.id===id).brand.payload))throw Error('Concurrent canonical change '+id);let patch={...raw};if(patch.metadata)patch.metadata={...(b.rows[0].payload.metadata||{}),...patch.metadata};await d.query('UPDATE semologo.logo_posts SET payload=payload||$2::jsonb,updated_at=now() WHERE id=$1',[id,JSON.stringify(patch)]);let review=data.reviews[id];if(review)await d.query("INSERT INTO semologo.logo_quality_reviews(brand_id,status,review,vote_snapshot) VALUES($1,'repaired',$2::jsonb,$3::jsonb) ON CONFLICT(brand_id) DO UPDATE SET status='repaired',review=semologo.logo_quality_reviews.review||excluded.review,vote_snapshot=excluded.vote_snapshot,reviewed_at=now()",[id,JSON.stringify(review),JSON.stringify(data.vote_snapshot[id])]);}await d.query('COMMIT');let rows=await d.query("SELECT p.id,p.payload->'has_svg' AS has_svg,p.payload->>'logo_png' AS logo_png,p.payload->'presentation' AS presentation,q.status AS quality_status,q.review->'down_at_review' AS down_at_review FROM semologo.logo_posts p LEFT JOIN semologo.logo_quality_reviews q ON q.brand_id=p.id WHERE p.id=ANY($1)",[Object.keys(data.patches)]);console.log(JSON.stringify(rows.rows))}catch(e){await d.query('ROLLBACK');throw e}finally{d.release();await p.end()}})().catch(e=>{console.error(e.message);process.exitCode=1});'''
r=subprocess.run(['ssh','vibers','docker exec -i semologo node -'],input=js,text=True,capture_output=True,check=True);after=json.loads(r.stdout);assert len(after)==len(patches)
for row in after:
 assert row['logo_png']==patches[row['id']]['logo_png']
 if row['id'] in reviews:assert row['quality_status']=='repaired' and int(row['down_at_review'])==reviews[row['id']]['down_at_review']
(folder/'fullpatch-published.json').write_text(json.dumps({'status':'verified-fullpatch-applied','rows':after,'reviews':reviews},ensure_ascii=False,indent=2)+'\n');print('PASS',len(after),'representative patches;',len(reviews),'flagged reviews repaired')

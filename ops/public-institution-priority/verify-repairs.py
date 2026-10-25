"""Verify published replacement bytes and reconcile the current public manifest."""
import hashlib,io,json,runpy,xml.etree.ElementTree as E
from pathlib import Path
from PIL import Image
runner=runpy.run_path('/root/projects/semologo-publisher/run.py');runner['credentials']()
core=runpy.run_path('/root/projects/semologo-publisher/scripts/fleet-auto-core.py')
pub=runpy.run_path('/root/projects/semologo-publisher/scripts/fleet-auto-publish.py');s3=core['s3_client']()
sha=lambda b:hashlib.sha256(b).hexdigest()
query=r'''const{Pool}=require('pg');const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});(async()=>{try{const q=await p.query("SELECT p.id,p.payload,q.review FROM semologo.logo_quality_reviews q JOIN semologo.logo_posts p ON p.id=q.brand_id WHERE q.status='repaired' AND q.reviewed_at>='2026-10-25T10:00:00Z' AND p.payload->'presentation'->>'file' LIKE 'sources/official-transparent-20261025/%' ORDER BY q.reviewed_at");console.log(JSON.stringify(q.rows))}finally{await p.end()}})().catch(e=>{console.error(e.message);process.exit(1)})'''
rows=core['node']('semologo',query);verified=[]
for row in rows:
 ident=row['id'];p=row['payload'];file=p['presentation']['file'];raw=pub['get'](s3,'_clients/'+ident+'/'+file)
 assert raw and pub['png_surface'](raw)['transparent'],ident
 pub['cdn_check'](ident,file,raw)
 expected_bg='dark' if pub['light_artwork'](raw) else 'light'
 if p['presentation']['bg']!=expected_bg and not p['presentation'].get('version'):
  patch={'presentation':{**p['presentation'],'bg':expected_bg},'light':expected_bg=='dark','light_logo':expected_bg=='dark','dark_variant':'white' if expected_bg=='dark' else 'transparent'}
  fix='const x='+json.dumps({'id':ident,'file':file,'patch':patch})+';'+r'''const{Pool}=require('pg');const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});(async()=>{try{await p.query("UPDATE semologo.logo_posts SET payload=payload||$2::jsonb,updated_at=now() WHERE id=$1 AND payload->'presentation'->>'file'=$3 AND payload->'presentation'->>'version' IS NULL",[x.id,JSON.stringify(x.patch),x.file]);console.log('{}')}finally{await p.end()}})().catch(e=>{console.error(e.message);process.exit(1)})'''
  core['node']('semologo',fix);p.update(patch)
 image=Image.open(io.BytesIO(raw));image.load();assert image.format=='PNG'
 state=pub['current'](core['node'],ident);manifest=(state['asset_manifest'] or {}).get('variants')
 if manifest:
  body=(json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+'\n').encode()
  if pub['current'](core['node'],ident)['asset_manifest']==state['asset_manifest']:
   pub['put'](s3,'_clients/'+ident+'/variants.json',body,'application/json',sha,True)
 svg=p['presentation'].get('svgFile')
 if svg:
  data=pub['get'](s3,'_clients/'+ident+'/'+svg);tree=E.fromstring(data)
  assert not any(e.tag.split('}')[-1] in ('image','script','foreignObject') for e in tree.iter())
  pub['cdn_check'](ident,svg,data)
 verified.append({'id':ident,'name':p['name_ko'],'file':file,'sha256':sha(raw),'dimensions':image.size,
  'svg':svg,'background':p['presentation']['bg'],'locked':p.get('presentation_locked') is True,
  'votesAtRepair':row['review'].get('down_at_review',0)})
out={'verified':len(verified),'withReplacementVotes':sum(int(r['votesAtRepair'])>0 for r in verified),'rows':verified}
Path('/root/projects/vibers-fleet/releases/20261025-semologo-public-priority/verification-current.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
print(json.dumps({k:v for k,v in out.items() if k!='rows'}))

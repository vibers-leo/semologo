"""Replace an existing opaque PNG with the unchanged first-party transparent PNG."""
import hashlib, io, json, runpy, subprocess
from pathlib import Path
from PIL import Image

BASE=Path('/root/projects/vibers-fleet/releases/20261025-semologo-public-priority')
runner=runpy.run_path('/root/projects/semologo-publisher/run.py');runner['credentials']()
core=runpy.run_path('/root/projects/semologo-publisher/scripts/fleet-auto-core.py')
ident='gongu-ci-0778'
url='https://www.yong-san.or.kr/design/theme/yongsan/image/main/logo.png'
page='https://www.yong-san.or.kr/site/main/home'
raw=subprocess.check_output(['curl','-fsSL','--max-time','25',url])
digest=hashlib.sha256(raw).hexdigest()
assert digest=='ad6b24585f4ec9a1c72fb20d5478ce712883a060f70dab557eee8e6e2e146d48'
image=Image.open(io.BytesIO(raw));image.load()
assert image.format=='PNG' and image.size==(240,37)
assert image.convert('RGBA').getchannel('A').getextrema()==(0,255)
file='sources/official-transparent-20261025-ad6b2458/logo.png'
key='_clients/'+ident+'/'+file
cdn='https://logo.vibers.co.kr/'+key
s3=core['s3_client']()
try:
    prior=s3.get_object(Bucket='vibers-bucket',Key=key)['Body'].read()
    assert prior==raw,'Immutable object conflict'
except s3.exceptions.NoSuchKey:
    s3.put_object(Bucket='vibers-bucket',Key=key,Body=raw,ACL='public-read',ContentType='image/png',CacheControl='public,max-age=31536000,immutable')
assert s3.get_object(Bucket='vibers-bucket',Key=key)['Body'].read()==raw
assert subprocess.check_output(['curl','-fsSL','--max-time','25',cdn])==raw
patch={'logo_png':file,'preview_png':cdn,'has_png':True,'has_svg':False,
       'logo_svg':None,'svg_transparent':None,'dark_png':None,
       'presentation':{'file':file,'bg':'light'},'presentation_locked':True,'website':page,'domain':'yong-san.or.kr',
       'official_source_page':page,'asset_origin':'공식 홈페이지의 투명 PNG 원본 · 240×37',
       'asset_review_status':'verified-first-party-transparent-png',
       'sources':[{'provider':'official-site','file':file,'source_url':url,
                   'official_source_page':page,'label':'공식 홈페이지 투명 PNG','sha256':digest,'width':240,'height':37}]}
variant={'schema':1,'id':ident,'primary':'official-transparent','variants':[
    {'key':'official-transparent','form':'horizontal','lockup':'horizontal','lang':'ko',
     'color':'original','label':'공식 투명 PNG','files':{'png':file},'preview_png':file,
     'source_url':url,'source_sha256':digest,'visual_sha256':digest,'review_status':'verified','order':0}]}
source='const id='+json.dumps(ident)+';'+r'''const{Pool}=require('pg');const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});(async()=>{try{const q=await p.query("SELECT p.id,p.payload,p.status,v.asset_manifest FROM semologo.logo_posts p LEFT JOIN semologo.logo_versions v ON v.brand_id=p.id AND v.is_current WHERE p.id=$1",[id]);console.log(JSON.stringify(q.rows))}finally{await p.end()}})().catch(e=>{console.error(e.message);process.exit(1)})'''
before=core['node']('semologo',source)
assert len(before)==1 and before[0]['status']=='published'
backup=BASE/'yongsan-before.json'
assert not backup.exists(),'Inspect saved repair before replaying'
backup.write_text(json.dumps(before,ensure_ascii=False,indent=2)+'\n')
data={'id':ident,'patch':patch,'variant':variant,'before':before[0]['payload'],
      'priorManifest':before[0]['asset_manifest'],'review':{'status':'repaired','down_at_review':1,
      'reason':'흰 배경이 박힌 기존 PNG를 공식 홈페이지 투명 PNG로 교체. 공식 원본 해상도 240×37을 보존하며 더 큰 벡터 원본은 수집 대기.',
      'reviewed_at':'2026-10-25','preview_file':file,'source_url':url,'resolution_followup':True}}
source='const x='+json.dumps(data,ensure_ascii=False)+';'+r'''const{Pool}=require('pg');const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});(async()=>{const c=await p.connect();try{await c.query('BEGIN');const old=await c.query('SELECT payload FROM semologo.logo_posts WHERE id=$1 FOR UPDATE',[x.id]);if(old.rowCount!==1||JSON.stringify(old.rows[0].payload)!==JSON.stringify(x.before))throw Error('Concurrent brand change');await c.query('UPDATE semologo.logo_posts SET payload=payload||$2::jsonb,updated_at=now() WHERE id=$1',[x.id,JSON.stringify(x.patch)]);const version=await c.query('SELECT id FROM semologo.logo_versions WHERE brand_id=$1 AND is_current FOR UPDATE',[x.id]);if(version.rowCount!==1)throw Error('Expected one current version');await c.query("UPDATE semologo.logo_versions SET asset_manifest=$2::jsonb,review_status='verified',verified_at=now(),source_url=$3 WHERE id=$1",[version.rows[0].id,JSON.stringify({variants:x.variant,prior_manifest:x.priorManifest,legacy_file:'logo.png'}),x.patch.official_source_page]);await c.query("INSERT INTO semologo.logo_quality_reviews(brand_id,status,review,vote_snapshot) VALUES($1,'repaired',$2::jsonb,$3::jsonb) ON CONFLICT(brand_id) DO UPDATE SET status='repaired',review=excluded.review,vote_snapshot=excluded.vote_snapshot,reviewed_at=now()",[x.id,JSON.stringify(x.review),JSON.stringify({down:{integerValue:'1'},flagged:{booleanValue:true}})]);await c.query('COMMIT');console.log(JSON.stringify({id:x.id,logo_png:x.patch.logo_png,status:'transparent-source-applied'}))}catch(e){await c.query('ROLLBACK');throw e}finally{c.release();await p.end()}})().catch(e=>{console.error(e.message);process.exit(1)})'''
result=core['node']('semologo',source)
(BASE/'yongsan-repair-receipt.json').write_text(json.dumps({'source':url,'sha256':digest,'cdn':cdn,'dimensions':[240,37],'result':result},ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result,ensure_ascii=False))

"""Rehabilitate the exact legacy Woowa record after official vector QA; preserve version data."""
import json,hashlib,mimetypes,subprocess,shlex,concurrent.futures
from pathlib import Path
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
R=Path(__file__).resolve().parents[1];D=R/'marketing/assets/requested-finance-business-20261011';W=D/'woowa';CDN='https://logo.vibers.co.kr/_clients';uploads=[];variants=[]
for lang in ['ko','en']:
 files={}
 for ext in ['svg','png']:
  p=W/f'official-{lang}.{ext}';raw=p.read_bytes();sha=hashlib.sha256(raw).hexdigest();rel='sources/requested-business-20261011/'+sha[:20]+'.'+ext
  files[ext]=rel;uploads.append({'id':'woowa','key':'_clients/woowa/'+rel,'file':str(p.relative_to(R)),'sha256':sha})
 variants.append({'key':'official-'+lang,'label':'공식 '+('한글' if lang=='ko' else '영문')+' 로고','form':'horizontal','lang':lang,'color':'color','files':files,'preview_png':files['png'],'provider':'official-site','source_url':'https://www.woowahan.com/','source_note':'공식 홈페이지 SVG 원본 경로 추출 · 흰 글자와 검정 그림자 보존 · 투명 PNG 1600px 육안 검수','order':10+len(variants)})
v=variants[0];patch={'id':'woowa','name_ko':'우아한형제들','name_en':'Woowa Brothers','origin':'KR','category':'IT·테크','website':'https://www.woowahan.com/','official_source_page':'https://www.woowahan.com/','logo_svg':v['files']['svg'],'svg_transparent':v['files']['svg'],'logo_png':v['files']['png'],'preview_png':CDN+'/woowa/'+v['files']['png'],'has_svg':True,'has_png':True,'hidden':False,'light':False,'light_logo':False,'aliases':['우아한형제들','Woowa Brothers','WOOWA BROS','우아한 형제들'],'asset_review_status':'verified','asset_origin':'공식 홈페이지 원본 벡터','variants_n':2,'rejected_asset_files':['logo.svg','logo.png','logo-800.png','logo-icon.png','logo-transparent.png','logo-white.png']}
manifest={'schema':1,'algo_v':1,'id':'woowa','primary':v['key'],'variants':variants}
def remote(js):return subprocess.run(['ssh','vibers','docker exec -i semologo node -'],input=js,text=True,capture_output=True,check=True).stdout
pre=remote("const {Pool}=require('pg');(async()=>{const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});console.log(JSON.stringify((await p.query(\"SELECT p.payload,p.status,v.id version_id,v.asset_manifest FROM semologo.logo_posts p JOIN semologo.logo_versions v ON v.brand_id=p.id AND v.is_current WHERE p.id='woowa'\")).rows));await p.end()})().catch(e=>{console.error(e.message);process.exitCode=1})")
old=json.loads(pre);assert len(old)==1 and old[0]['status']=='published' and old[0]['payload']['metadata']['hidden'] is True and old[0]['payload']['asset_review_status']=='legacy-unreviewed' and not old[0]['payload'].get('merged_into')
assert not (old[0]['asset_manifest'] or {}).get('variants'),'Existing variants require explicit merge'
(W/'before.json').write_text(json.dumps(old,ensure_ascii=False,indent=2)+'\n')
env={}
for line in Path('/Users/juuuno/Desktop/macminim4/.secrets/보안.env').read_text().splitlines():
 if line.startswith('export '):line=line[7:]
 if '=' not in line:continue
 k,v=line.split('=',1)
 if k in ['NCP_ACCESS_KEY','NCP_SECRET_KEY']:env[k]=shlex.split(v,comments=True)[0]
s3=boto3.client('s3',endpoint_url='https://kr.object.ncloudstorage.com',region_name='kr-standard',aws_access_key_id=env['NCP_ACCESS_KEY'],aws_secret_access_key=env['NCP_SECRET_KEY'],config=Config(signature_version='s3v4',request_checksum_calculation='when_required',response_checksum_validation='when_required',max_pool_connections=3))
def put(u):
 raw=(R/u['file']).read_bytes();assert hashlib.sha256(raw).hexdigest()==u['sha256']
 try:assert s3.get_object(Bucket='vibers-bucket',Key=u['key'])['Body'].read()==raw,'Immutable conflict'
 except ClientError as e:
  if e.response['Error']['Code'] not in ['NoSuchKey','404']:raise
  s3.put_object(Bucket='vibers-bucket',Key=u['key'],Body=raw,ACL='public-read',ContentType=mimetypes.guess_type(u['key'])[0],CacheControl='public,max-age=31536000,immutable')
 assert s3.get_object(Bucket='vibers-bucket',Key=u['key'])['Body'].read()==raw
 url=CDN+'/'+u['key'].removeprefix('_clients/')
 response=subprocess.run(['curl','-fsSL','--max-time','35',url],capture_output=True,check=True).stdout;assert hashlib.sha256(response).hexdigest()==u['sha256'],'CDN mismatch'
 return u['key']
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:verified=list(pool.map(put,uploads))
script='const expected='+json.dumps(old[0],ensure_ascii=False)+';const patch='+json.dumps(patch,ensure_ascii=False)+';const manifest='+json.dumps(manifest,ensure_ascii=False)+';'+r"""
const {Pool}=require('pg');(async()=>{const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});const d=await p.connect();try{await d.query('BEGIN');const r=await d.query("SELECT payload,status FROM semologo.logo_posts WHERE id='woowa' FOR UPDATE");const v=await d.query("SELECT id,asset_manifest FROM semologo.logo_versions WHERE brand_id='woowa' AND is_current FOR UPDATE");if(r.rowCount!==1||v.rowCount!==1||v.rows[0].id!==expected.version_id||JSON.stringify(r.rows[0].payload)!==JSON.stringify(expected.payload)||JSON.stringify(v.rows[0].asset_manifest)!==JSON.stringify(expected.asset_manifest))throw Error('Concurrent record change');const payload={...r.rows[0].payload,...patch,metadata:{...r.rows[0].payload.metadata,hidden:false,has_svg:true,has_png:true}};await d.query("UPDATE semologo.logo_posts SET payload=$1::jsonb,updated_at=now() WHERE id='woowa'",[JSON.stringify(payload)]);await d.query("UPDATE semologo.logo_versions SET asset_manifest=$1::jsonb,review_status='verified',verified_at=now(),source_url='https://www.woowahan.com/',label='공식 홈페이지 원본 벡터 · 검수 완료',source_note='공식 한글·영문 SVG 경로 및 색상 보존; 기존 ID와 버전 이력 보존' WHERE id=$2",[JSON.stringify({...v.rows[0].asset_manifest,variants:manifest}),expected.version_id]);await d.query('COMMIT');console.log('PASS existing Woowa rehabilitated');}catch(e){await d.query('ROLLBACK');throw e;}finally{d.release();await p.end()}})().catch(e=>{console.error(e.message);process.exitCode=1})
"""
print(remote(script),flush=True)
for name,value in [('brand.json',patch),('variants.json',manifest)]:
 raw=json.dumps(value,ensure_ascii=False).encode();key='_clients/woowa/'+name;s3.put_object(Bucket='vibers-bucket',Key=key,Body=raw,ACL='public-read',ContentType='application/json',CacheControl='public,max-age=60');assert s3.get_object(Bucket='vibers-bucket',Key=key)['Body'].read()==raw
release=json.loads((D/'release.json').read_text());release['patches']['woowa']=patch;release['variants']['woowa']=manifest
for path in [D/'release.json',R/'src/lib/reviewed-requested-business-20261011.json']:path.write_text(json.dumps(release,ensure_ascii=False,indent=2)+'\n')
prior=json.loads((D/'uploads.json').read_text());(D/'uploads.json').write_text(json.dumps(prior+uploads,indent=2)+'\n')
(W/'published.json').write_text(json.dumps({'id':'woowa','objects':len(verified),'variants':2,'status':'legacy-record-preserved-official-vector-reviewed-cdn-verified'},indent=2)+'\n')

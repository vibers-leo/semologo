"""Publish visually reviewed new identities with immutable bytes and CMS guards."""
import argparse,json,hashlib,mimetypes,subprocess,shlex,concurrent.futures
from pathlib import Path
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
R=Path(__file__).resolve().parents[1];D=R/'marketing/assets/requested-finance-business-20261011';CDN='https://logo.vibers.co.kr/_clients';data=json.loads((D/'extracted.json').read_text());assert all(r['visual_review']=='pass' for r in data['rows'])
parser=argparse.ArgumentParser();parser.add_argument('--ids',nargs='+');parser.add_argument('--allow-official-png',action='store_true',help='Explicit user-approved exception for the three held official PNG identities');args=parser.parse_args()
if args.ids:
 data['meta']={k:v for k,v in data['meta'].items() if k in args.ids};data['rows']=[r for r in data['rows'] if r['id'] in args.ids]
release={'patches':{},'variants':{}};uploads=[]
def obj(bid,file):
 raw=file.read_bytes();sha=hashlib.sha256(raw).hexdigest();rel='sources/requested-business-20261011/'+sha[:20]+file.suffix
 u={'id':bid,'key':'_clients/'+bid+'/'+rel,'file':str(file.relative_to(R)),'sha256':sha}
 if not any(x['key']==u['key'] for x in uploads):uploads.append(u)
 return rel
for bid,meta in data['meta'].items():
 variants=[]
 for row in [r for r in data['rows'] if r['id']==bid]:
  png_only='svg' not in row
  if png_only:assert args.allow_official_png and bid in ['daangnpay','coupangpay','gmoneytrans'] and row.get('provider')=='official-site','PNG exception requires explicit approved identity and official source'
  files={ext:obj(bid,R/row[ext]) for ext in ['svg','png'] if ext in row}
  if bid=='jbbank':files['zip']=obj(bid,D/bid/'original.zip');files['ai']=obj(bid,D/bid/'original-0.ai')
  if bid in ['gsretail','bizentro']:files['zip']=obj(bid,D/bid/'original.zip');files['ai']=obj(bid,D/bid/'original.ai')
  if bid=='sk-securities':files['zip']=obj(bid,D/bid/'secondary-original.zip')
  variants.append({'key':row['key'],'label':row['label'],'form':'symbol' if row['key']=='symbol' else 'vertical' if 'vertical' in row['key'] else 'horizontal','lang':'en' if row['key'].endswith('-en') else 'ko','color':row.get('color','white' if bid=='roumit' else 'color'),'files':files,'preview_png':files['png'],'provider':row.get('provider','official-site'),'source_url':row['source_url'],'source_note':row.get('source_note','공식 원본 벡터 추출 · 투명 PNG 1600px · 육안 검수'),'order':10+len(variants)})
 v=variants[0];patch={'id':bid,'name_ko':meta[0],'name_en':meta[1],'category':meta[2],'origin':'KR','website':meta[3],'official_source_page':meta[3],'logo_svg':v['files'].get('svg'),'svg_transparent':v['files'].get('svg'),'logo_png':v['files']['png'],'preview_png':CDN+'/'+bid+'/'+v['files']['png'],'has_svg':'svg' in v['files'],'has_png':True,'light':bid=='roumit','light_logo':bid=='roumit','dark_variant':False,'added_at':'2026-10-11','logo_published_at':'2026-10-11T07:00:00Z','variants_n':len(variants),'aliases':[meta[0],meta[1]],'asset_origin':'공식 홈페이지 원본 벡터','asset_review_status':'verified','rejected_asset_files':['logo.svg','logo.png','logo-800.png','logo-icon.png','logo-transparent.png','logo-white.png']}
 if 'svg' not in v['files']:patch.update(asset_origin='공식 홈페이지 PNG 원본',svg_collection_status='pending',source_note='사용자 요청으로 공식 PNG 우선 공개 · SVG 미제공 · 확대 보정하지 않은 원본 해상도')
 if bid=='jbbank':patch.update(source_zip=v['files']['zip'],source_ai=v['files']['ai'],icon_png=variants[-1]['files']['png'],aliases=['전북은행','JB전북은행','JB Bank','Jeonbuk Bank'])
 if bid in ['gsretail','bizentro']:patch.update(source_zip=v['files']['zip'],source_ai=v['files']['ai'])
 if bid=='sk-securities':patch.update(asset_origin='출처 표기 공개 EPS · 공식 홈페이지 형태 대조',source_zip=v['files']['zip'])
 release['patches'][bid]=patch;release['variants'][bid]={'schema':1,'algo_v':1,'id':bid,'primary':v['key'],'variants':variants}
# Refuse all pre-existing IDs, including hidden or merged records, before uploading.
ids=list(release['patches']);script='const ids='+json.dumps(ids)+';'+r'''const {Pool}=require('pg');(async()=>{const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});try{const r=await p.query('SELECT id FROM semologo.logo_posts WHERE id=ANY($1)',[ids]);if(r.rowCount)throw Error('Existing identities require append workflow: '+r.rows.map(x=>x.id));console.log('PASS new identity preflight '+ids.length);}finally{await p.end();}})().catch(e=>{console.error(e.message);process.exitCode=1;});'''
subprocess.run(['ssh','vibers','docker exec -i semologo node -'],input=script,text=True,check=True)
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
for bid,patch in release['patches'].items():
 for name,value in [('brand.json',patch),('variants.json',release['variants'][bid])]:
  raw=json.dumps(value,ensure_ascii=False).encode();s3.put_object(Bucket='vibers-bucket',Key='_clients/'+bid+'/'+name,Body=raw,ACL='public-read',ContentType='application/json',CacheControl='public,max-age=300');assert s3.get_object(Bucket='vibers-bucket',Key='_clients/'+bid+'/'+name)['Body'].read()==raw
script='const release='+json.dumps(release,ensure_ascii=False)+';'+r'''const {Pool}=require('pg');(async()=>{const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});const d=await p.connect();try{await d.query('BEGIN');for(const [id,b] of Object.entries(release.patches)){const r=await d.query("INSERT INTO semologo.logo_posts(id,payload,status) VALUES($1,$2,'published') ON CONFLICT DO NOTHING RETURNING id",[id,JSON.stringify(b)]);if(r.rowCount!==1)throw Error('Concurrent identity conflict '+id);const v=await d.query("UPDATE semologo.logo_versions SET asset_manifest=$2::jsonb,review_status='verified',verified_at=now(),source_url=$3,label=CASE WHEN brand_id='sk-securities' THEN '출처 표기 공개 EPS · 검수 완료' WHEN brand_id IN ('daangnpay','coupangpay','gmoneytrans') THEN '공식 PNG 원본 · 사용자 요청 우선 공개' ELSE '공식 원본 벡터 · 검수 완료' END,source_note=CASE WHEN brand_id='sk-securities' THEN 'ILUO 공개 EPS · 공식 홈페이지 형태 대조 · 공식 배포 파일로 단정하지 않음' WHEN brand_id IN ('daangnpay','coupangpay','gmoneytrans') THEN '공식 PNG 원본 육안 검수 · SVG 미제공 · 사용자 요청 예외' ELSE '공식 사이트 다운로드 및 SVG/투명 PNG 육안 검수' END WHERE brand_id=$1 AND is_current",[id,JSON.stringify({variants:release.variants[id]}),release.variants[id].variants[0].source_url]);if(v.rowCount!==1)throw Error('Version trigger missing '+id);}await d.query('COMMIT');console.log('PASS published '+Object.keys(release.patches).length);}catch(e){await d.query('ROLLBACK');throw e;}finally{d.release();await p.end();}})().catch(e=>{console.error(e.message);process.exitCode=1;});'''
subprocess.run(['ssh','vibers','docker exec -i semologo node -'],input=script,text=True,check=True)
if (D/'release.json').exists():
 previous=json.loads((D/'release.json').read_text());release={'patches':{**previous['patches'],**release['patches']},'variants':{**previous['variants'],**release['variants']}}
 uploads=json.loads((D/'uploads.json').read_text())+uploads
 ids=list(release['patches'])
(D/'release.json').write_text(json.dumps(release,ensure_ascii=False,indent=2)+'\n');(R/'src/lib/reviewed-requested-business-20261011.json').write_text(json.dumps(release,ensure_ascii=False,indent=2)+'\n');(D/'uploads.json').write_text(json.dumps(uploads,indent=2)+'\n');(D/'published.json').write_text(json.dumps({'status':'cms-published-cdn-bytes-verified','identities':ids,'objects':len(uploads),'variants':sum(len(v['variants']) for v in release['variants'].values())},indent=2)+'\n')

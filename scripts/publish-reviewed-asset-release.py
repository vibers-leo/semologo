"""Publish reviewed immutable SVG/PNG objects and patch existing CMS metadata."""
import argparse,concurrent.futures,hashlib,json,mimetypes,shlex,subprocess
from pathlib import Path
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'marketing/assets/asset-release-20261008'
def main():
 global OUT
 parser=argparse.ArgumentParser();parser.add_argument('--release-dir',type=Path,default=OUT);parser.add_argument('--append-originals',action='store_true');args=parser.parse_args();OUT=args.release_dir.resolve();assert OUT.is_relative_to(ROOT/'marketing/assets')
 release=json.loads((OUT/'release.json').read_text());uploads=json.loads((OUT/'uploads.json').read_text())
 if args.append_originals:
  assert all(u['key'].startswith('_clients/'+u['id']+'/sources/supplied-originals-') for u in uploads), 'Original object key must match CDN client prefix'
 for u in uploads:
  f=ROOT/u['file'];assert hashlib.sha256(f.read_bytes()).hexdigest()==u['sha256']
  if f.suffix=='.png':
   im=Image.open(f).convert('RGBA');assert sum(p[3]>100 for p in im.getdata())>20, 'Invisible PNG '+str(f)
 script='const ids='+json.dumps(list(release['patches']))+';'+r'''const {Pool}=require('pg');(async()=>{const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});try{const r=await p.query('SELECT id FROM semologo.logo_posts WHERE id=ANY($1)',[ids]);const found=new Set(r.rows.map(r=>r.id));const missing=ids.filter(id=>!found.has(id));if(missing.length)throw Error('Missing CMS identities: '+missing.join(','));console.log('PASS existing CMS identities '+r.rowCount);}finally{await p.end();}})().catch(e=>{console.error(e.message);process.exitCode=1;});'''
 subprocess.run(['ssh','vibers','docker exec -i semologo node -'],input=script,text=True,check=True)
 env={}
 for line in Path('/Users/juuuno/Desktop/macminim4/.secrets/보안.env').read_text().splitlines():
  if line.startswith('export '):line=line[7:]
  if '=' not in line:continue
  k,v=line.split('=',1)
  if k in ['NCP_ACCESS_KEY','NCP_SECRET_KEY']:env[k]=shlex.split(v,comments=True)[0]
 s3=boto3.client('s3',endpoint_url='https://kr.object.ncloudstorage.com',region_name='kr-standard',aws_access_key_id=env['NCP_ACCESS_KEY'],aws_secret_access_key=env['NCP_SECRET_KEY'],config=Config(signature_version='s3v4',request_checksum_calculation='when_required',response_checksum_validation='when_required',max_pool_connections=4))
 def publish(u):
  raw=(ROOT/u['file']).read_bytes()
  try:
   old=s3.get_object(Bucket='vibers-bucket',Key=u['key'])['Body'].read();assert old==raw,'Conflicting immutable object '+u['key']
  except ClientError as e:
   if e.response['Error']['Code'] not in ['NoSuchKey','404']:raise
   s3.put_object(Bucket='vibers-bucket',Key=u['key'],Body=raw,ACL='public-read',ContentType=mimetypes.guess_type(u['key'])[0],CacheControl='public,max-age=31536000,immutable')
  assert s3.get_object(Bucket='vibers-bucket',Key=u['key'])['Body'].read()==raw
  return u['key']
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
  for i,key in enumerate(pool.map(publish,uploads),1):
   if i%50==0:print('Verified upload',i,'/',len(uploads),flush=True)
 archive={id:{'variants':release['variants'].get(id),'files':[u for u in uploads if u['id']==id]} for id in release['patches']}
 script='const archive='+json.dumps(archive,ensure_ascii=False)+';const patches='+json.dumps(release['patches'],ensure_ascii=False)+';'+r'''const {Pool}=require('pg');(async()=>{const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});const d=await p.connect();try{await d.query('BEGIN');for(const [id,patch]of Object.entries(patches)){const r=await d.query('UPDATE semologo.logo_posts SET payload=payload||$2::jsonb,updated_at=now() WHERE id=$1',[id,JSON.stringify(patch)]);if(r.rowCount!==1)throw Error('Missing identity '+id);if(archive[id].files.length||id==='hyundaielevator')await d.query("UPDATE semologo.logo_versions SET asset_manifest=$2::jsonb,review_status='verified',verified_at=now(),source_url=coalesce($3,source_url),label=$4,introduced_year=coalesce($5,introduced_year),version_kind=CASE WHEN $1='gemini' THEN 'brand_redesign' ELSE version_kind END,source_note=CASE WHEN $1='gemini' THEN '2025년: https://commons.wikimedia.org/wiki/File:Google_Gemini_logo_2025.svg · Google About Gemini inline SVG, filters preserved' ELSE source_note END WHERE brand_id=$1 AND is_current",[id,JSON.stringify(archive[id]),patch.official_source_page||null,id==='gemini'?'Google Gemini · 공식 2025 로고':'검수한 로고 자산',id==='gemini'?2025:null]);}await d.query('COMMIT');console.log('PASS metadata patches '+Object.keys(patches).length);}catch(e){await d.query('ROLLBACK');throw e;}finally{d.release();await p.end();}})().catch(e=>{console.error(e.message);process.exitCode=1;});'''
 if args.append_originals:
  assert all(set(patch)<= {'source_zip','source_original_label'} for patch in release['patches'].values()), 'Original-only patches required'
  assert all(u['key'].endswith('.zip') for u in uploads), 'ZIP originals only'
  script='const archive='+json.dumps(archive,ensure_ascii=False)+';const patches='+json.dumps(release['patches'],ensure_ascii=False)+';'+r'''const {Pool}=require('pg');(async()=>{const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});const d=await p.connect();try{await d.query('BEGIN');for(const [id,patch] of Object.entries(patches)){const prior=await d.query('SELECT payload FROM semologo.logo_posts WHERE id=$1 FOR UPDATE',[id]);if(prior.rowCount!==1)throw Error('Missing identity '+id);if(prior.rows[0].payload.source_zip && prior.rows[0].payload.source_zip!==patch.source_zip)throw Error('Existing source ZIP must be preserved '+id);const previous=await d.query('SELECT * FROM semologo.logo_versions WHERE brand_id=$1 AND is_current FOR UPDATE',[id]);if(previous.rowCount!==1)throw Error('Expected one prior current version '+id);const previousManifest=previous.rows[0].asset_manifest||{};await d.query('UPDATE semologo.logo_posts SET payload=payload||$2::jsonb,updated_at=now() WHERE id=$1',[id,JSON.stringify(patch)]);const versions=await d.query('SELECT id,asset_manifest FROM semologo.logo_versions WHERE brand_id=$1 AND is_current FOR UPDATE',[id]);for(const version of versions.rows){const currentManifest=version.asset_manifest||{};const before={...currentManifest,...previousManifest};const oldFiles=[...(previousManifest.files||[])];for(const file of currentManifest.files||[]){if(!oldFiles.some(old=>old.key===file.key))oldFiles.push(file);}const added=archive[id].files.filter(f=>!oldFiles.some(old=>old.key===f.key));const after={...before,files:[...oldFiles,...added]};for(const key of Object.keys(previousManifest)){if(key!=='files' && JSON.stringify(previousManifest[key])!==JSON.stringify(after[key]))throw Error('Prior manifest field changed '+key);}if(oldFiles.some((file,index)=>JSON.stringify(file)!==JSON.stringify(after.files[index])))throw Error('Existing manifest files changed');const priorVersion=previous.rows[0]||version;await d.query('UPDATE semologo.logo_versions SET asset_manifest=$2::jsonb,label=$3,review_status=$4,verified_at=$5,source_url=$6,source_note=$7,version_kind=$8,introduced_year=$9,retired_year=$10 WHERE id=$1',[version.id,JSON.stringify(after),priorVersion.label,priorVersion.review_status,priorVersion.verified_at,priorVersion.source_url,priorVersion.source_note,priorVersion.version_kind,priorVersion.introduced_year,priorVersion.retired_year]);}}await d.query('COMMIT');console.log('PASS appended originals; prior variants/files and version metadata preserved: '+Object.keys(patches).length);}catch(e){await d.query('ROLLBACK');throw e;}finally{d.release();await p.end();}})().catch(e=>{console.error(e.message);process.exitCode=1;});'''
 subprocess.run(['ssh','vibers','docker exec -i semologo node -'],input=script,text=True,check=True)
 (OUT/'published.json').write_text(json.dumps({'objects':len(uploads),'patched':len(release['patches']),'status':'all-bytes-verified'},indent=2))
if __name__=='__main__':main()

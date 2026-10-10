"""Publish reviewed community objects without changing existing official representatives."""
import json,hashlib,shlex,mimetypes,subprocess,concurrent.futures,argparse
from pathlib import Path
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--release-dir',type=Path,required=True);args=parser.parse_args();folder=args.release_dir.resolve();assert folder.is_relative_to(root/'marketing/assets')
env={}
for line in Path('/Users/juuuno/Desktop/macminim4/.secrets/보안.env').read_text().splitlines():
 line=line.removeprefix('export ')
 if '=' not in line:continue
 k,v=line.split('=',1)
 if k in ['NCP_ACCESS_KEY','NCP_SECRET_KEY']:env[k]=shlex.split(v,comments=True)[0]
s3=boto3.client('s3',endpoint_url='https://kr.object.ncloudstorage.com',region_name='kr-standard',aws_access_key_id=env['NCP_ACCESS_KEY'],aws_secret_access_key=env['NCP_SECRET_KEY'],config=Config(signature_version='s3v4',request_checksum_calculation='when_required',response_checksum_validation='when_required',max_pool_connections=4))
def publish(row):
 raw=(root/row['file']).read_bytes();assert hashlib.sha256(raw).hexdigest()==row['sha256']
 try:assert s3.get_object(Bucket='vibers-bucket',Key=row['key'])['Body'].read()==raw
 except ClientError as e:
  if e.response['Error']['Code'] not in ['NoSuchKey','404']:raise
  s3.put_object(Bucket='vibers-bucket',Key=row['key'],Body=raw,ACL='public-read',ContentType=mimetypes.guess_type(row['file'])[0] or 'application/octet-stream',CacheControl='public,max-age=31536000,immutable')
 assert s3.get_object(Bucket='vibers-bucket',Key=row['key'])['Body'].read()==raw
 url='https://logo.vibers.co.kr/'+row['key']
 assert subprocess.run(['curl','--fail','--silent','--show-error','--max-time','40',url],capture_output=True,check=True).stdout==raw
 return {'key':row['key'],'sha256':row['sha256'],'cdn_verified':True}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(publish,json.loads((folder/'uploads.json').read_text())))
(folder/'cdn-verification.json').write_text(json.dumps(results,indent=2)+'\n');print('CDN verified',len(results),'objects',flush=True)
release=json.loads((folder/'release.json').read_text());uploads=json.loads((folder/'uploads.json').read_text())
script='const release='+json.dumps(release,ensure_ascii=False)+';const uploads='+json.dumps(uploads,ensure_ascii=False)+';'+r'''
const {Pool}=require('pg');(async()=>{const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});const d=await p.connect();try{
 await d.query('BEGIN');
 for(const [id,manifest] of Object.entries(release.variants)){
  if(manifest.id!==id||!Array.isArray(manifest.variants)||!manifest.variants.length)throw Error('Invalid manifest '+id);
  const old=await d.query('SELECT payload,status FROM semologo.logo_posts WHERE id=$1 FOR UPDATE',[id]);
  if(old.rowCount){
   if(old.rows[0].status!=='published'||old.rows[0].payload.hidden||old.rows[0].payload.merged_into)throw Error('Canonical identity required '+id);
   await d.query("UPDATE semologo.logo_posts SET payload=payload||jsonb_build_object('variants_n',$2::int),updated_at=now() WHERE id=$1",[id,manifest.variants.length]);
  }else{
   const patch=release.patches[id];if(!patch||patch.id!==id||!patch.name_ko||!patch.category||!patch.has_png)throw Error('Complete new identity required '+id);
   await d.query("INSERT INTO semologo.logo_posts(id,payload,status) VALUES($1,$2::jsonb,'published')",[id,JSON.stringify(patch)]);
  }
  const versions=await d.query('SELECT id,asset_manifest FROM semologo.logo_versions WHERE brand_id=$1 AND is_current FOR UPDATE',[id]);
  for(const version of versions.rows){
   const before=version.asset_manifest||{}, prior=before.variants?.variants||[];
   if(prior.some(v=>!manifest.variants.some(n=>n.key===v.key&&JSON.stringify(n.files)===JSON.stringify(v.files))))throw Error('Existing variant would be lost '+id);
   const files=[...(before.files||[])];for(const f of uploads.filter(x=>x.id===id))if(!files.some(x=>x.key===f.key))files.push(f);
   const after={...before,variants:manifest,files};
   await d.query('UPDATE semologo.logo_versions SET asset_manifest=$2::jsonb WHERE id=$1',[version.id,JSON.stringify(after)]);
   if(!old.rowCount)await d.query("UPDATE semologo.logo_versions SET review_status='verified',verified_at=now(),label='커뮤니티 수록 로고 · 벡터 검수',source_note='사용자 제공 Figma Community 내보내기에서 추출. 공식 배포 원본으로 표시하지 않음.' WHERE id=$1",[version.id]);
  }
 }
 await d.query('COMMIT');console.log('PASS community variants appended; existing representatives and version metadata preserved');
}catch(e){await d.query('ROLLBACK');throw e;}finally{d.release();await p.end();}})().catch(e=>{console.error(e.message);process.exitCode=1});'''
subprocess.run(['ssh','vibers','docker exec -i semologo node -'],input=script,text=True,check=True)
for id,manifest in release['variants'].items():
 raw=json.dumps(manifest,ensure_ascii=False).encode();key=f'_clients/{id}/variants.json'
 s3.put_object(Bucket='vibers-bucket',Key=key,Body=raw,ACL='public-read',ContentType='application/json',CacheControl='public,max-age=60')
 assert s3.get_object(Bucket='vibers-bucket',Key=key)['Body'].read()==raw
(folder/'published.json').write_text(json.dumps({'objects':len(results),'brands':len(release['variants']),'status':'cdn-verified-community-variants-appended'},indent=2)+'\n')

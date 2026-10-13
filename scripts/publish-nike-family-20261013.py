"""Publish reviewed immutable files, preserve existing version metadata/files, then patch identities."""
from pathlib import Path
import json,hashlib,shlex,subprocess,mimetypes,concurrent.futures
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
R=Path(__file__).resolve().parents[1];D=R/'marketing/assets/nike-and-white-background-20261013'
release=json.loads((D/'release.json').read_text());uploads=json.loads((D/'uploads.json').read_text());assert (D/'visual-approved.json').exists(),'Visual review required'
approval=json.loads((D/'visual-approved.json').read_text())
assert approval['release_sha256']==hashlib.sha256((D/'release.json').read_bytes()).hexdigest()
assert approval['uploads_sha256']==hashlib.sha256((D/'uploads.json').read_bytes()).hexdigest()
env={}
for line in Path('/Users/juuuno/Desktop/macminim4/.secrets/보안.env').read_text().splitlines():
 line=line.removeprefix('export ')
 if '=' not in line:continue
 k,v=line.split('=',1)
 if k in ['NCP_ACCESS_KEY','NCP_SECRET_KEY']:env[k]=shlex.split(v,comments=True)[0]
s3=boto3.client('s3',endpoint_url='https://kr.object.ncloudstorage.com',region_name='kr-standard',aws_access_key_id=env['NCP_ACCESS_KEY'],aws_secret_access_key=env['NCP_SECRET_KEY'],config=Config(signature_version='s3v4',request_checksum_calculation='when_required',response_checksum_validation='when_required',max_pool_connections=4))
def put(u):
 raw=(R/u['file']).read_bytes();assert hashlib.sha256(raw).hexdigest()==u['sha256']
 try:assert s3.get_object(Bucket='vibers-bucket',Key=u['key'])['Body'].read()==raw,'Immutable conflict'
 except ClientError as e:
  if e.response['Error']['Code'] not in ['NoSuchKey','404']:raise
  s3.put_object(Bucket='vibers-bucket',Key=u['key'],Body=raw,ACL='public-read',ContentType=mimetypes.guess_type(u['key'])[0],CacheControl='public,max-age=31536000,immutable')
 assert s3.get_object(Bucket='vibers-bucket',Key=u['key'])['Body'].read()==raw
 assert subprocess.run(['curl','-fsS','--max-time','30','https://logo.vibers.co.kr/'+u['key']],capture_output=True,check=True).stdout==raw
 return u['key']
unique={u['key']:u for u in uploads}
with concurrent.futures.ThreadPoolExecutor(max_workers=3)as pool:
 verified=list(pool.map(put,unique.values()))
print('PASS CDN + origin bytes',len(verified),flush=True)
js='const release='+json.dumps(release,ensure_ascii=False)+';const uploads='+json.dumps(uploads)+';'+r'''const{Pool}=require('pg');(async()=>{const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1}),d=await p.connect();try{await d.query('BEGIN');const before=[];for(const[id,patch]of Object.entries(release.patches)){const old=await d.query('SELECT id,payload,status FROM semologo.logo_posts WHERE id=$1 FOR UPDATE',[id]);if(old.rowCount!==1||old.rows[0].status!=='published')throw Error('identity '+id);before.push(old.rows[0]);await d.query('UPDATE semologo.logo_posts SET payload=payload||$2::jsonb,updated_at=now() WHERE id=$1',[id,JSON.stringify(patch)]);if(release.variants[id]){const oldVersions=await d.query('SELECT id,asset_manifest FROM semologo.logo_versions WHERE brand_id=$1 AND is_current FOR UPDATE',[id]);for(const v of oldVersions.rows){const original=v.asset_manifest||{},files=[...(original.files||[])];for(const file of uploads.filter(u=>u.id===id))if(!files.some(f=>f.key===file.key))files.push(file);const after={...original,variants:release.variants[id],files};await d.query('UPDATE semologo.logo_versions SET asset_manifest=$2::jsonb WHERE id=$1',[v.id,JSON.stringify(after)]);}}}await d.query('COMMIT');console.log(JSON.stringify(before));}catch(e){await d.query('ROLLBACK');throw e}finally{d.release();await p.end()}})().catch(e=>{console.error(e.message);process.exitCode=1});'''
r=subprocess.run(['ssh','vibers','docker exec -i semologo node -'],input=js,text=True,capture_output=True,check=True);(D/'publication-before.json').write_text(r.stdout)
for id,m in release['variants'].items():
 s3.put_object(Bucket='vibers-bucket',Key='_clients/'+id+'/variants.json',Body=json.dumps(m,ensure_ascii=False).encode(),ACL='public-read',ContentType='application/json',CacheControl='public,max-age=60')
(D/'published.json').write_text(json.dumps({'patches':len(release['patches']),'verified_objects':len(verified),'manifests':len(release['variants']),'status':'published'},indent=2));print('PASS CMS patches',len(release['patches']),'version metadata/prior files preserved')

"""Publish the reviewed official replacements; keep the WikiLeaks vector as archive."""
import hashlib
import json
import mimetypes
import shlex
import subprocess
from pathlib import Path

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

ROOT = Path(__file__).resolve().parents[1]
FOLDER = ROOT / 'marketing/assets/dribbble-wikileaks-official-20261014'
release = json.loads((FOLDER / 'release.json').read_text())
uploads = json.loads((FOLDER / 'uploads.json').read_text())
env = {}
for line in Path('/Users/juuuno/Desktop/macminim4/.secrets/보안.env').read_text().splitlines():
    line = line.removeprefix('export ')
    if '=' not in line:
        continue
    key, value = line.split('=', 1)
    if key in ('NCP_ACCESS_KEY', 'NCP_SECRET_KEY'):
        env[key] = shlex.split(value, comments=True)[0]
s3 = boto3.client('s3', endpoint_url='https://kr.object.ncloudstorage.com', region_name='kr-standard',
                  aws_access_key_id=env['NCP_ACCESS_KEY'], aws_secret_access_key=env['NCP_SECRET_KEY'],
                  config=Config(signature_version='s3v4', request_checksum_calculation='when_required',
                                response_checksum_validation='when_required'))
for row in uploads:
    raw = (ROOT / row['file']).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == row['sha256']
    try:
        assert s3.get_object(Bucket='vibers-bucket', Key=row['key'])['Body'].read() == raw
    except ClientError as error:
        if error.response['Error']['Code'] not in ('NoSuchKey', '404'):
            raise
        s3.put_object(Bucket='vibers-bucket', Key=row['key'], Body=raw, ACL='public-read',
                      ContentType=mimetypes.guess_type(row['file'])[0],
                      CacheControl='public,max-age=31536000,immutable')
    assert s3.get_object(Bucket='vibers-bucket', Key=row['key'])['Body'].read() == raw
    response = subprocess.run(['curl', '--fail', '--silent', '--show-error', '--max-time', '40',
                               'https://logo.vibers.co.kr/' + row['key']], capture_output=True, check=True)
    assert response.stdout == raw, f'CDN mismatch: {row["key"]}'
print('CDN verified', len(uploads), 'official files', flush=True)

script = 'const release=' + json.dumps(release, ensure_ascii=False) + ';const uploads=' + json.dumps(uploads) + ';' + r'''
const {Client}=require('pg');
(async()=>{const db=new Client({connectionString:process.env.DB_VIBERS_MAIN_URL});await db.connect();try{
 await db.query('BEGIN');
 for(const id of ['dribbble','wikileaks']){
  const patch=release.patches[id], manifest=release.variants[id];
  const post=await db.query('SELECT payload,status FROM semologo.logo_posts WHERE id=$1 FOR UPDATE',[id]);
  if(post.rowCount!==1||post.rows[0].status!=='published')throw Error(id+' CMS row missing');
  const before=post.rows[0].payload.presentation;
  const expected=id==='dribbble'?'sources/figma-better-community-20261010/4124fd2b4d2cda42d8b9.png':'logo-white.png';
  if(before&&before.file!==expected&&before.file!==patch.presentation.file)throw Error(id+' representative changed concurrently');
  if(id==='wikileaks'&&!manifest.variants.some(v=>v.key==='archive-2008-vector'&&v.files.svg==='logo.svg'))throw Error('WikiLeaks archive missing');
  await db.query('UPDATE semologo.logo_posts SET payload=payload||$2::jsonb,updated_at=now() WHERE id=$1',[id,JSON.stringify(patch)]);
  const versions=await db.query('SELECT id,asset_manifest FROM semologo.logo_versions WHERE brand_id=$1 AND is_current FOR UPDATE',[id]);
  if(versions.rowCount<1)throw Error(id+' current version missing');
  for(const old of versions.rows){
   const prior=old.asset_manifest||{},files=[...(prior.files||[])];
   for(const item of uploads.filter(item=>item.brand===id))if(!files.some(f=>f.key===item.key))files.push(item);
   await db.query("UPDATE semologo.logo_versions SET assets=assets||$2::jsonb,asset_manifest=$3::jsonb,label=$4,source_url=$5,source_note=$6,review_status='verified',verified_at=now() WHERE id=$1",
    [old.id,JSON.stringify(patch),JSON.stringify({...prior,variants:manifest,files}),
     id==='dribbble'?'Dribbble 공식 미디어 키트':'WikiLeaks 공식 사이트 로고',patch.official_source_page,
     id==='dribbble'?'공식 미디어 키트의 글자형·공 심볼 SVG와 투명 PNG. 기존 커뮤니티 변형은 대표 구성에서 제외.':'공식 사이트 헤더의 PNG 원본을 대표로 지정. 2008년 Commons SVG는 CC BY-SA 3.0 아카이브로 보존.']);
  }
 }
 await db.query('COMMIT');console.log('PASS Dribbble and WikiLeaks official representatives published');
}catch(e){await db.query('ROLLBACK');throw e}finally{await db.end()}})().catch(e=>{console.error(e.message);process.exitCode=1});'''
subprocess.run(['ssh', 'vibers', 'docker exec -i semologo node -'], input=script, text=True, check=True)
for brand in ['dribbble', 'wikileaks']:
    raw = json.dumps(release['variants'][brand], ensure_ascii=False).encode()
    s3.put_object(Bucket='vibers-bucket', Key=f'_clients/{brand}/variants.json', Body=raw,
                  ACL='public-read', ContentType='application/json', CacheControl='public,max-age=60')
    assert s3.get_object(Bucket='vibers-bucket', Key=f'_clients/{brand}/variants.json')['Body'].read() == raw
(FOLDER / 'published.json').write_text(json.dumps({'objects': len(uploads), 'brands': ['dribbble', 'wikileaks'],
                                                    'status': 'cdn-and-cms-verified'}, indent=2) + '\n')

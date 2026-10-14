"""Publish the reviewed Blackyak wordmark without losing its existing icon assets."""
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
FOLDER = ROOT / 'marketing/assets/blackyak-official-wordmark-20261014'
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
s3 = boto3.client('s3', endpoint_url='https://kr.object.ncloudstorage.com', region_name='kr-standard', aws_access_key_id=env['NCP_ACCESS_KEY'], aws_secret_access_key=env['NCP_SECRET_KEY'], config=Config(signature_version='s3v4', request_checksum_calculation='when_required', response_checksum_validation='when_required'))
for row in uploads:
    raw = (ROOT / row['file']).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == row['sha256']
    try:
        stored = s3.get_object(Bucket='vibers-bucket', Key=row['key'])['Body'].read()
        assert stored == raw, f'Immutable object changed: {row["key"]}'
    except ClientError as error:
        if error.response['Error']['Code'] not in ('NoSuchKey', '404'):
            raise
        s3.put_object(Bucket='vibers-bucket', Key=row['key'], Body=raw, ACL='public-read', ContentType=mimetypes.guess_type(row['file'])[0], CacheControl='public,max-age=31536000,immutable')
    assert s3.get_object(Bucket='vibers-bucket', Key=row['key'])['Body'].read() == raw
    url = 'https://logo.vibers.co.kr/' + row['key']
    response = subprocess.run(['curl', '--fail', '--silent', '--show-error', '--max-time', '40', url], capture_output=True, check=True)
    assert response.stdout == raw, f'CDN mismatch: {row["key"]}'
print('CDN verified', len(uploads), 'original and derivative objects', flush=True)
script = 'const release=' + json.dumps(release, ensure_ascii=False) + ';const uploads=' + json.dumps(uploads) + ';' + r'''
const {Client}=require('pg');
(async()=>{const db=new Client({connectionString:process.env.DB_VIBERS_MAIN_URL});await db.connect();try{
 await db.query('BEGIN');
 const id='blackyak', patch=release.patches[id], manifest=release.variants[id];
 const post=await db.query('SELECT payload,status FROM semologo.logo_posts WHERE id=$1 FOR UPDATE',[id]);
 if(post.rowCount!==1||post.rows[0].status!=='published')throw Error('Blackyak CMS row missing');
 const prior=post.rows[0].payload.presentation;
 if(prior&&prior.file!=='logo-transparent.png'&&prior.file!==patch.presentation.file&&!prior.file.startsWith('sources/official-blackyak-20261014/'))throw Error('Representative changed concurrently');
 if(manifest.variants.find(v=>v.key==='symbol-transparent')?.files.png!=='logo-transparent.png')throw Error('Symbol preservation failed');
 await db.query("UPDATE semologo.logo_posts SET payload=payload||$2::jsonb,updated_at=now() WHERE id=$1",[id,JSON.stringify(patch)]);
 const versions=await db.query('SELECT id,assets,asset_manifest FROM semologo.logo_versions WHERE brand_id=$1 AND is_current FOR UPDATE',[id]);
 for(const old of versions.rows){
  const before=old.asset_manifest||{}, files=[...(before.files||[])];
  for(const item of uploads)if(!files.some(f=>f.key===item.key))files.push(item);
  await db.query("UPDATE semologo.logo_versions SET assets=assets||$2::jsonb,asset_manifest=$3::jsonb,label=$4,source_url=$5,source_note=$6,review_status='verified',verified_at=now() WHERE id=$1",[old.id,JSON.stringify(patch),JSON.stringify({...before,variants:manifest,files}),'공식 사이트 가로조합 로고 · 투명 PNG 검수',patch.official_source_page,'공식 BYN 블랙야크 벡터와 글로벌몰 PNG를 대조함. 검정 SVG/2400px 투명 PNG는 공식 흰색 벡터의 색상 파생. 기존 야크 심볼과 SVG 원본은 보존.']);
 }
 await db.query('COMMIT');console.log('PASS Blackyak official wordmark and transparent representative published');
}catch(e){await db.query('ROLLBACK');throw e}finally{await db.end()}})().catch(e=>{console.error(e.message);process.exitCode=1});'''
subprocess.run(['ssh', 'vibers', 'docker exec -i semologo node -'], input=script, text=True, check=True)
raw = json.dumps(release['variants']['blackyak'], ensure_ascii=False).encode()
s3.put_object(Bucket='vibers-bucket', Key='_clients/blackyak/variants.json', Body=raw, ACL='public-read', ContentType='application/json', CacheControl='public,max-age=60')
assert s3.get_object(Bucket='vibers-bucket', Key='_clients/blackyak/variants.json')['Body'].read() == raw
(FOLDER / 'published.json').write_text(json.dumps({'objects': len(uploads), 'brand': 'blackyak', 'status': 'cdn-and-cms-verified'}, indent=2) + '\n')

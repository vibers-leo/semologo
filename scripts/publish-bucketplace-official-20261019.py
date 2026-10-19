#!/usr/bin/env python3
"""Publish reviewed Ohouse lockup to the CDN and current CMS version."""
import hashlib
import json
import shlex
import subprocess
from pathlib import Path

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

ROOT = Path(__file__).resolve().parents[1]
OUT = Path('/Volumes/HDD-1TB/semologo-migration/popular-over10-20261019')
release = json.loads((ROOT / 'src/lib/reviewed-popular-refresh-20261019.json').read_text())
patch = release['patches']['bucketplace']
manifest = release['variants']['bucketplace']


def remote(js):
    result = subprocess.run(['ssh', 'vibers', 'docker', 'exec', '-i', 'semologo', 'node', '-'],
                            input=js, text=True, capture_output=True, check=True)
    return result.stdout.strip()


prior = json.loads(remote('''const{Client}=require('pg');(async()=>{const d=new Client({connectionString:process.env.DB_VIBERS_MAIN_URL});await d.connect();try{const q=await d.query("SELECT p.payload,v.asset_manifest FROM semologo.logo_posts p JOIN semologo.logo_versions v ON v.brand_id=p.id AND v.is_current WHERE p.id='bucketplace'");console.log(JSON.stringify(q.rows[0]));}finally{await d.end()}})().catch(e=>{console.error(e.message);process.exitCode=1})'''))
assert prior['payload']['status'] == 'published'
assert prior['payload']['name_ko'] == '오늘의집'

env = {}
for line in Path('/Users/juuuno/Desktop/macminim4/.secrets/보안.env').read_text().splitlines():
    key, sep, value = line.removeprefix('export ').partition('=')
    if sep and key in ('NCP_ACCESS_KEY', 'NCP_SECRET_KEY'):
        env[key] = shlex.split(value, comments=True)[0]
assert len(env) == 2
s3 = boto3.client('s3', endpoint_url='https://kr.object.ncloudstorage.com', region_name='kr-standard',
                  aws_access_key_id=env['NCP_ACCESS_KEY'], aws_secret_access_key=env['NCP_SECRET_KEY'],
                  config=Config(signature_version='s3v4', request_checksum_calculation='when_required',
                                response_checksum_validation='when_required', retries={'max_attempts': 5}))


def publish(key, raw, mime, immutable):
    try:
        old = s3.get_object(Bucket='vibers-bucket', Key=key)['Body'].read()
        if immutable:
            assert old == raw
    except ClientError as error:
        assert error.response['Error']['Code'] in ('404', 'NoSuchKey', 'NotFound')
        old = None
    if old != raw:
        s3.put_object(Bucket='vibers-bucket', Key=key, Body=raw, ACL='public-read', ContentType=mime,
                      CacheControl='public,max-age=31536000,immutable' if immutable else 'public,max-age=60',
                      Metadata={'sha256': hashlib.sha256(raw).hexdigest()})
    assert s3.get_object(Bucket='vibers-bucket', Key=key)['Body'].read() == raw


for ext, mime in [('svg', 'image/svg+xml'), ('png', 'image/png')]:
    path = manifest['variants'][0]['files'][ext]
    raw = (OUT / Path(path).name).read_bytes()
    assert Path(path).name.endswith(hashlib.sha256(raw).hexdigest()[:16] + '.' + ext)
    publish('_clients/bucketplace/' + path, raw, mime, True)

brand = {**prior['payload'], **patch}
for filename, data in [('brand.json', brand), ('variants.json', manifest)]:
    publish('_clients/bucketplace/' + filename,
            (json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n').encode(),
            'application/json', False)

script = 'const patch=' + json.dumps(patch, ensure_ascii=False) + ';const manifest=' + json.dumps(manifest, ensure_ascii=False) + ';' + '''
const{Client}=require('pg');(async()=>{const d=new Client({connectionString:process.env.DB_VIBERS_MAIN_URL});await d.connect();
try{await d.query('BEGIN');const p=await d.query("SELECT id FROM semologo.logo_posts WHERE id='bucketplace' AND status='published' FOR UPDATE");
if(p.rowCount!==1)throw Error('Bucketplace identity changed');
await d.query("UPDATE semologo.logo_posts SET payload=payload||$1::jsonb,updated_at=now() WHERE id='bucketplace'",[JSON.stringify(patch)]);
const v=await d.query("SELECT id FROM semologo.logo_versions WHERE brand_id='bucketplace' AND is_current FOR UPDATE");
if(v.rowCount!==1)throw Error('Bucketplace current version missing');
await d.query("UPDATE semologo.logo_versions SET asset_manifest=$1::jsonb,source_url=$2,source_note=$3,review_status='verified',verified_at=now() WHERE id=$4",
[JSON.stringify({variants:manifest}),'https://www.bucketplace.com/index.html','공식 회사 홈페이지 상단 인라인 SVG의 전체 로고를 색상·형태 변경 없이 사용.',v.rows[0].id]);
await d.query('COMMIT');console.log('PASS official Ohouse lockup published');
}catch(e){await d.query('ROLLBACK');throw e}finally{await d.end()}})().catch(e=>{console.error(e.message);process.exitCode=1});'''
print(remote(script))

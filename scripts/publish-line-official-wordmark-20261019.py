#!/usr/bin/env python3
"""Publish the verified LINE wordmark after prepare-line-official-wordmark."""

import hashlib
import json
import shlex
import subprocess
from pathlib import Path

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

ROOT = Path(__file__).resolve().parents[1]
OUT = Path('/Volumes/HDD-1TB/semologo-migration/kmong-line-20261019')
release = json.loads((ROOT / 'src/lib/reviewed-kmong-line-20261019.json').read_text())
manifest = release['variants']['line']
wordmark = next(v for v in manifest['variants'] if v['key'] == 'official-wordmark')
assert len(manifest['variants']) == 3 and manifest['primary'] == 'official-brand-icon'


def remote(script):
    return subprocess.run(['ssh', 'vibers', 'docker', 'exec', '-i', 'semologo', 'node', '-'],
                          input=script, text=True, capture_output=True, check=True).stdout.strip()


read = '''
const{Client}=require('pg');(async()=>{const db=new Client({connectionString:process.env.DB_VIBERS_MAIN_URL});
await db.connect();try{let q=await db.query("SELECT p.payload,v.asset_manifest FROM semologo.logo_posts p JOIN semologo.logo_versions v ON v.brand_id=p.id AND v.is_current WHERE p.id='line'");
console.log(JSON.stringify(q.rows[0]));}finally{await db.end()}})().catch(e=>{console.error(e.message);process.exitCode=1});'''
prior = json.loads(remote(read))
assert prior['payload']['variants_n'] == 3
assert prior['asset_manifest']['variants']['variants'][-1]['key'] in ('legacy-wordmark', 'official-wordmark')

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


def put(key, raw, mime, immutable):
    try:
        old = s3.get_object(Bucket='vibers-bucket', Key=key)['Body'].read()
        if immutable:
            assert old == raw, f'Existing immutable object differs: {key}'
    except ClientError as error:
        assert error.response['Error']['Code'] in ('404', 'NoSuchKey', 'NotFound')
        old = None
    if old != raw:
        s3.put_object(Bucket='vibers-bucket', Key=key, Body=raw, ACL='public-read', ContentType=mime,
                      CacheControl='public,max-age=31536000,immutable' if immutable else 'public,max-age=60',
                      Metadata={'sha256': hashlib.sha256(raw).hexdigest()})
    assert s3.get_object(Bucket='vibers-bucket', Key=key)['Body'].read() == raw


files = []
for ext, mime in [('svg', 'image/svg+xml'), ('png', 'image/png')]:
    relative = wordmark['files'][ext]
    raw = (OUT / Path(relative).name).read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    assert Path(relative).name.endswith(f'{digest[:16]}.{ext}')
    key = f'_clients/line/{relative}'
    put(key, raw, mime, immutable=True)
    files.append({'key': key, 'file': f'line/{relative}', 'mime': mime,
                  'bytes': len(raw), 'sha256': digest})

brand = {**prior['payload'], **release['patches']['line']}
put('_clients/line/brand.json', (json.dumps(brand, ensure_ascii=False, separators=(',', ':')) + '\n').encode(),
    'application/json', immutable=False)
put('_clients/line/variants.json', (json.dumps(manifest, ensure_ascii=False, separators=(',', ':')) + '\n').encode(),
    'application/json', immutable=False)

asset_manifest = {**prior['asset_manifest'], 'variants': manifest}
existing_keys = {file['key'] for file in asset_manifest.get('files', [])}
asset_manifest['files'] = asset_manifest.get('files', []) + [file for file in files if file['key'] not in existing_keys]
script = 'const patch=' + json.dumps(release['patches']['line'], ensure_ascii=False) + ';const manifest=' + json.dumps(asset_manifest, ensure_ascii=False) + ';' + '''
const{Client}=require('pg');(async()=>{const db=new Client({connectionString:process.env.DB_VIBERS_MAIN_URL});
await db.connect();try{await db.query('BEGIN');
let p=await db.query("SELECT id FROM semologo.logo_posts WHERE id='line' AND status='published' FOR UPDATE");
let v=await db.query("SELECT id FROM semologo.logo_versions WHERE brand_id='line' AND is_current FOR UPDATE");
if(p.rowCount!==1||v.rowCount!==1)throw Error('LINE identity or version changed');
await db.query("UPDATE semologo.logo_posts SET payload=payload||$1::jsonb,updated_at=now() WHERE id='line'",[JSON.stringify(patch)]);
await db.query("UPDATE semologo.logo_versions SET asset_manifest=$1::jsonb,source_note=$2,review_status='verified',verified_at=now() WHERE id=$3",
[JSON.stringify(manifest),'공식 브랜드 아이콘 AI/PNG 및 LINE 상표 가이드(2021) P4의 글자 로고 벡터. 기존 출처 미확인 글자형을 교체.',v.rows[0].id]);
await db.query('COMMIT');console.log('PASS official LINE wordmark published');
}catch(e){await db.query('ROLLBACK');throw e}finally{await db.end()}})().catch(e=>{console.error(e.message);process.exitCode=1});'''
print(remote(script))
print('Verified CDN assets:', len(files), 'and updated brand/variant manifests')

#!/usr/bin/env python3
"""Publish the reviewed Kmong/LINE release to immutable CDN assets and CMS."""
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
uploads = json.loads((OUT / 'uploads.json').read_text())
assert release['snapshot_date'] == '2026-10-19' and len(uploads) == 9


def remote(js):
    result = subprocess.run(['ssh', 'vibers', 'docker', 'exec', '-i', 'semologo', 'node', '-'],
                            input=js, text=True, capture_output=True, check=True)
    return result.stdout.strip()


read = r'''
const{Client}=require('pg');(async()=>{const db=new Client({connectionString:process.env.DB_VIBERS_MAIN_URL});
await db.connect();try{const q=await db.query("SELECT id,status,payload FROM semologo.logo_posts WHERE id=ANY($1::text[])",
[['kmong','line','line--src-364c9cf','line-wordmark']]);console.log(JSON.stringify(q.rows));}
finally{await db.end()}})().catch(e=>{console.error(e.message);process.exitCode=1});'''
prior = {row['id']: row for row in json.loads(remote(read))}
assert 'kmong' not in prior, 'Kmong was added concurrently; inspect before republishing'
assert all(prior[id]['status'] == 'published' for id in ('line', 'line--src-364c9cf', 'line-wordmark'))
assert not prior['line']['payload'].get('hidden')

for row in uploads:
    raw = (OUT / row['file']).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == row['sha256'] and len(raw) == row['bytes']

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


def publish_object(key, raw, mime, immutable=True):
    try:
        old = s3.get_object(Bucket='vibers-bucket', Key=key)['Body'].read()
        if immutable:
            assert old == raw, f'Immutable CDN object changed: {key}'
    except ClientError as error:
        assert error.response['Error']['Code'] in ('404', 'NoSuchKey', 'NotFound')
        old = None
    if old != raw:
        s3.put_object(Bucket='vibers-bucket', Key=key, Body=raw, ACL='public-read', ContentType=mime,
                      CacheControl='public,max-age=31536000,immutable' if immutable else 'public,max-age=60',
                      Metadata={'sha256': hashlib.sha256(raw).hexdigest()})
    assert s3.get_object(Bucket='vibers-bucket', Key=key)['Body'].read() == raw


for row in uploads:
    publish_object(row['key'], (OUT / row['file']).read_bytes(), row['mime'])
for id in ('kmong', 'line'):
    patch = release['patches'][id]
    brand = {**(prior.get(id, {}).get('payload') or {}), **patch, 'id': id, 'status': 'published'}
    for filename, data in (
        ('brand.json', brand), ('variants.json', release['variants'][id]),
    ):
        raw = (json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
        publish_object(f'_clients/{id}/{filename}', raw, 'application/json', immutable=False)
print('CDN verified:', len(uploads), 'immutable files and 4 JSON manifests', flush=True)

script = 'const release=' + json.dumps(release, ensure_ascii=False) + ';const uploads=' + json.dumps(uploads) + ';' + r'''
const{Client}=require('pg');(async()=>{const db=new Client({connectionString:process.env.DB_VIBERS_MAIN_URL});
await db.connect();try{await db.query('BEGIN');
 const ids=['kmong','line','line--src-364c9cf','line-wordmark'];
 const existing=await db.query('SELECT id,status,payload FROM semologo.logo_posts WHERE id=ANY($1::text[]) FOR UPDATE',[ids]);
 const byId=new Map(existing.rows.map(row=>[row.id,row]));
 if(byId.has('kmong')||ids.slice(1).some(id=>byId.get(id)?.status!=='published'))throw Error('Identity changed during review');
 const source={kmong:'https://kmong.com/support/customer-center/posts/37',line:'https://www.line.me/en/logo'};
 for(const id of ['kmong','line']){
  const patch=release.patches[id];
  if(id==='kmong')await db.query("INSERT INTO semologo.logo_posts(id,payload,status) VALUES($1,$2::jsonb,'published')",[id,JSON.stringify({...patch,status:'published'})]);
  else await db.query("UPDATE semologo.logo_posts SET payload=payload||$2::jsonb,updated_at=now() WHERE id=$1 AND status='published'",[id,JSON.stringify(patch)]);
  const manifest=release.variants[id];
  const files=uploads.filter(file=>file.key.startsWith('_clients/'+id+'/'));
  const version=await db.query("SELECT id FROM semologo.logo_versions WHERE brand_id=$1 AND is_current FOR UPDATE",[id]);
  if(version.rowCount!==1)throw Error('Missing current version: '+id);
  await db.query("UPDATE semologo.logo_versions SET asset_manifest=$2::jsonb,label=$3,source_url=$4,source_note=$5,review_status='verified',verified_at=now(),version_kind=$6,introduced_year=$7 WHERE id=$1",
    [version.rows[0].id,JSON.stringify({variants:manifest,files}),id==='kmong'?'2025년 크몽 공식 리브랜딩 로고':'LINE 공식 브랜드 아이콘',source[id],
     id==='kmong'?'2025-10-20 적용. 공식 가이드 PDF의 벡터 글자형과 공식 웹 앱 아이콘을 사용.':'공식 LINE 브랜드 가이드 AI/PNG. 기존 글자형은 별도 출처 미확인으로 보존.',
     id==='kmong'?'brand_redesign':'asset_revision',id==='kmong'?2025:null]);
 }
 for(const id of ids.slice(2)){
  const patch=release.patches[id];
  await db.query('UPDATE semologo.logo_posts SET payload=payload||$2::jsonb,updated_at=now() WHERE id=$1',[id,JSON.stringify(patch)]);
 }
 await db.query('COMMIT');console.log('PASS Kmong published, LINE updated, duplicate identities merged');
}catch(e){await db.query('ROLLBACK');throw e}finally{await db.end()}})().catch(e=>{console.error(e.message);process.exitCode=1});'''
print(remote(script), flush=True)
(OUT / 'published.json').write_text(json.dumps({'status': 'published', 'brands': ['kmong', 'line'],
    'merged': ['line--src-364c9cf', 'line-wordmark'], 'objects': len(uploads)}, indent=2) + '\n')

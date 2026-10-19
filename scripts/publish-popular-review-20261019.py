#!/usr/bin/env python3
"""Publish the official-source checks from the ten-view quality pass."""
import hashlib
import json
import shlex
import subprocess
from pathlib import Path

import boto3
from botocore.config import Config

ROOT = Path(__file__).resolve().parents[1]
release = json.loads((ROOT / 'src/lib/reviewed-popular-refresh-20261019.json').read_text())
patches = {id: release['patches'][id] for id in ('hyundai', 'emart')}
ediya = release['variants']['ediya-coffee']
assert ediya['primary'] == 'official-2025-horizontal'


def remote(js):
    result = subprocess.run(['ssh', 'vibers', 'docker', 'exec', '-i', 'semologo', 'node', '-'],
                            input=js, text=True, capture_output=True, check=True)
    return result.stdout.strip()


prior = json.loads(remote('''const{Client}=require('pg');(async()=>{const d=new Client({connectionString:process.env.DB_VIBERS_MAIN_URL});await d.connect();try{const q=await d.query("SELECT id,payload FROM semologo.logo_posts WHERE id=ANY($1::text[]) AND status='published'",[['hyundai','emart','ediya-coffee']]);console.log(JSON.stringify(q.rows));}finally{await d.end()}})().catch(e=>{console.error(e.message);process.exitCode=1})'''))
prior = {row['id']: row['payload'] for row in prior}
assert set(prior) == {'hyundai', 'emart', 'ediya-coffee'}

env = {}
for line in Path('/Users/juuuno/Desktop/macminim4/.secrets/보안.env').read_text().splitlines():
    key, sep, value = line.removeprefix('export ').partition('=')
    if sep and key in ('NCP_ACCESS_KEY', 'NCP_SECRET_KEY'):
        env[key] = shlex.split(value, comments=True)[0]
assert len(env) == 2
s3 = boto3.client('s3', endpoint_url='https://kr.object.ncloudstorage.com', region_name='kr-standard',
                  aws_access_key_id=env['NCP_ACCESS_KEY'], aws_secret_access_key=env['NCP_SECRET_KEY'],
                  config=Config(signature_version='s3v4', request_checksum_calculation='when_required',
                                response_checksum_validation='when_required'))
for id, patch in patches.items():
    brand = {**prior[id], **patch}
    raw = (json.dumps(brand, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
    s3.put_object(Bucket='vibers-bucket', Key=f'_clients/{id}/brand.json', Body=raw,
                  ACL='public-read', ContentType='application/json', CacheControl='public,max-age=60',
                  Metadata={'sha256': hashlib.sha256(raw).hexdigest()})
raw = (json.dumps(ediya, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
s3.put_object(Bucket='vibers-bucket', Key='_clients/ediya-coffee/variants.json', Body=raw,
              ACL='public-read', ContentType='application/json', CacheControl='public,max-age=60',
              Metadata={'sha256': hashlib.sha256(raw).hexdigest()})

script = 'const patches=' + json.dumps(patches, ensure_ascii=False) + ';const ediya=' + json.dumps(ediya, ensure_ascii=False) + ';' + '''
const{Client}=require('pg');(async()=>{const d=new Client({connectionString:process.env.DB_VIBERS_MAIN_URL});await d.connect();try{await d.query('BEGIN');
for(const [id,patch] of Object.entries(patches)){
const q=await d.query("UPDATE semologo.logo_posts SET payload=payload||$2::jsonb,updated_at=now() WHERE id=$1 AND status='published' RETURNING id",[id,JSON.stringify(patch)]);
if(q.rowCount!==1)throw Error('Missing brand: '+id);
}
const v=await d.query("UPDATE semologo.logo_versions SET asset_manifest=jsonb_set(coalesce(asset_manifest,'{}'::jsonb),'{variants}',$1::jsonb,true) WHERE brand_id='ediya-coffee' AND is_current RETURNING id",[JSON.stringify(ediya)]);
if(v.rowCount!==1)throw Error('Missing Ediya current version');
await d.query('COMMIT');console.log('PASS Hyundai/Emart official sources; Ediya official representative');
}catch(e){await d.query('ROLLBACK');throw e}finally{await d.end()}})().catch(e=>{console.error(e.message);process.exitCode=1});'''
print(remote(script))

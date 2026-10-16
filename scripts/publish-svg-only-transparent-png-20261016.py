#!/usr/bin/env python3
"""Publish the visually reviewed SVG-only PNG companions from the fixed audit.

Default is read-only. --apply uploads only missing/byte-identical objects, verifies
the CDN, then patches existing CMS rows without changing representatives or dates.
"""

import argparse
import hashlib
import io
import json
import re
import shlex
import subprocess
import time
from pathlib import Path

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
AUDIT = ROOT / 'data/collection/svg-only-transparent-png-20261016.json'
BUCKET = 'vibers-bucket'
SECRET = Path('/Users/juuuno/Desktop/macminim4/.secrets/보안.env')
PREFIX = 'sources/svg-only-transparent-20261016'


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def credentials():
    found = {}
    for line in SECRET.read_text().splitlines():
        line = line.removeprefix('export ')
        key, sep, value = line.partition('=')
        if sep and key in {'NCP_ACCESS_KEY', 'NCP_SECRET_KEY'}:
            parsed = shlex.split(value, comments=True)
            found[key] = parsed[0] if parsed else ''
    if not all(found.get(key) for key in ('NCP_ACCESS_KEY', 'NCP_SECRET_KEY')):
        raise RuntimeError('NCP object credentials unavailable')
    return found


def client():
    secret = credentials()
    return boto3.client('s3', endpoint_url='https://kr.object.ncloudstorage.com',
        region_name='kr-standard', aws_access_key_id=secret['NCP_ACCESS_KEY'],
        aws_secret_access_key=secret['NCP_SECRET_KEY'],
        config=Config(signature_version='s3v4', request_checksum_calculation='when_required',
            response_checksum_validation='when_required'))


def current_or_missing(s3, key):
    try:
        return s3.get_object(Bucket=BUCKET, Key=key)['Body'].read()
    except ClientError as error:
        if error.response.get('Error', {}).get('Code') in ('404', 'NoSuchKey', 'NotFound'):
            return None
        raise


def remote_node(script):
    result = subprocess.run(['ssh', 'vibers', 'docker exec -i semologo node -'],
        input=script, text=True, capture_output=True, check=True)
    return json.loads(result.stdout)


def cms_check(ids):
    script = 'const ids=' + json.dumps(ids) + ';' + r'''
const {Pool}=require('pg');
(async()=>{const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});
try{const r=await p.query('SELECT id,status,payload FROM semologo.logo_posts WHERE id=ANY($1)',[ids]);
if(r.rowCount!==ids.length)throw Error('Missing CMS identity');
for(const x of r.rows){const m=x.payload.metadata||{};
if(x.status!=='published'||x.payload.logo_png||x.payload.has_png===true||m.has_png===true)
throw Error('PNG already selected for '+x.id);}
console.log(JSON.stringify({ready:r.rows.map(x=>x.id)}));}finally{await p.end();}})()
.catch(e=>{console.error(e.message);process.exitCode=1});'''
    return remote_node(script)


def cms_apply(updates):
    script = 'const updates=' + json.dumps(updates) + ';' + r'''
const {Pool}=require('pg');
(async()=>{const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});
const c=await p.connect();try{await c.query('BEGIN');
const before=[];
for(const u of updates){const r=await c.query('SELECT status,payload FROM semologo.logo_posts WHERE id=$1 FOR UPDATE',[u.id]);
if(r.rowCount!==1||r.rows[0].status!=='published')throw Error('Missing published identity '+u.id);
const old=r.rows[0].payload,m=old.metadata||{};
if(old.logo_png||old.has_png===true||m.has_png===true)throw Error('PNG already selected for '+u.id);
before.push({id:u.id,logo_png:old.logo_png??null,has_png:old.has_png??null,
preview_png:old.preview_png??null,metadata_has_png:m.has_png??null});
const next={...old,metadata:{...m,has_png:true},logo_png:u.file,preview_png:u.file,
has_png:true,catalog_override:true,asset_review_status:'reviewed-svg-derivative'};
await c.query('UPDATE semologo.logo_posts SET payload=$2::jsonb,updated_at=now() WHERE id=$1',[u.id,JSON.stringify(next)]);}
await c.query('COMMIT');console.log(JSON.stringify({updated:updates.map(u=>u.id),before}));
}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();await p.end();}})()
.catch(e=>{console.error(e.message);process.exitCode=1});'''
    return remote_node(script)


def cdn_bytes(id, relative):
    url = f'https://logo.vibers.co.kr/_clients/{id}/{relative}?v=20261016-svg-png'
    for attempt in range(4):
        result = subprocess.run(['curl', '-fsSL', '--max-time', '30', '-A', 'Mozilla/5.0',
            '-e', 'https://semologo.com/', url], capture_output=True)
        if result.returncode == 0:
            return result.stdout
        time.sleep(attempt + 1)
    raise RuntimeError(f'CDN read failed: {id}/{relative}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    release = json.loads(AUDIT.read_text())
    directory = ROOT / release['assetDirectory']
    rows = release['ready']
    if len({row['id'] for row in rows}) != len(rows):
        raise RuntimeError('Duplicate release identities')
    s3 = client()
    uploads = []
    updates = []
    for row in rows:
        id = row['id']
        if not re.fullmatch(r'[a-z0-9-]+', id):
            raise RuntimeError('Unexpected identity')
        svg = (directory / id / 'original.svg').read_bytes()
        png = (directory / id / 'candidate.png').read_bytes()
        if digest(svg) != row['sourceSha256'] or digest(png) != row['pngSha256']:
            raise RuntimeError('Source/candidate changed: ' + id)
        with Image.open(io.BytesIO(png)) as image:
            rgba = image.convert('RGBA')
            if image.format != 'PNG' or not rgba.getbbox() or rgba.getchannel('A').getextrema()[0] != 0:
                raise RuntimeError('PNG lacks visible transparent artwork: ' + id)
        if current_or_missing(s3, f'_clients/{id}/logo.svg') != svg:
            raise RuntimeError('Published SVG changed: ' + id)
        relative = f'{PREFIX}/{row["pngSha256"][:16]}.png'
        updates.append({'id': id, 'file': relative})
        for file in (relative, 'logo.png', 'logo-transparent.png'):
            key = f'_clients/{id}/{file}'
            prior = current_or_missing(s3, key)
            if prior is not None and prior != png:
                raise RuntimeError('Different existing object: ' + key)
            uploads.append({'id': id, 'key': key, 'bytes': len(png), 'missing': prior is None})
    cms_check([row['id'] for row in rows])
    if not args.apply:
        print(json.dumps({'status': 'ready', 'identities': len(rows), 'objects': len(uploads),
            'missingObjects': sum(item['missing'] for item in uploads)}))
        return
    for item in uploads:
        if not item['missing']:
            continue
        row = next(row for row in rows if row['id'] == item['id'])
        png = (directory / row['id'] / 'candidate.png').read_bytes()
        s3.put_object(Bucket=BUCKET, Key=item['key'], Body=png, ACL='public-read',
            ContentType='image/png', CacheControl=('public,max-age=31536000,immutable'
                if '/sources/' in item['key'] else 'public,max-age=300'),
            Metadata={'sha256': row['pngSha256']})
        if current_or_missing(s3, item['key']) != png:
            raise RuntimeError('Bucket readback mismatch: ' + item['key'])
    for update in updates:
        row = next(row for row in rows if row['id'] == update['id'])
        png = (directory / row['id'] / 'candidate.png').read_bytes()
        if cdn_bytes(row['id'], update['file']) != png:
            raise RuntimeError('CDN byte mismatch: ' + row['id'])
    proof = cms_apply(updates)
    report = {'status': 'published-and-verified', 'updated': proof['updated'],
        'before': proof['before'], 'objects': uploads,
        'pngSha256': {row['id']: row['pngSha256'] for row in rows}}
    (directory / 'published.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'status': report['status'], 'updated': report['updated'],
        'objects': len(uploads)}))


if __name__ == '__main__':
    main()

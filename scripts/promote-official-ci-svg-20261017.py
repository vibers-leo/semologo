#!/usr/bin/env python3
"""Make a visually reviewed official SVG downloadable for an existing PNG brand.

The existing PNG remains the representative image.  The SVG is copied to the
legacy download path only after its reviewed variant is present in the CMS.
"""
import argparse
import hashlib
import json
import re
import runpy
from pathlib import Path

import boto3
from botocore.config import Config

ROOT = Path(__file__).resolve().parents[1]
HELP = runpy.run_path(str(ROOT / 'scripts/publish-commons-taiwan-new-20261017.py'))
BUCKET = 'vibers-bucket'


def current(ids):
    source = 'const ids=' + json.dumps(ids) + ';' + r'''const{Pool}=require('pg');(async()=>{const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});try{const q=await p.query("select p.id,p.payload,v.asset_manifest from semologo.logo_posts p join semologo.logo_versions v on v.brand_id=p.id and v.is_current where p.status='published' and p.id=any($1)",[ids]);console.log(JSON.stringify(q.rows))}finally{await p.end()}})().catch(e=>{console.error(e.message);process.exit(1)})'''
    return HELP['remote_node'](source)


def client():
    secret = HELP['credentials']()
    return boto3.client('s3', endpoint_url='https://kr.object.ncloudstorage.com',
        region_name='kr-standard', aws_access_key_id=secret['NCP_ACCESS_KEY'],
        aws_secret_access_key=secret['NCP_SECRET_KEY'],
        config=Config(signature_version='s3v4',
                      request_checksum_calculation='when_required'))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=Path, required=True)
    parser.add_argument('--assets', type=Path, required=True)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    rows = json.loads(args.manifest.read_text())['items']
    ids = [x['targetBrandId'] for x in rows]
    if len(set(ids)) != len(ids):
        raise ValueError('Duplicate brand')
    live = {x['id']: x for x in current(ids)}
    if set(live) != set(ids):
        raise ValueError('Missing published brand')
    s3 = client()
    prepared = []
    for row in rows:
        ident = row['targetBrandId']
        if not re.fullmatch(r'[a-z0-9-]+', ident) or not row.get('visualReview'):
            raise ValueError('Missing visual identity review')
        raw = (args.assets / row['sourceFile']).read_bytes()
        digest = hashlib.sha256(raw).hexdigest()
        if digest != row['sha256']:
            raise ValueError('Official SVG hash changed: ' + ident)
        post = live[ident]['payload']
        if re.sub(r'[^가-힣a-z0-9]', '', post.get('name_ko', '').lower()) != re.sub(
                r'[^가-힣a-z0-9]', '', row['name'].lower()):
            raise ValueError('Institution name changed: ' + ident)
        metadata = post.get('metadata') or {}
        if metadata.get('has_png') is not True:
            raise ValueError('No existing PNG: ' + ident)
        variants = ((live[ident].get('asset_manifest') or {}).get('variants') or {}).get('variants', [])
        if not any(v.get('source_sha256') == digest and
                   v.get('review_status') == 'verified' and
                   v.get('files', {}).get('svg') for v in variants):
            raise ValueError('Reviewed SVG variant not published: ' + ident)
        existing = HELP['existing'](s3, f'_clients/{ident}/logo.svg')
        if existing is not None and existing != raw:
            raise ValueError('Representative SVG conflict: ' + ident)
        prepared.append((row, raw, post, existing is None))
    print(json.dumps({'ready': len(prepared), 'missingRootSvg': sum(x[3] for x in prepared)}))
    if not args.apply:
        return
    for row, raw, post, missing in prepared:
        ident = row['targetBrandId']
        key = f'_clients/{ident}/logo.svg'
        if missing:
            s3.put_object(Bucket=BUCKET, Key=key, Body=raw, ACL='public-read',
                          ContentType='image/svg+xml',
                          CacheControl='public,max-age=31536000,immutable',
                          Metadata={'sha256': row['sha256']})
        if HELP['existing'](s3, key) != raw:
            raise ValueError('SVG readback failed: ' + ident)
    patches = []
    for row, raw, post, missing in prepared:
        ident = row['targetBrandId']
        metadata = {**(post.get('metadata') or {}), 'has_svg': True}
        after = {**post, 'metadata': metadata, 'has_svg': True,
                 'logo_svg': 'logo.svg', 'logo_png': 'logo.png',
                 'catalog_override': True,
                 'asset_review_status': 'verified-official-vector',
                 'official_source_page': row['sourcePage']}
        patches.append({'id': ident, 'before': post, 'after': after})
    source = 'const rows=' + json.dumps(patches, ensure_ascii=False) + ';' + r'''const{Pool}=require('pg');(async()=>{const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});const c=await p.connect();try{await c.query('BEGIN');for(const x of rows){const q=await c.query("update semologo.logo_posts set payload=$2::jsonb,updated_at=now() where id=$1 and status='published' and payload=$3::jsonb returning id",[x.id,JSON.stringify(x.after),JSON.stringify(x.before)]);if(q.rowCount!==1)throw Error('concurrent_logo_edit:'+x.id)}await c.query('COMMIT');console.log(JSON.stringify({updated:rows.map(x=>x.id)}))}catch(e){await c.query('ROLLBACK');throw e}finally{c.release();await p.end()}})().catch(e=>{console.error(e.message);process.exit(1)})'''
    HELP['remote_node'](source)
    for row, raw, post, missing in prepared:
        ident = row['targetBrandId']
        key = f'_clients/{ident}/brand.json'
        stored = HELP['existing'](s3, key)
        brand = json.loads(stored) if stored else dict(post)
        brand.update({'has_svg': True, 'logo_svg': 'logo.svg'})
        if isinstance(brand.get('metadata'), dict):
            brand['metadata']['has_svg'] = True
        body = (json.dumps(brand, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
        s3.put_object(Bucket=BUCKET, Key=key, Body=body, ACL='public-read',
                      ContentType='application/json', CacheControl='public,max-age=300')
        if HELP['existing'](s3, key) != body:
            raise ValueError('brand.json readback failed: ' + ident)
    print(json.dumps({'promoted': len(prepared), 'representativePngPreserved': True}))


if __name__ == '__main__':
    main()

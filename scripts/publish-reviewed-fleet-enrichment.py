#!/usr/bin/env python3
"""Add manually reviewed first-party artwork to an existing CMS brand.

The current representative and root logo files are preserved. New source files
are immutable; a version row and variants.json gain reviewed variant entries.
"""
import argparse
import hashlib
import io
import json
import re
import runpy
from collections import defaultdict
from pathlib import Path

import boto3
import cairosvg
from botocore.config import Config
from PIL import Image

from logo_variant_enrichment import merge_variant

ROOT = Path(__file__).resolve().parents[1]
HELP = runpy.run_path(str(ROOT / 'scripts/publish-commons-taiwan-new-20261017.py'))
BUCKET = 'vibers-bucket'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def render(row, raw):
    suffix = Path(row['sourceFile']).suffix.lower()
    if suffix == '.svg':
        if len(raw) > 150_000 or not re.search(br'<svg(?:\s|>)', raw[:1000], re.I) or re.search(
                br'<!DOCTYPE|<!ENTITY|<(?:image|script|foreignObject)\b|data:image/|javascript:|'
                br'\bon[a-z]+\s*=|\b(?:xlink:)?href\s*=|@import|url\s*\(', raw, re.I):
            raise ValueError('Unsafe or oversized SVG: ' + row['targetBrandId'])
        preview = cairosvg.svg2png(bytestring=raw, output_width=1200)
        with Image.open(io.BytesIO(preview)) as image:
            if image.width < 128 or image.height < 64:
                raise ValueError('SVG preview too small')
        return {'svg': raw, 'png': preview}
    if suffix == '.png':
        with Image.open(io.BytesIO(raw)) as image:
            if image.format != 'PNG' or getattr(image, 'n_frames', 1) != 1 or min(image.size) < 128:
                raise ValueError('Invalid reviewed PNG')
            image.verify()
        return {'png': raw}
    raise ValueError('Unsupported reviewed source')


def read_current(ids):
    js = 'const ids=' + json.dumps(ids) + ';' + r'''const {Pool}=require('pg');(async()=>{const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});const q=await p.query("select p.id,p.payload,v.id version_id,v.asset_manifest from semologo.logo_posts p join semologo.logo_versions v on v.brand_id=p.id and v.is_current where p.status='published' and p.id=any($1)",[ids]);console.log(JSON.stringify(q.rows));await p.end()})().catch(e=>{console.error(e.message);process.exit(1)})'''
    return HELP['remote_node'](js)


def publish_db(updates):
    js = 'const updates=' + json.dumps(updates, ensure_ascii=False) + ';' + r'''const {Pool}=require('pg');(async()=>{const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});const c=await p.connect();try{await c.query('BEGIN');for(const x of updates){const q=await c.query("update semologo.logo_versions set asset_manifest=$2::jsonb where id=$1 and brand_id=$3 and is_current and asset_manifest is not distinct from $4::jsonb returning id",[x.versionId,JSON.stringify(x.newManifest),x.id,x.oldManifest?JSON.stringify(x.oldManifest):null]);if(q.rowCount!==1)throw Error('Concurrent variant edit: '+x.id)}await c.query('COMMIT');console.log(JSON.stringify({updated:updates.map(x=>x.id)}))}catch(e){await c.query('ROLLBACK');throw e}finally{c.release();await p.end()}})().catch(e=>{console.error(e.message);process.exit(1)})'''
    return HELP['remote_node'](js)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=Path, required=True)
    parser.add_argument('--assets', type=Path, required=True)
    parser.add_argument('--expected-count', type=int, required=True)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    doc = json.loads(args.manifest.read_text())
    rows = doc['items']
    if len(rows) != args.expected_count or not doc.get('identityReview'):
        raise ValueError('Reviewed count and identity evidence required')
    grouped = defaultdict(list)
    objects = []
    for row in rows:
        ident = row['targetBrandId']
        if not re.fullmatch(r'[a-z0-9-]+', ident) or not row.get('visualReview') or \
                row.get('form') not in ('symbol', 'horizontal', 'vertical', 'wordmark'):
            raise ValueError('Explicit visual review and form required')
        source = args.assets / row['sourceFile']
        if source.name != row['sourceFile']:
            raise ValueError('Invalid source filename')
        raw = source.read_bytes()
        if sha(raw) != row['sha256']:
            raise ValueError('Source hash changed')
        rendered = render(row, raw)
        prefix = 'sources/fleet-reviewed/' + row['sha256'][:20]
        files = {}
        for kind, body in rendered.items():
            file = prefix + ('-preview.png' if kind == 'png' and 'svg' in rendered else '.' + kind)
            files[kind] = file
            objects.append((f'_clients/{ident}/{file}', body,
                            'image/svg+xml' if kind == 'svg' else 'image/png'))
        grouped[ident].append({'key': 'fleet-reviewed-' + row['sha256'][:12],
            'form': row['form'], 'lockup': row['form'], 'lang': row.get('lang', 'unknown'),
            'color': row.get('color', 'original'), 'label': row['label'], 'files': files,
            'preview_png': files['png'], 'provider': 'first-party-web', 'origin': 'first-party-web',
            'source_url': row['sourcePage'], 'source_sha256': row['sha256'],
            'visual_sha256': sha(rendered['png']), 'review_status': 'verified'})
    current = read_current(list(grouped))
    if {x['id'] for x in current} != set(grouped):
        raise ValueError('Existing published target missing')
    secret = HELP['credentials']()
    s3 = boto3.client('s3', endpoint_url='https://kr.object.ncloudstorage.com', region_name='kr-standard',
        aws_access_key_id=secret['NCP_ACCESS_KEY'], aws_secret_access_key=secret['NCP_SECRET_KEY'],
        config=Config(signature_version='s3v4'))
    updates = []
    for item in current:
        ident = item['id']
        bucket_manifest = HELP['existing'](s3, f'_clients/{ident}/variants.json')
        original = (item.get('asset_manifest') or {}).get('variants')
        if bucket_manifest:
            from_bucket = json.loads(bucket_manifest)
            if not isinstance(from_bucket.get('variants'), list):
                raise ValueError('Malformed existing bucket manifest: ' + ident)
            if original and original != from_bucket:
                raise ValueError('DB and bucket variants disagree: ' + ident)
            original = from_bucket
        if not isinstance(original, dict):
            files = {}
            for kind in ('svg', 'png'):
                if HELP['existing'](s3, f'_clients/{ident}/logo.{kind}') is not None:
                    files[kind] = 'logo.' + kind
            if not files:
                raise ValueError('Existing representative files missing: ' + ident)
            original = {'schema': 1, 'algo_v': 1, 'id': ident, 'primary': 'existing-original',
                'variants': [{'key': 'existing-original', 'form': 'unknown', 'label': '기존 대표 원본',
                    'files': files, 'order': 0, 'review_status': 'legacy-unreviewed'}]}
        if original.get('id') != ident:
            raise ValueError('Existing manifest identity mismatch: ' + ident)
        merged = json.loads(json.dumps(original))
        for variant in grouped[ident]:
            merge_variant(merged, variant)
        new_manifest = {**(item.get('asset_manifest') or {}), 'variants': merged}
        if bucket_manifest is not None and item.get('asset_manifest') == new_manifest and original == merged:
            continue
        updates.append({'id': ident, 'versionId': item['version_id'],
                        'oldManifest': item.get('asset_manifest'),
                        'newManifest': new_manifest, 'variants': merged})
    if not updates:
        print(json.dumps({'status': 'already_current', 'existingBrands': len(current),
                          'reviewedVariants': len(rows)}))
        return
    if not args.apply:
        print(json.dumps({'status': 'ready', 'existingBrands': len(updates),
                          'reviewedVariants': len(rows), 'immutableObjects': len(objects)}))
        return
    for key, body, mime in objects:
        prior = HELP['existing'](s3, key)
        if prior is None:
            s3.put_object(Bucket=BUCKET, Key=key, Body=body, ACL='public-read', ContentType=mime,
                          CacheControl='public,max-age=31536000,immutable', Metadata={'sha256': sha(body)})
        elif prior != body:
            raise ValueError('Immutable source conflict: ' + key)
        if HELP['existing'](s3, key) != body:
            raise ValueError('Bucket source readback mismatch: ' + key)
    publish_db(updates)
    for update in updates:
        key = f'_clients/{update["id"]}/variants.json'
        body = (json.dumps(update['variants'], ensure_ascii=False, separators=(',', ':')) + '\n').encode()
        s3.put_object(Bucket=BUCKET, Key=key, Body=body, ACL='public-read',
                      ContentType='application/json', CacheControl='public,max-age=300')
        if HELP['existing'](s3, key) != body:
            raise ValueError('Variant manifest readback mismatch: ' + update['id'])
    print(json.dumps({'status': 'published', 'existingBrands': len(updates),
                      'reviewedVariants': len(rows), 'verifiedObjects': len(objects) + len(updates)}))


if __name__ == '__main__':
    main()

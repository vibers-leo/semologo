#!/usr/bin/env python3
"""Replace two reviewed CMS previews with faithful, transparent SVG variants.

The first-party source stays available as an archive variant. Dry-run by default.
"""
import argparse
import hashlib
import io
import json
import os
import shlex
import subprocess
from pathlib import Path

import boto3
import cairosvg
from botocore.config import Config
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'data/collection/logo-quality-repair-20261017-assets'
SECRET = Path('/Users/juuuno/Desktop/macminim4/.secrets/보안.env')
CDN = 'https://logo.vibers.co.kr/_clients'
BUCKET = 'vibers-bucket'
ROWS = (
    ('delpha', ROOT / 'data/collection/windows-domain-followup-20261017-assets/delpha.svg', 'delpha'),
    ('packet-clearing-house', ROOT / 'data/collection/mac-tranco-followup-20261017-assets/packet-clearing-house.svg', 'pch'),
)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def remote_node(source):
    run = subprocess.run(['ssh', 'vibers', 'docker exec -i semologo node -'],
                         input=source, text=True, capture_output=True, check=True)
    return json.loads(run.stdout)


def current():
    js = r'''const{Pool}=require('pg');(async()=>{const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});try{const q=await p.query("SELECT p.id,p.payload,v.asset_manifest FROM semologo.logo_posts p JOIN semologo.logo_versions v ON v.brand_id=p.id AND v.is_current WHERE p.id=ANY($1::text[])",[['delpha','packet-clearing-house']]);console.log(JSON.stringify(q.rows))}finally{await p.end()}})().catch(e=>{console.error(e.message);process.exitCode=1})'''
    return {row['id']: row for row in remote_node(js)}


def credentials():
    found = {k: os.environ.get(k, '') for k in ('NCP_ACCESS_KEY', 'NCP_SECRET_KEY')}
    if not all(found.values()):
        for line in SECRET.read_text().splitlines():
            key, sep, value = line.removeprefix('export ').partition('=')
            if sep and key in found:
                words = shlex.split(value, comments=True)
                found[key] = words[0] if words else ''
    if not all(found.get(k) for k in ('NCP_ACCESS_KEY', 'NCP_SECRET_KEY')):
        raise RuntimeError('Central bucket credentials unavailable')
    return found


def render(raw):
    png = cairosvg.svg2png(bytestring=raw, output_width=1200)
    with Image.open(io.BytesIO(png)) as image:
        assert image.width == 1200 and image.getchannel('A').getextrema() == (0, 255)
    return png


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    db = current()
    assert len(db) == 2
    changes, objects, audit = [], [], []
    for ident, source_path, prefix in ROWS:
        record = db[ident]
        brand = record['payload'].copy()
        manifest = record['asset_manifest']['variants'].copy()
        source_variant = manifest['variants'][0].copy()
        assert source_variant['key'] == 'source-reviewed' and manifest['primary'] == 'source-reviewed'
        assert brand['logo_png'] == 'logo.png' and brand['logo_svg'] == 'logo.svg'
        source_svg = source_path.read_bytes()
        assert digest(source_svg) == source_variant['source_sha256']
        clean_svg = (ASSETS / f'{prefix}-clean.svg').read_bytes()
        dark_svg = (ASSETS / f'{prefix}-dark.svg').read_bytes()
        clean_png, dark_png = render(clean_svg), render(dark_svg)
        names = {'source_svg': 'logo-source-20261017.svg',
                 'source_png': 'logo-source-20261017.png',
                 'clean_svg': 'logo-clean-20261017.svg',
                 'clean_png': 'logo-clean-20261017.png',
                 'dark_svg': 'logo-dark-20261017.svg',
                 'dark_png': 'logo-dark-20261017.png'}
        source_png = render(source_svg)
        assert digest(source_png) == source_variant['visual_sha256']
        for key, raw, mime in [
            (names['source_svg'], source_svg, 'image/svg+xml'),
            (names['source_png'], source_png, 'image/png'),
            (names['clean_svg'], clean_svg, 'image/svg+xml'),
            (names['clean_png'], clean_png, 'image/png'),
            (names['dark_svg'], dark_svg, 'image/svg+xml'),
            (names['dark_png'], dark_png, 'image/png'),
            ('logo.svg', clean_svg, 'image/svg+xml'),
            ('logo.png', clean_png, 'image/png'),
            ('logo-transparent.png', clean_png, 'image/png'),
        ]:
            objects.append((f'_clients/{ident}/{key}', raw, mime))
        source_variant['files'] = {'svg': names['source_svg'], 'png': names['source_png']}
        source_variant['preview_png'] = names['source_png']
        source_variant['label'] = '공식 원본 벡터'
        source_variant['order'] = 2
        def variant(key, label, color, svg_name, png_name, order, svg, png):
            return {'key': key, 'form': 'horizontal', 'lockup': 'horizontal', 'lang': 'mixed',
                    'color': color, 'label': label, 'files': {'svg': svg_name, 'png': png_name},
                    'preview_png': png_name, 'origin': 'official-vector-derived',
                    'provider': 'first-party-web', 'source_url': brand['source_url'],
                    'source_sha256': digest(svg), 'visual_sha256': digest(png),
                    'review_status': 'verified', 'order': order}
        label = '배경 제거·가로 조합형' if ident == 'delpha' else '공식 글자 요소·가로 조합형'
        manifest['primary'] = 'clean-official-elements'
        manifest['variants'] = [
            variant('clean-official-elements', label, 'original', names['clean_svg'], names['clean_png'], 0, clean_svg, clean_png),
            variant('clean-official-elements-dark', '검정 배경용', 'white', names['dark_svg'], names['dark_png'], 1, dark_svg, dark_png),
            source_variant,
        ]
        brand.update({'logo_svg': names['clean_svg'], 'svg_transparent': names['clean_svg'],
                      'logo_png': names['clean_png'], 'dark_png': names['dark_png'],
                      'preview_png': f'{CDN}/{ident}/{names["clean_png"]}',
                      'asset_review_status': 'reviewed-first-party-vector',
                      'rejected_asset_files': ['logo.png', 'logo-transparent.png']})
        changes.append({'id': ident, 'brand': brand, 'manifest': manifest})
        objects.extend([
            (f'_clients/{ident}/brand.json', (json.dumps(brand, ensure_ascii=False, separators=(',', ':')) + '\n').encode(), 'application/json'),
            (f'_clients/{ident}/variants.json', (json.dumps(manifest, ensure_ascii=False, separators=(',', ':')) + '\n').encode(), 'application/json'),
        ])
        audit.append({'id': ident, 'source_sha256': digest(source_svg),
                      'clean_svg_sha256': digest(clean_svg), 'clean_png_sha256': digest(clean_png),
                      'dark_svg_sha256': digest(dark_svg), 'dark_png_sha256': digest(dark_png),
                      'old_brand': record['payload'], 'old_manifest': record['asset_manifest']['variants']})
    receipt = ROOT / 'data/collection/logo-quality-repair-20261017.json'
    if not args.apply:
        print(json.dumps({'status': 'ready', 'brands': [x['id'] for x in changes], 'objects': len(objects)}))
        return
    secret = credentials()
    s3 = boto3.client('s3', endpoint_url='https://kr.object.ncloudstorage.com',
        region_name='kr-standard', aws_access_key_id=secret['NCP_ACCESS_KEY'],
        aws_secret_access_key=secret['NCP_SECRET_KEY'], config=Config(signature_version='s3v4'))
    for key, raw, mime in objects:
        # Versioned files are immutable. Legacy aliases and JSON are deliberately updated.
        previous = None
        try: previous = s3.get_object(Bucket=BUCKET, Key=key)['Body'].read()
        except s3.exceptions.NoSuchKey: pass
        if previous is not None and previous != raw and key.rsplit('/', 1)[-1] not in {'logo.svg', 'logo.png', 'logo-transparent.png', 'brand.json', 'variants.json'}:
            raise RuntimeError('Versioned asset conflict: ' + key)
        if previous != raw:
            s3.put_object(Bucket=BUCKET, Key=key, Body=raw, ACL='public-read',
                          ContentType=mime, CacheControl='public,max-age=300', Metadata={'sha256': digest(raw)})
        assert s3.get_object(Bucket=BUCKET, Key=key)['Body'].read() == raw
    for row in changes:
        for file in (row['brand']['logo_svg'], row['brand']['logo_png'], row['brand']['dark_png']):
            url = f'{CDN}/{row["id"]}/{file}?v=20261017-quality'
            got = subprocess.run(['curl', '-fsSL', '--max-time', '30', '-A', 'Mozilla/5.0',
                '-e', 'https://semologo.com/', url], capture_output=True, check=True).stdout
            expected = next(raw for key, raw, _ in objects if key == f'_clients/{row["id"]}/{file}')
            assert got == expected, 'CDN mismatch: ' + url
    js = 'const xs=' + json.dumps(changes, ensure_ascii=False) + ';' + r'''
const{Pool}=require('pg');(async()=>{const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});const c=await p.connect();try{await c.query('BEGIN');for(const x of xs){const q=await c.query("UPDATE semologo.logo_posts SET payload=$2::jsonb WHERE id=$1 AND status='published' AND payload->>'logo_png'='logo.png' RETURNING id",[x.id,JSON.stringify(x.brand)]);if(q.rowCount!==1)throw Error('Concurrent brand change '+x.id);const v=await c.query("UPDATE semologo.logo_versions SET asset_manifest=$2::jsonb,review_status='verified',verified_at=now() WHERE brand_id=$1 AND is_current AND asset_manifest->'variants'->>'primary'='source-reviewed' RETURNING id",[x.id,JSON.stringify({variants:x.manifest})]);if(v.rowCount!==1)throw Error('Concurrent variant change '+x.id)}await c.query('COMMIT');console.log(JSON.stringify({updated:xs.map(x=>x.id)}))}catch(e){await c.query('ROLLBACK');throw e}finally{c.release();await p.end()}})().catch(e=>{console.error(e.message);process.exitCode=1})'''
    updated = remote_node(js)
    receipt.write_text(json.dumps({'status': 'published-and-cdn-verified', 'updated': updated['updated'],
                                   'audit': audit}, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'status': 'published', 'updated': updated['updated'], 'objects': len(objects)}))


if __name__ == '__main__':
    main()

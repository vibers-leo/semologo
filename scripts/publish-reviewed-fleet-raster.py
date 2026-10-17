#!/usr/bin/env python3
"""Publish visually reviewed first-party PNG/WebP logos as honest PNG-only CMS entries."""
import argparse
import hashlib
import io
import json
import re
import runpy
import subprocess
from datetime import datetime, timezone
from pathlib import Path

import boto3
from botocore.config import Config
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
BUCKET = 'vibers-bucket'
CDN = 'https://logo.vibers.co.kr/_clients'
HELP = runpy.run_path(str(ROOT / 'scripts/publish-commons-taiwan-new-20261017.py'))


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def make_png(source, row):
    with Image.open(io.BytesIO(source)) as opened:
        if getattr(opened, 'n_frames', 1) != 1:
            raise ValueError('Animated raster requires review: ' + row['id'])
        image = ImageOps.exif_transpose(opened).convert('RGBA')
    if image.size != (row['width'], row['height']) or image.width < 400 or image.height < 80:
        raise ValueError('Raster dimensions changed or too small: ' + row['id'])
    alpha = image.getchannel('A')
    if alpha.getextrema() != (0, 255):
        raise ValueError('Opaque or partial-alpha canvas: ' + row['id'])
    # A transparent one-pixel rim can disguise an embedded white rectangle.
    sample = image.copy()
    sample.thumbnail((400, 400))
    pixels = list(sample.get_flattened_data())
    opaque = sum(a >= 250 for _, _, _, a in pixels)
    white = sum(a >= 250 and min(r, g, b) >= 245 for r, g, b, a in pixels)
    if opaque / len(pixels) > .80 and white / len(pixels) > .50:
        raise ValueError('Likely embedded white backdrop: ' + row['id'])
    box = alpha.getbbox()
    if not box:
        raise ValueError('Empty raster: ' + row['id'])
    image = image.crop(box)
    pad = max(4, round(max(image.size) * .03))
    canvas = Image.new('RGBA', (image.width + 2 * pad, image.height + 2 * pad), (0, 0, 0, 0))
    canvas.alpha_composite(image, (pad, pad))
    output = io.BytesIO()
    canvas.save(output, format='PNG', optimize=True)
    return output.getvalue()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=Path, required=True)
    parser.add_argument('--assets', type=Path, required=True)
    parser.add_argument('--expected-count', type=int, required=True)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    rows = json.loads(args.manifest.read_text())['items']
    if len(rows) != args.expected_count or len({r['id'] for r in rows}) != len(rows):
        raise ValueError('Batch count or IDs changed')
    now = datetime.now(timezone.utc).isoformat()
    prepared, objects = [], []
    for row in rows:
        ident = row['id']
        if not re.fullmatch(r'[a-z0-9-]+', ident) or Path(row['sourceFile']).name != row['sourceFile']:
            raise ValueError('Invalid reviewed identity')
        source = (args.assets / row['sourceFile']).read_bytes()
        if sha(source) != row['sha256'] or len(source) > 1_000_000:
            raise ValueError('Source bytes changed: ' + ident)
        png = make_png(source, row)
        brand = {'id': ident, 'name_ko': row['name'], 'name_en': row['name'],
            'category': row['category'], 'origin': 'KR' if row['domain'].endswith('.kr') else 'GLOBAL',
            'has_svg': False, 'has_png': True, 'logo_png': 'logo.png',
            'preview_png': f'{CDN}/{ident}/logo.png', 'website': row['website'],
            'domain': row['domain'], 'source_url': row['sourcePage'],
            'asset_origin': 'First-party website raster; Windows fleet discovered, Mac visually reviewed',
            'asset_review_status': 'reviewed-first-party-raster',
            'added_at': now[:10], 'logo_published_at': now}
        variant = {'schema': 1, 'algo_v': 1, 'id': ident, 'primary': 'source-reviewed',
            'variants': [{'key': 'source-reviewed', 'form': row.get('form', 'horizontal'),
                'lockup': row.get('form', 'horizontal'), 'lang': 'mixed', 'color': 'original',
                'label': '원본 이미지', 'files': {'png': 'logo.png'},
                'preview_png': 'logo.png', 'origin': 'first-party-web',
                'provider': 'first-party-web', 'source_url': row['sourcePage'],
                'source_sha256': sha(source), 'visual_sha256': sha(png),
                'review_status': 'verified', 'order': 0}]}
        prepared.append({'id': ident, 'name': row['name'], 'brand': brand, 'variants': variant})
        for name, raw, mime in [('logo.png', png, 'image/png'),
                ('logo-transparent.png', png, 'image/png'),
                ('brand.json', (json.dumps(brand, ensure_ascii=False, separators=(',', ':'))+'\n').encode(), 'application/json'),
                ('variants.json', (json.dumps(variant, ensure_ascii=False, separators=(',', ':'))+'\n').encode(), 'application/json')]:
            objects.append((f'_clients/{ident}/{name}', raw, mime))
    HELP['db_check'](rows)
    base = json.loads((ROOT / 'marketing/assets/bulk-source-pilot-20261017/brands-slim.json').read_text())
    base = base.get('brands', base) if isinstance(base, dict) else base
    if {p['id'] for p in prepared}.intersection(x['id'] for x in base):
        raise ValueError('Static catalog ID collision')
    if not args.apply:
        print(json.dumps({'status': 'ready', 'newBrands': len(prepared), 'objects': len(objects)}))
        return
    secret = HELP['credentials']()
    s3 = boto3.client('s3', endpoint_url='https://kr.object.ncloudstorage.com', region_name='kr-standard',
        aws_access_key_id=secret['NCP_ACCESS_KEY'], aws_secret_access_key=secret['NCP_SECRET_KEY'],
        config=Config(signature_version='s3v4'))
    for key, raw, mime in objects:
        prior = HELP['existing'](s3, key)
        if prior is None:
            s3.put_object(Bucket=BUCKET, Key=key, Body=raw, ACL='public-read',
                ContentType=mime, CacheControl='public,max-age=300', Metadata={'sha256': sha(raw)})
        elif prior != raw:
            raise ValueError('Existing public asset conflict: ' + key)
        if HELP['existing'](s3, key) != raw:
            raise ValueError('Bucket readback mismatch: ' + key)
    for row in prepared:
        for name in ('logo.png', 'brand.json'):
            url = f'{CDN}/{row["id"]}/{name}?v=20261017-fleet-raster'
            response = subprocess.run(['curl', '-fsSL', '--max-time', '30', '-A', 'Mozilla/5.0',
                '-e', 'https://semologo.com/', url], capture_output=True, check=True)
            expected = next(raw for key, raw, _ in objects if key == f'_clients/{row["id"]}/{name}')
            if response.stdout != expected:
                raise ValueError('CDN readback mismatch: ' + row['id'])
    result = HELP['db_publish'](prepared)
    print(json.dumps({'status': 'published', 'ids': result['published'], 'verifiedObjects': len(objects)}))


if __name__ == '__main__':
    main()

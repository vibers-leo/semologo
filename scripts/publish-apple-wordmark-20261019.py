#!/usr/bin/env python3
"""Publish an Apple text-only crop of the existing vector lockup, plus its PNG previews."""
import hashlib
import io
import json
import runpy
from pathlib import Path

import boto3
import cairosvg
from botocore.config import Config
from botocore.exceptions import ClientError
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = Path('/Volumes/HDD-1TB/semologo-migration/apple-wordmark-20261019')
BUCKET = 'vibers-bucket'
publisher = runpy.run_path(str(ROOT / 'scripts/publish-svg-background-audit-20261014.py'))
values = publisher['secrets']()
s3 = boto3.client('s3', endpoint_url='https://kr.object.ncloudstorage.com', region_name='kr-standard',
    aws_access_key_id=values['NCP_ACCESS_KEY'], aws_secret_access_key=values['NCP_SECRET_KEY'],
    config=Config(signature_version='s3v4', request_checksum_calculation='when_required',
                  response_checksum_validation='when_required'))

original = s3.get_object(Bucket=BUCKET, Key='_clients/apple/sources/vlz/wide.svg')['Body'].read()
assert hashlib.sha256(original).hexdigest().startswith('a50774a643cca306c0eb'), 'Apple source changed; re-review before publishing'
assert original.count(b'width="120" height="60"') == 1
wordmark = original.replace(b'width="120" height="60"',
    b'width="72" height="42" viewBox="42 8 72 42"', 1)

def tight_png(svg: bytes) -> bytes:
    rendered = cairosvg.svg2png(bytestring=svg, output_width=1200)
    image = Image.open(io.BytesIO(rendered)).convert('RGBA')
    bbox = image.getchannel('A').getbbox()
    assert bbox and bbox[2] - bbox[0] > 200 and bbox[3] - bbox[1] > 100
    output = io.BytesIO()
    image.crop(bbox).save(output, format='PNG', optimize=True)
    return output.getvalue()

assets = {'horizontal.png': tight_png(original), 'wordmark.svg': wordmark,
          'wordmark.png': tight_png(wordmark)}
ARCHIVE.mkdir(parents=True, exist_ok=True)
(ARCHIVE / 'source-wide.svg').write_bytes(original)
files = {}
for name, data in assets.items():
    (ARCHIVE / name).write_bytes(data)
    digest = hashlib.sha256(data).hexdigest()
    relative = f'sources/reviewed-apple-wordmark-20261019/{digest[:20]}.{name.split(".")[-1]}'
    key = f'_clients/apple/{relative}'
    try:
        old = s3.get_object(Bucket=BUCKET, Key=key)['Body'].read()
        assert old == data, f'immutable object differs: {key}'
    except ClientError as error:
        if error.response.get('Error', {}).get('Code') not in ('404', 'NoSuchKey', 'NotFound'):
            raise
        s3.put_object(Bucket=BUCKET, Key=key, Body=data, ACL='public-read',
            ContentType='image/svg+xml' if name.endswith('.svg') else 'image/png',
            CacheControl='public,max-age=31536000,immutable', Metadata={'sha256': digest})
        assert s3.get_object(Bucket=BUCKET, Key=key)['Body'].read() == data
    files[name] = relative

manifest_key = '_clients/apple/variants.json'
manifest = json.loads(s3.get_object(Bucket=BUCKET, Key=manifest_key)['Body'].read())
assert manifest['id'] == 'apple'
horizontal = next(item for item in manifest['variants'] if item['key'] == 'horizontal')
assert horizontal['files']['svg'] == 'sources/vlz/wide.svg'
assert not horizontal['files'].get('png') or horizontal['files']['png'] == files['horizontal.png']
horizontal['files']['png'] = files['horizontal.png']
incoming = {'key': 'wordmark-derived-20261019', 'form': 'wordmark', 'lockup': 'wordmark',
    'lang': 'en', 'color': 'mono-dark', 'label': 'Apple 글자형 · 가로형에서 분리',
    'files': {'svg': files['wordmark.svg'], 'png': files['wordmark.png']},
    'provider': '기존 VectorLogoZone 가로형 자산', 'origin': 'derived',
    'derived_from': 'horizontal', 'source_sha256': hashlib.sha256(original).hexdigest(), 'order': 40}
existing = next((item for item in manifest['variants'] if item['key'] == incoming['key']), None)
if existing:
    assert existing['files'] == incoming['files'], 'existing Apple wordmark differs'
else:
    manifest['variants'].append(incoming)
manifest.setdefault('fingerprint', {}).update({path: hashlib.sha256(assets[name]).hexdigest()[:16]
    for name, path in files.items()})
raw = (json.dumps(manifest, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
s3.put_object(Bucket=BUCKET, Key=manifest_key, Body=raw, ACL='public-read',
    ContentType='application/json', CacheControl='public,max-age=60')
assert s3.get_object(Bucket=BUCKET, Key=manifest_key)['Body'].read() == raw

db = publisher['database'](values['DB_VIBERS_MAIN_URL'])
with db, db.cursor() as cursor:
    cursor.execute("SELECT id,asset_manifest FROM semologo.logo_versions WHERE brand_id='apple' AND is_current FOR UPDATE")
    version = cursor.fetchone()
    assert version, 'Apple CMS version missing'
    container = dict(version[1] or {})
    container['variants'] = manifest
    cursor.execute('UPDATE semologo.logo_versions SET asset_manifest=%s::jsonb WHERE id=%s',
        (json.dumps(container, ensure_ascii=False), version[0]))
    cursor.execute("UPDATE semologo.logo_posts SET payload=payload||%s::jsonb,updated_at=now() WHERE id='apple'",
        (json.dumps({'variants_n': len(manifest['variants'])}),))
db.close()
(ARCHIVE / 'manifest.json').write_bytes(raw)
print(json.dumps({'id': 'apple', 'variants': [v['key'] for v in manifest['variants']], 'files': files}, ensure_ascii=False))

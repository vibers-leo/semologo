#!/usr/bin/env python3
"""Publish reviewed Nashville/Rolex composition manifests; preserve originals."""
import hashlib
import json
import runpy
from pathlib import Path

import boto3
from botocore.config import Config

from logo_variant_enrichment import merge_variant, coverage

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'marketing/assets/example-compositions-20261014'
OUT.mkdir(parents=True, exist_ok=True)
publisher = runpy.run_path(str(ROOT / 'scripts/publish-svg-background-audit-20261014.py'))
values = publisher['secrets']()
db = publisher['database'](values['DB_VIBERS_MAIN_URL'])
s3 = boto3.client('s3', endpoint_url='https://kr.object.ncloudstorage.com', region_name='kr-standard',
    aws_access_key_id=values['NCP_ACCESS_KEY'], aws_secret_access_key=values['NCP_SECRET_KEY'],
    config=Config(signature_version='s3v4', request_checksum_calculation='when_required',
                  response_checksum_validation='when_required'))

ids = ('nashville-predators', 'rolex--src-9d16245')
reports = []
for ident in ids:
    with db.cursor() as cursor:
        cursor.execute('SELECT id,asset_manifest FROM semologo.logo_versions WHERE brand_id=%s AND is_current', (ident,))
        version = cursor.fetchone()
        cursor.execute('SELECT png_file,svg_file FROM semologo.logo_background_previews WHERE id=%s', (ident,))
        background = cursor.fetchone()
    assert version and background, ident
    container = version[1] or {}
    manifest = container.get('variants') or {'schema': 1, 'algo_v': 1, 'id': ident,
        'primary': 'legacy-original', 'variants': [{'key': 'legacy-original', 'form': 'unknown',
        'lang': 'unknown', 'color': 'original', 'label': '기존 수집 원본 · 제작 시기 미확인',
        'files': {'svg': 'logo.svg'}, 'origin': 'collected', 'order': 0}]}
    key = 'transparent-wordmark-20261014' if ident == ids[0] else 'transparent-vertical-20261014'
    merge_variant(manifest, {'key': key, 'form': 'wordmark' if ident == ids[0] else 'vertical',
        'lockup': 'wordmark' if ident == ids[0] else 'vertical', 'lang': 'en', 'color': 'original',
        'label': '기존 SVG 배경 제거 · 제작 시기 미확인',
        'files': {'svg': background[1], 'png': background[0]},
        'origin': 'derived', 'derived_from': 'logo.svg', 'order': len(manifest['variants'])})
    if ident == ids[0]:
        assert any(v['key'] == 'official-nhl-20261012' for v in manifest['variants'])
        manifest['primary'] = 'official-nhl-20261012'
    else:
        manifest['primary'] = key
    manifest_bytes = (json.dumps(manifest, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
    (OUT / (ident + '-variants.json')).write_bytes(manifest_bytes)
    # The manifest is a short-lived mutable pointer; every SVG/PNG remains immutable.
    s3.put_object(Bucket='vibers-bucket', Key=f'_clients/{ident}/variants.json',
        Body=manifest_bytes, ACL='public-read', ContentType='application/json',
        CacheControl='public,max-age=60')
    saved = s3.get_object(Bucket='vibers-bucket', Key=f'_clients/{ident}/variants.json')['Body'].read()
    assert hashlib.sha256(saved).digest() == hashlib.sha256(manifest_bytes).digest()
    with db, db.cursor() as cursor:
        cursor.execute('UPDATE semologo.logo_versions SET asset_manifest=%s::jsonb WHERE id=%s',
            (json.dumps({**container, 'variants': manifest}, ensure_ascii=False), version[0]))
        patch = {'variants_n': len(manifest['variants'])}
        if ident == ids[0]:
            official = next(v for v in manifest['variants'] if v['key'] == manifest['primary'])
            patch['presentation'] = {'file': official['files']['png'], 'bg': 'light'}
        cursor.execute('UPDATE semologo.logo_posts SET payload=payload||%s::jsonb,updated_at=now() WHERE id=%s',
            (json.dumps(patch), ident))
    reports.append({'id': ident, 'coverage': coverage(manifest), 'primary': manifest['primary']})
db.close()
(OUT / 'published.json').write_text(json.dumps(reports, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(reports, ensure_ascii=False))

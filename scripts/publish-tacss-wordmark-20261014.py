#!/usr/bin/env python3
"""Add a reviewed wordmark crop from TACSS's official CI Illustrator file."""
import hashlib
import json
import runpy
from pathlib import Path

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from logo_variant_enrichment import coverage, merge_variant

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'marketing/assets/four-form-recollection-20261014/tacss'
publisher = runpy.run_path(str(ROOT / 'scripts/publish-svg-background-audit-20261014.py'))
values = publisher['secrets']()
db = publisher['database'](values['DB_VIBERS_MAIN_URL'])
s3 = boto3.client('s3', endpoint_url='https://kr.object.ncloudstorage.com', region_name='kr-standard',
    aws_access_key_id=values['NCP_ACCESS_KEY'], aws_secret_access_key=values['NCP_SECRET_KEY'],
    config=Config(signature_version='s3v4', request_checksum_calculation='when_required',
                  response_checksum_validation='when_required'))

with db.cursor() as cursor:
    cursor.execute("SELECT id,asset_manifest FROM semologo.logo_versions WHERE brand_id='tacss' AND is_current")
    version = cursor.fetchone()
assert version, 'TACSS current version missing'
container = version[1]
manifest = container['variants']
assert {v.get('lockup') for v in manifest['variants']} >= {'symbol', 'horizontal', 'vertical'}
assert not any(v.get('lockup') == 'wordmark' for v in manifest['variants'])

files = {}
for extension, mime in [('svg', 'image/svg+xml'), ('png', 'image/png')]:
    raw = (ASSETS / f'wordmark.{extension}').read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    relative = f'sources/official-tacss-wordmark-20261014/{digest[:20]}.{extension}'
    key = f'_clients/tacss/{relative}'
    try:
        old = s3.head_object(Bucket='vibers-bucket', Key=key)
        assert old['ContentLength'] == len(raw) and old.get('Metadata', {}).get('sha256') == digest
    except ClientError as error:
        if error.response.get('Error', {}).get('Code') not in ('404', 'NoSuchKey', 'NotFound'):
            raise
        s3.put_object(Bucket='vibers-bucket', Key=key, Body=raw, ACL='public-read',
            ContentType=mime, CacheControl='public,max-age=31536000,immutable',
            Metadata={'sha256': digest})
        assert s3.head_object(Bucket='vibers-bucket', Key=key)['ContentLength'] == len(raw)
    files[extension] = relative

result = merge_variant(manifest, {
    'key': 'wordmark-official-ci-20261014', 'form': 'wordmark', 'lockup': 'wordmark',
    'lang': 'ko', 'color': 'original', 'label': '글자형 · 공식 CI 가로조합에서 분리',
    'files': files, 'origin': 'derived', 'derived_from': 'horizontal',
    'provider': '자동차손해배상진흥원 공식 CI',
    'source_url': 'https://tacss.or.kr/intro/ci.jsp',
    'source_sha256': hashlib.sha256((ASSETS / 'TACSS.zip').read_bytes()).hexdigest(),
    'order': len(manifest['variants']),
})
assert result in ('added', 'unchanged') and coverage(manifest)['complete']
manifest_bytes = (json.dumps(manifest, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
with db, db.cursor() as cursor:
    cursor.execute('UPDATE semologo.logo_versions SET asset_manifest=%s::jsonb WHERE id=%s',
        (json.dumps({**container, 'variants': manifest}, ensure_ascii=False), version[0]))
    cursor.execute("UPDATE semologo.logo_posts SET payload=payload||%s::jsonb,updated_at=now() WHERE id='tacss'",
        (json.dumps({'variants_n': len(manifest['variants'])}),))
s3.put_object(Bucket='vibers-bucket', Key='_clients/tacss/variants.json', Body=manifest_bytes,
    ACL='public-read', ContentType='application/json', CacheControl='public,max-age=60')
saved = s3.get_object(Bucket='vibers-bucket', Key='_clients/tacss/variants.json')['Body'].read()
assert hashlib.sha256(saved).digest() == hashlib.sha256(manifest_bytes).digest()
db.close()
print(json.dumps({'id': 'tacss', 'result': result, 'coverage': coverage(manifest), 'files': files}, ensure_ascii=False))

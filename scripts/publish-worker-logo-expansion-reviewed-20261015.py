#!/usr/bin/env python3
"""Publish six reviewed worker originals as variants of existing identities.

The existing CDN logo remains an archive variant. No brand ID is created and
no administrator-selected presentation is replaced. Run without --publish to
prepare an exact plan and compare the light/dark renders first.
"""
import argparse
import hashlib
import io
import json
import runpy
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

import boto3
import cairosvg
from botocore.config import Config
from botocore.exceptions import ClientError
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'marketing/assets/worker-logo-expansion-20261015'
PLAN = ROOT / 'data/collection/semologo-worker-sources-next-20261015.json'
SELECTION = {
    'us-index-rpd': 'rapid7',
    'us-index-schl': 'scholastic',
    'us-index-fc': 'franklin-covey',
    'us-index-plug': 'plug-power',
    'us-index-stra': 'strategic-education',
    'us-index-ntgr': 'netgear',
}
CDN = 'https://logo.vibers.co.kr/_clients'
BUCKET = 'vibers-bucket'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def current_source(url, expected):
    with urlopen(Request(url, headers={'User-Agent': 'Mozilla/5.0 SemoLogo-source-preflight'}), timeout=20) as response:
        assert response.status == 200
        raw = response.read(20_001)
    assert 0 < len(raw) <= 20_000 and sha(raw) == expected, url


def repair_current_versions():
    """Attach reviewed manifests to versions created by the post-update trigger."""
    helper = runpy.run_path(str(ROOT / 'scripts/publish-svg-background-audit-20261014.py'))
    db = helper['database'](helper['secrets']()['DB_VIBERS_MAIN_URL'])
    repaired = []
    with db:
        with db.cursor() as cursor:
            for source_id, brand_id in SELECTION.items():
                cursor.execute('SELECT payload FROM semologo.logo_posts WHERE id=%s FOR UPDATE', (brand_id,))
                post = cursor.fetchone()[0]
                assert post['logo_svg'].startswith('sources/worker-reviewed-20261015/')
                cursor.execute('SELECT id,is_current,asset_manifest FROM semologo.logo_versions WHERE brand_id=%s FOR UPDATE', (brand_id,))
                versions = cursor.fetchall()
                reviewed = [row[2]['variants'] for row in versions if row[2] and
                            row[2].get('variants', {}).get('primary') == 'official-site-20261015']
                current = [row for row in versions if row[1]]
                assert len(reviewed) == 1 and len(current) == 1 and source_id in SELECTION
                if current[0][2] is None:
                    cursor.execute('UPDATE semologo.logo_versions SET asset_manifest=%s::jsonb,review_status=%s,verified_at=now() WHERE id=%s',
                        (json.dumps({'variants': reviewed[0]}, ensure_ascii=False), 'verified', current[0][0]))
                    repaired.append(brand_id)
                else:
                    assert current[0][2]['variants'] == reviewed[0]
    db.close()
    print(json.dumps({'repairedCurrentVersions': repaired, 'verified': len(SELECTION)}))


def main(publish):
    manifest = json.loads((OUT / 'manifest.json').read_text())
    results = {row['sourceId']: row for row in manifest['results']}
    sources = {row['id']: row for row in json.loads(PLAN.read_text())['sources']}
    audits = {row['sourceId']: row for row in json.loads((OUT / 'audit.json').read_text())['rows']}
    helper = runpy.run_path(str(ROOT / 'scripts/publish-svg-background-audit-20261014.py'))
    secret = helper['secrets']()
    db = helper['database'](secret['DB_VIBERS_MAIN_URL'])
    s3 = boto3.client('s3', endpoint_url='https://kr.object.ncloudstorage.com', region_name='kr-standard',
        aws_access_key_id=secret['NCP_ACCESS_KEY'], aws_secret_access_key=secret['NCP_SECRET_KEY'],
        config=Config(signature_version='s3v4', request_checksum_calculation='when_required',
                      response_checksum_validation='when_required'))
    uploads = {}
    prepared = []
    timestamp = datetime.now(timezone.utc).isoformat()
    for source_id, brand_id in SELECTION.items():
        source, result, audit = sources[source_id], results[source_id], audits[source_id]
        assert result['status'] == 'succeeded' and audit['safety'] == 'safe-vector' and audit['rendered']
        assert audit['reviewDecision'] == 'hold-visual-review' and brand_id in source['catalogExactNameMatches']
        raw = (OUT / result['file']).read_bytes()
        assert sha(raw) == result['sha256'] == source['expectedSha256']
        assert b'<image' not in raw.lower() and b'<script' not in raw.lower()
        current_source(source['assetUrl'], sha(raw))
        png = cairosvg.svg2png(bytestring=raw, output_width=1200)
        with Image.open(io.BytesIO(png)) as image:
            rgba = image.convert('RGBA')
            assert rgba.getchannel('A').getbbox()
            # Scholastic's red banner is artwork, not a removable background.
            assert rgba.getchannel('A').getextrema()[0] == 0 or brand_id == 'scholastic'
            assert image.width >= 1000 and image.height >= 100
        stem = 'sources/worker-reviewed-20261015/' + sha(raw)[:20]
        svg_rel, png_rel = stem + '.svg', stem + '.png'
        uploads[f'_clients/{brand_id}/{svg_rel}'] = (raw, 'image/svg+xml')
        uploads[f'_clients/{brand_id}/{png_rel}'] = (png, 'image/png')
        with db.cursor() as cursor:
            cursor.execute('SELECT status,payload FROM semologo.logo_posts WHERE id=%s', (brand_id,))
            post = cursor.fetchone()
            cursor.execute('SELECT id,asset_manifest FROM semologo.logo_versions WHERE brand_id=%s AND is_current', (brand_id,))
            versions = cursor.fetchall()
        assert post and post[0] == 'published' and len(versions) == 1
        assert versions[0][1] is None and not post[1].get('presentation'), brand_id
        assert post[1]['name_ko'].casefold().replace('-', '').replace(' ', '') in (
            brand_id.casefold().replace('-', ''), source['nameKo'].casefold().replace(' ', ''))
        old = s3.get_object(Bucket=BUCKET, Key=f'_clients/{brand_id}/logo.svg')['Body'].read()
        assert b'<svg' in old[:1000].lower()
        legacy_files = {'svg': 'logo.svg'}
        try:
            s3.head_object(Bucket=BUCKET, Key=f'_clients/{brand_id}/logo.png')
            legacy_files['png'] = 'logo.png'
        except ClientError as error:
            assert error.response['Error']['Code'] in ('404', 'NoSuchKey', 'NotFound')
        variants = {'schema': 1, 'algo_v': 1, 'id': brand_id, 'primary': 'official-site-20261015',
            'variants': [
                {'key': 'official-site-20261015', 'form': 'horizontal', 'lockup': 'horizontal',
                 'lang': 'en', 'color': 'original', 'label': '기업 공식 사이트 로고',
                 'files': {'svg': svg_rel, 'png': png_rel}, 'preview_png': png_rel,
                 'origin': 'official-site', 'official': False, 'provider': source['nameKo'],
                 'source_url': source['assetUrl'], 'source_sha256': sha(raw),
                 'visual_sha256': sha(png), 'review_status': 'verified', 'order': 0},
                {'key': 'existing-vector', 'form': 'horizontal', 'lockup': 'horizontal',
                 'lang': 'en', 'color': 'original', 'label': '기존 보유 벡터',
                 'files': legacy_files, 'preview_png': legacy_files.get('png'),
                 'origin': 'collected', 'order': 1},
            ]}
        patch = {'has_svg': True, 'logo_svg': svg_rel, 'svg_transparent': svg_rel,
                 'has_png': True, 'logo_png': png_rel, 'preview_png': f'{CDN}/{brand_id}/{png_rel}',
                 'presentation': {'file': png_rel, 'bg': 'light'}, 'variants_n': 2,
                 'official_source_page': source['sourcePage'],
                 'asset_origin': '기업 공식 사이트 SVG · 기존 벡터 보존',
                 'asset_review_status': 'verified', 'logo_published_at': timestamp}
        prepared.append({'id': brand_id, 'sourceId': source_id, 'sourceSha256': sha(raw),
                         'oldSvgSha256': sha(old), 'versionId': versions[0][0],
                         'baseline': post[1], 'patch': patch, 'variants': variants})
    plan = {'schema': 1, 'brands': [{k: v for k, v in row.items() if k not in ('baseline', 'patch', 'variants')}
                                     for row in prepared],
            'uploads': [{'key': key, 'sha256': sha(raw), 'bytes': len(raw)} for key, (raw, _) in uploads.items()]}
    (OUT / 'reviewed-publication-plan.json').write_text(json.dumps(plan, ensure_ascii=False, indent=2) + '\n')
    if not publish:
        db.close()
        print(json.dumps({'status': 'ready', 'brands': len(prepared), 'uploads': len(uploads)}))
        return
    for key, (raw, mime) in uploads.items():
        try:
            saved = s3.get_object(Bucket=BUCKET, Key=key)['Body'].read()
            assert saved == raw, key
        except ClientError as error:
            assert error.response['Error']['Code'] in ('404', 'NoSuchKey', 'NotFound')
            s3.put_object(Bucket=BUCKET, Key=key, Body=raw, ACL='public-read', ContentType=mime,
                          CacheControl='public,max-age=31536000,immutable', Metadata={'sha256': sha(raw)})
        assert s3.get_object(Bucket=BUCKET, Key=key)['Body'].read() == raw
    with db:
        with db.cursor() as cursor:
            for row in prepared:
                cursor.execute('SELECT payload FROM semologo.logo_posts WHERE id=%s FOR UPDATE', (row['id'],))
                assert cursor.fetchone()[0] == row['baseline'], row['id'] + ': concurrent post edit'
                cursor.execute('UPDATE semologo.logo_posts SET payload=payload||%s::jsonb,updated_at=now() WHERE id=%s',
                    (json.dumps(row['patch'], ensure_ascii=False), row['id']))
                cursor.execute('SELECT id,asset_manifest FROM semologo.logo_versions WHERE brand_id=%s AND is_current FOR UPDATE', (row['id'],))
                version = cursor.fetchall()
                assert len(version) == 1 and version[0][1] is None
                cursor.execute('UPDATE semologo.logo_versions SET asset_manifest=%s::jsonb,review_status=%s,verified_at=now() WHERE id=%s',
                    (json.dumps({'variants': row['variants']}, ensure_ascii=False), 'verified', version[0][0]))
    for row in prepared:
        raw = (json.dumps(row['variants'], ensure_ascii=False, separators=(',', ':')) + '\n').encode()
        key = f"_clients/{row['id']}/variants.json"
        s3.put_object(Bucket=BUCKET, Key=key, Body=raw, ACL='public-read', ContentType='application/json',
                      CacheControl='public,max-age=60')
        assert s3.get_object(Bucket=BUCKET, Key=key)['Body'].read() == raw
    db.close()
    (OUT / 'reviewed-published.json').write_text(json.dumps({'status': 'published',
        'brands': [row['id'] for row in prepared], 'uploadsVerified': len(uploads)}, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'status': 'published', 'brands': len(prepared), 'uploadsVerified': len(uploads)}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--publish', action='store_true')
    parser.add_argument('--repair-current', action='store_true')
    args = parser.parse_args()
    if args.repair_current:
        repair_current_versions()
    else:
        main(args.publish)

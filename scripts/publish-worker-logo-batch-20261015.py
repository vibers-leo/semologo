#!/usr/bin/env python3
"""Review and publish the Windows fleet's official-site SVGs as CMS variants.

The originals are preserved byte-for-byte. This batch enriches existing
identities; it never creates a second post for an institution.
"""
import argparse
import hashlib
import io
import json
import runpy
from datetime import datetime, timezone
from pathlib import Path

import boto3
import cairosvg
from botocore.config import Config
from botocore.exceptions import ClientError
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'marketing/assets/worker-logo-batch-20261015'
RELEASE = ROOT / 'src/lib/reviewed-worker-logo-batch-20261015.json'
CDN = 'https://logo.vibers.co.kr/_clients'
BUCKET = 'vibers-bucket'

# Contact sheets were reviewed on both light and dark backgrounds. 10 is a
# different identity (Culture City Gimhae); 0 and 5 contain embedded raster art.
TARGETS = {
    0: ('gongu-ci-0720', 'horizontal', '공식 사이트 가로조합 · 내부 래스터 포함', 'light', False),
    3: ('gongu-ci-0906', 'horizontal', '공식 사이트 가로조합', 'light', True),
    4: ('gongu-ci-0700', 'horizontal', '공식 사이트 가로조합', 'light', True),
    5: ('gongu-ci-0779', 'horizontal', '국가유산청 병기 가로조합 · 내부 래스터 포함', 'light', False),
    6: ('gongu-ci-0985', 'horizontal', '기후에너지환경부 병기 가로조합', 'light', True),
    11: ('gongu-ci-0598', 'symbol', '공식 사이트 심볼', 'light', True),
    12: ('gongu-ci-1059', 'horizontal', '공식 사이트 다크 배경용 가로조합', 'dark', True),
    14: ('gongu-ci-0319', 'horizontal', '공식 사이트 가로조합', 'light', True),
    15: ('gongu-ci-0305', 'symbol', '공식 사이트 심볼', 'light', True),
    20: ('gongu-ci-1200', 'horizontal', '공식 사이트 가로조합', 'light', True),
}
NEW_PRIMARY = {3, 4, 14, 20}


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def save(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')


def main(publish):
    rows = json.loads((OUT / 'manifest.json').read_text())['results']
    assert len(rows) == 22 and all(r['status'] == 'succeeded' for r in rows)
    publisher = runpy.run_path(str(ROOT / 'scripts/publish-svg-background-audit-20261014.py'))
    secrets = publisher['secrets']()
    db = publisher['database'](secrets['DB_VIBERS_MAIN_URL'])
    s3 = boto3.client('s3', endpoint_url='https://kr.object.ncloudstorage.com', region_name='kr-standard',
        aws_access_key_id=secrets['NCP_ACCESS_KEY'], aws_secret_access_key=secrets['NCP_SECRET_KEY'],
        config=Config(signature_version='s3v4', request_checksum_calculation='when_required',
                      response_checksum_validation='when_required'))
    release = {'patches': {}, 'variants': {}, 'reviewed': [], 'excluded': [
        {'sourceId': rows[10]['sourceId'], 'reason': '공식 사이트 파일의 표기는 문화도시김해이며 재단 대표 로고가 아님'}]}
    uploads = {}
    baselines = {}
    timestamp = datetime.now(timezone.utc).isoformat()

    for index, (brand, form, label, bg, pure_vector) in TARGETS.items():
        row = rows[index]
        raw = (OUT / row['file']).read_bytes()
        assert sha(raw) == row['sha256'] and row['sourceChanged'] is False
        assert b'<svg' in raw[:1000].lower() and b'<script' not in raw.lower()
        if pure_vector:
            assert b'<image' not in raw.lower(), brand
        png = cairosvg.svg2png(bytestring=raw, output_width=1600 if form == 'horizontal' else 1000)
        with Image.open(io.BytesIO(png)) as image:
            rgba = image.convert('RGBA')
            assert rgba.getbbox() and rgba.getchannel('A').getextrema()[0] == 0, brand
            assert max(rgba.size) >= 1000
        svg_rel = f'sources/worker-reviewed-20261015/{sha(raw)[:20]}.svg'
        png_rel = f'sources/worker-reviewed-20261015/{sha(png)[:20]}.png'
        (OUT / f'{index:02d}-transparent.png').write_bytes(png)
        uploads[f'_clients/{brand}/{svg_rel}'] = (raw, 'image/svg+xml')
        uploads[f'_clients/{brand}/{png_rel}'] = (png, 'image/png')

        with db.cursor() as cursor:
            cursor.execute('SELECT status,payload FROM semologo.logo_posts WHERE id=%s', (brand,))
            post = cursor.fetchone()
            cursor.execute('SELECT id,asset_manifest FROM semologo.logo_versions WHERE brand_id=%s AND is_current', (brand,))
            versions = cursor.fetchall()
        assert post and post[0] == 'published' and post[1]['name_ko'] == row['sourceId'], brand
        assert len(versions) == 1 and versions[0][1] is None, brand
        baselines[brand] = {'payload': post[1], 'version_id': versions[0][0]}
        legacy = {'key': 'existing-png', 'form': 'horizontal', 'lockup': 'horizontal',
            'lang': 'ko', 'color': 'original', 'label': '기존 제공 PNG',
            'files': {'png': 'logo.png'}, 'preview_png': 'logo.png', 'origin': 'collected', 'order': 0}
        variant = {'key': 'official-site-20261015', 'form': form, 'lockup': form,
            'lang': 'none' if form == 'symbol' else 'mixed', 'color': 'reverse' if bg == 'dark' else 'original',
            'label': label, 'files': {'svg': svg_rel, 'png': png_rel}, 'preview_png': png_rel,
            'origin': 'official-site', 'official': False, 'provider': row['sourceId'],
            'source_url': row['assetUrl'], 'derived_from': row['sourcePage'],
            'source_sha256': row['sha256'], 'visual_sha256': sha(raw),
            'source_note': '기관 공식 사이트 표시 원본. 공식 배포 CI 패키지 여부는 미확인.',
            'review_status': 'verified', 'order': 1}
        manifest = {'schema': 1, 'algo_v': 1, 'id': brand,
            'primary': variant['key'] if index in NEW_PRIMARY else legacy['key'],
            'variants': [legacy, variant]}
        patch = {'has_png': True, 'variants_n': 2,
            'official_source_page': row['sourcePage'],
            'asset_origin': '기관 공식 사이트 표시 로고 · 원본 SVG 보존 · 공식 CI 패키지 여부 미확인',
            'asset_review_status': 'verified', 'logo_published_at': timestamp}
        if pure_vector:
            patch.update({'has_svg': True, 'logo_svg': svg_rel, 'svg_transparent': svg_rel})
        if index in NEW_PRIMARY:
            patch.update({'logo_png': png_rel, 'preview_png': f'{CDN}/{brand}/{png_rel}',
                'presentation': {'file': png_rel, 'bg': 'light'},
                'rejected_asset_files': ['logo-800.png', 'logo-transparent.png', 'logo-white.png', 'logo-icon.png']})
        else:
            patch['presentation'] = {'file': 'logo.png', 'bg': 'light'}
        release['patches'][brand] = patch
        release['variants'][brand] = manifest
        release['reviewed'].append({'brand': brand, 'name': row['sourceId'], 'source_sha256': row['sha256'],
            'png_sha256': sha(png), 'pure_vector': pure_vector, 'primary_changed': index in NEW_PRIMARY})

    save(OUT / 'publication-before.json', baselines)
    save(OUT / 'publication-plan.json', {'release': release, 'uploads': [
        {'key': key, 'sha256': sha(raw)} for key, (raw, _) in uploads.items()]})
    if not publish:
        db.close()
        print(json.dumps({'status': 'ready', 'variants': len(TARGETS), 'uploads': len(uploads)}, ensure_ascii=False))
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
            for brand, before in baselines.items():
                cursor.execute('SELECT payload FROM semologo.logo_posts WHERE id=%s FOR UPDATE', (brand,))
                assert cursor.fetchone()[0] == before['payload'], f'{brand}: concurrent post edit'
                cursor.execute('UPDATE semologo.logo_posts SET payload=payload||%s::jsonb,updated_at=now() WHERE id=%s',
                    (json.dumps(release['patches'][brand], ensure_ascii=False), brand))
                cursor.execute('SELECT id,asset_manifest FROM semologo.logo_versions WHERE brand_id=%s AND is_current FOR UPDATE', (brand,))
                current = cursor.fetchall()
                assert len(current) == 1 and current[0][1] is None, f'{brand}: unexpected manifest'
                cursor.execute('UPDATE semologo.logo_versions SET asset_manifest=%s::jsonb,review_status=%s,verified_at=now() WHERE id=%s',
                    (json.dumps({'variants': release['variants'][brand]}, ensure_ascii=False), 'verified', current[0][0]))

    for brand, manifest in release['variants'].items():
        raw = (json.dumps(manifest, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
        key = f'_clients/{brand}/variants.json'
        s3.put_object(Bucket=BUCKET, Key=key, Body=raw, ACL='public-read',
            ContentType='application/json', CacheControl='public,max-age=60')
        assert s3.get_object(Bucket=BUCKET, Key=key)['Body'].read() == raw
    db.close()
    save(RELEASE, release)
    save(OUT / 'published.json', {'status': 'published', 'brands': list(baselines),
        'uploads_verified': len(uploads), 'excluded': release['excluded']})
    print(json.dumps({'status': 'published', 'brands': list(baselines),
        'uploads_verified': len(uploads)}, ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--publish', action='store_true')
    args = parser.parse_args()
    main(args.publish)

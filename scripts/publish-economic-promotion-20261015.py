#!/usr/bin/env python3
"""Publish visually reviewed CEPA/GWEP CI assets, retaining original sources."""
import argparse
import copy
import hashlib
import json
import mimetypes
import runpy
from pathlib import Path

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'marketing/assets/economic-promotion-audit-20261015'
RELEASE = ROOT / 'src/lib/reviewed-economic-promotion-20261015.json'
BUCKET = 'vibers-bucket'
CDN = 'https://logo.vibers.co.kr/_clients'
NAMES = {'gongu-ci-0094': '충남경제진흥원',
         'gongu-ci-0418': '경남투자경제진흥원',
         'gongu-ci-0571': '강원특별자치도경제진흥원'}


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def save(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def main(publish, only):
    prepared = json.loads((OUT / 'prepared.json').read_text())
    publisher = runpy.run_path(str(ROOT / 'scripts/publish-svg-background-audit-20261014.py'))
    secrets = publisher['secrets']()
    db = publisher['database'](secrets['DB_VIBERS_MAIN_URL'])
    s3 = boto3.client('s3', endpoint_url='https://kr.object.ncloudstorage.com', region_name='kr-standard',
        aws_access_key_id=secrets['NCP_ACCESS_KEY'], aws_secret_access_key=secrets['NCP_SECRET_KEY'],
        config=Config(signature_version='s3v4', request_checksum_calculation='when_required',
                      response_checksum_validation='when_required'))
    release = json.loads(RELEASE.read_text()) if RELEASE.is_file() else {
        'patches': {}, 'variants': {}, 'sources': {}}
    release['sources'].update(prepared['sources'])
    uploads = {}
    before = {}
    version_ids = {}

    def object_path(brand, name):
        path = OUT / name
        raw = path.read_bytes()
        sha = digest(raw)
        assert prepared['sha256'][name] == sha, name
        relative = f'sources/official-economic-20261015/{sha[:20]}/{name}'
        uploads[f'_clients/{brand}/{relative}'] = (raw, sha, path)
        return relative

    for brand, rows in prepared['variants'].items():
        if only and brand not in only:
            continue
        with db.cursor() as cursor:
            cursor.execute('SELECT status,payload FROM semologo.logo_posts WHERE id=%s', (brand,))
            post = cursor.fetchone()
            cursor.execute('SELECT id,asset_manifest FROM semologo.logo_versions WHERE brand_id=%s AND is_current', (brand,))
            versions = cursor.fetchall()
        assert post and post[0] == 'published' and NAMES[brand] in post[1]['name_ko']
        assert len(versions) == 1
        version_ids[brand] = versions[0][0]
        before[brand] = {'payload': post[1], 'asset_manifest': versions[0][1]}
        previous = copy.deepcopy(versions[0][1] or {})
        old_manifest = previous.get('variants') or {}
        # The old GWEP "variant" was a two-row CI presentation sheet. Keep it
        # recoverable in the archive, but do not offer it as a logo lockup.
        assert brand != 'gongu-ci-0571' or len(old_manifest.get('variants', [])) == 1
        primary = {'gongu-ci-0094': 'official-horizontal-ko-20261015',
            'gongu-ci-0418': 'official-horizontal-bilingual-20261015',
            'gongu-ci-0571': 'official-horizontal-20261015'}[brand]
        manifest = {'schema': 1, 'algo_v': 1, 'id': brand,
            'primary': primary,
            'variants': []}
        if old_manifest.get('variants'):
            manifest['archived_variants'] = [{**v, 'archive_reason': '공식 CI 판에 두 배경용 로고가 함께 있어 개별 로고에서 제외'}
                for v in old_manifest['variants']]
        sources = prepared['sources'][brand]
        for name in sources['files']:
            object_path(brand, name)
        for order, row in enumerate(rows):
            files = {kind: object_path(brand, row[kind]) for kind in ('svg', 'png', 'ai')}
            if row.get('official_png'):
                files['original_png'] = object_path(brand, row['official_png'])
            lang = 'none' if row['form'] == 'symbol' else ('en' if row['key'].endswith('-en') else 'mixed'
                if 'bilingual' in row['key'] or brand == 'gongu-ci-0571' else 'ko')
            manifest['variants'].append({'key': f"official-{row['key']}-20261015",
                'form': row['form'], 'lockup': row['form'], 'lang': lang,
                'color': 'original', 'label': row['label'], 'files': files,
                'preview_png': files['png'], 'origin': 'official', 'official': True,
                'provider': NAMES[brand], 'source_url': sources['ai_zip'],
                'derived_from': sources['page'], 'source_sha256': prepared['sha256'][row['ai']],
                'visual_sha256': prepared['sha256'][row['svg']],
                'source_note': '공식 AI의 벡터 경로를 보존해 개별 시그니처로 분리',
                'review_status': 'verified', 'order': order})
        assert manifest['primary'] in {v['key'] for v in manifest['variants']}
        main = next(v for v in manifest['variants'] if v['key'] == manifest['primary'])
        source_zip = object_path(brand, sources['files'][0])
        patch = {'name_ko': NAMES[brand], 'aliases': [post[1]['name_ko'], NAMES[brand]],
            'has_svg': True, 'has_png': True, 'logo_svg': main['files']['svg'],
            'svg_transparent': main['files']['svg'], 'logo_png': main['files']['png'],
            'preview_png': f"{CDN}/{brand}/{main['files']['png']}",
            'presentation': {'file': main['files']['png'], 'bg': 'light'},
            'light': False, 'light_logo': False, 'dark_variant': False,
            'source_zip': source_zip, 'official_source_page': sources['page'],
            'asset_origin': '기관 공식 CI AI/PNG 원본 · 개별 시그니처 검수',
            'asset_review_status': 'verified', 'variants_n': len(manifest['variants']),
            'rejected_asset_files': ['logo-800.png', 'logo-transparent.png',
                'logo-white.png', 'logo-icon.png']}
        release['patches'][brand] = patch
        release['variants'][brand] = manifest

    save(OUT / 'before.json', before)
    save(OUT / 'release.json', {'release': release, 'uploads':
        [{'key': key, 'sha256': sha, 'file': path.name} for key, (_, sha, path) in uploads.items()]})
    if not publish:
        db.close()
        print(json.dumps({'status': 'ready', 'variants': {k: len(v['variants'])
            for k, v in release['variants'].items()}, 'uploads': len(uploads)}, ensure_ascii=False))
        return

    for key, (raw, sha, path) in uploads.items():
        try:
            assert s3.get_object(Bucket=BUCKET, Key=key)['Body'].read() == raw, key
        except ClientError as error:
            assert error.response['Error']['Code'] in ('404', 'NoSuchKey', 'NotFound')
            s3.put_object(Bucket=BUCKET, Key=key, Body=raw, ACL='public-read',
                ContentType=mimetypes.guess_type(path.name)[0] or 'application/octet-stream',
                CacheControl='public,max-age=31536000,immutable', Metadata={'sha256': sha})
        assert s3.get_object(Bucket=BUCKET, Key=key)['Body'].read() == raw

    with db:
        with db.cursor() as cursor:
            for brand, item in before.items():
                cursor.execute('SELECT payload FROM semologo.logo_posts WHERE id=%s FOR UPDATE', (brand,))
                assert cursor.fetchone()[0] == item['payload'], f'{brand}: concurrent post change'
                cursor.execute('SELECT asset_manifest FROM semologo.logo_versions WHERE id=%s AND is_current FOR UPDATE',
                    (version_ids[brand],))
                assert cursor.fetchone()[0] == item['asset_manifest'], f'{brand}: concurrent version change'
                cursor.execute('UPDATE semologo.logo_posts SET payload=payload||%s::jsonb,updated_at=now() WHERE id=%s',
                    (json.dumps(release['patches'][brand], ensure_ascii=False), brand))
                new_asset_manifest = copy.deepcopy(item['asset_manifest'] or {})
                new_asset_manifest['variants'] = release['variants'][brand]
                old = {entry.get('key') for entry in new_asset_manifest.get('files', [])}
                new_asset_manifest.setdefault('files', []).extend({'id': brand, 'key': key,
                    'file': str(path.relative_to(ROOT)), 'sha256': sha} for key, (_, sha, path) in uploads.items()
                    if key.startswith(f'_clients/{brand}/') and key not in old)
                cursor.execute('UPDATE semologo.logo_versions SET asset_manifest=%s::jsonb WHERE id=%s',
                    (json.dumps(new_asset_manifest, ensure_ascii=False), version_ids[brand]))
    for brand in before:
        manifest = release['variants'][brand]
        raw = (json.dumps(manifest, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
        key = f'_clients/{brand}/variants.json'
        s3.put_object(Bucket=BUCKET, Key=key, Body=raw, ACL='public-read',
            ContentType='application/json', CacheControl='public,max-age=60')
        assert s3.get_object(Bucket=BUCKET, Key=key)['Body'].read() == raw
    db.close()
    save(RELEASE, release)
    save(OUT / 'published.json', {'status': 'published', 'brands': list(before),
        'uploads_verified': len(uploads)})
    print(json.dumps({'status': 'published', 'brands': list(before),
        'uploads_verified': len(uploads)}, ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--publish', action='store_true')
    parser.add_argument('--only', action='append', choices=list(NAMES))
    args = parser.parse_args()
    main(args.publish, set(args.only or []))

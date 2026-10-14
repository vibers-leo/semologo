#!/usr/bin/env python3
"""Append BEPA's official wordmark while preserving its existing CI variants."""
import argparse
import copy
import hashlib
import json
import mimetypes
import runpy
import subprocess
from pathlib import Path

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from logo_variant_enrichment import coverage

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'marketing/assets/bepa-wordmark-20261015'
BRAND = 'gongu-ci-1137'
VARIANT_KEY = 'official-wordmark-20261015'
BUCKET = 'vibers-bucket'


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def write_json(name, value):
    (OUT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def main(publish):
    prepared = json.loads((OUT / 'prepared.json').read_text())
    assert prepared['status'] == 'ready-for-visual-review'
    source = ROOT / 'marketing/assets/nhbank-bepa-expansion-20261010/sources/bepa-text.ai'
    files = {'svg': OUT / 'wordmark.svg', 'png': OUT / 'wordmark.png',
             'ai': source, 'preview': OUT / 'wordmark-preview.png'}
    for kind, path in files.items():
        expected = prepared['source_sha256' if kind == 'ai' else
                            'preview_sha256' if kind == 'preview' else f'{kind}_sha256']
        assert digest(path.read_bytes()) == expected, path
    paths = {kind: f'sources/official-bepa-wordmark-20261015/{digest(path.read_bytes())[:20]}/{path.name}'
             for kind, path in files.items()}
    uploads = [{'id': BRAND, 'kind': kind, 'file': str(path.relative_to(ROOT)),
                'key': f'_clients/{BRAND}/{paths[kind]}', 'sha256': digest(path.read_bytes())}
               for kind, path in files.items()]

    publisher = runpy.run_path(str(ROOT / 'scripts/publish-svg-background-audit-20261014.py'))
    secrets = publisher['secrets']()
    db = publisher['database'](secrets['DB_VIBERS_MAIN_URL'])
    with db.cursor() as cursor:
        cursor.execute('SELECT status,payload FROM semologo.logo_posts WHERE id=%s', (BRAND,))
        post = cursor.fetchone()
        cursor.execute('SELECT id,asset_manifest FROM semologo.logo_versions WHERE brand_id=%s AND is_current', (BRAND,))
        versions = cursor.fetchall()
    assert post and post[0] == 'published' and '부산경제진흥원' in post[1].get('name_ko', '')
    assert len(versions) == 1, 'expected one current version'
    version_id, before = versions[0]
    manifest = copy.deepcopy((before or {}).get('variants') or {})
    assert manifest.get('primary') and len(manifest.get('variants', [])) >= 4
    assert not any(v.get('key') == VARIANT_KEY for v in manifest['variants']), 'already published'
    assert 'wordmark' in coverage(manifest)['missing'], 'wordmark already present'

    cdn = subprocess.run(['curl', '-fsSL', '--max-time', '30', '-H', 'Referer: https://semologo.com/',
                          f'https://logo.vibers.co.kr/_clients/{BRAND}/variants.json'],
                         capture_output=True, check=True)
    assert [v['key'] for v in json.loads(cdn.stdout)['variants']] == [v['key'] for v in manifest['variants']]
    manifest['variants'].append({
        'key': VARIANT_KEY, 'label': '국영문 로고타입 · 공식 AI 원본',
        'form': 'wordmark', 'lockup': 'wordmark', 'lang': 'mixed', 'color': 'original',
        'files': {kind: paths[kind] for kind in ('svg', 'png', 'ai')},
        'preview_png': paths['preview'], 'origin': 'official', 'official': True,
        'provider': '부산경제진흥원', 'derived_from': prepared['source_page'],
        'source_url': prepared['source_url'], 'source_sha256': prepared['source_sha256'],
        'visual_sha256': prepared['svg_sha256'], 'review_status': 'verified',
        'source_note': '공식 CI 페이지의 로고타입 AI를 벡터 형태 그대로 추출. 기존 심볼·가로·세로 시그니처 보존.',
        'order': 100 + len(manifest['variants']),
    })
    result = coverage(manifest)
    assert result['complete'] and result['distinct_artwork'] >= 4, result
    updated = copy.deepcopy(before)
    updated['variants'] = manifest
    old_keys = {item.get('key') for item in updated.get('files', [])}
    updated.setdefault('files', []).extend(row for row in uploads if row['key'] not in old_keys)
    write_json('before.json', {'version_id': version_id, 'post': post[1], 'asset_manifest': before})
    write_json('release.json', {'version_id': version_id, 'manifest': manifest, 'coverage': result,
                                'uploads': uploads, 'source_page': prepared['source_page']})
    if not publish:
        db.close()
        print(json.dumps({'status': 'ready', 'coverage': result, 'uploads': len(uploads)}, ensure_ascii=False))
        return

    s3 = boto3.client('s3', endpoint_url='https://kr.object.ncloudstorage.com', region_name='kr-standard',
        aws_access_key_id=secrets['NCP_ACCESS_KEY'], aws_secret_access_key=secrets['NCP_SECRET_KEY'],
        config=Config(signature_version='s3v4', request_checksum_calculation='when_required',
                      response_checksum_validation='when_required'))
    for row in uploads:
        raw = (ROOT / row['file']).read_bytes()
        try:
            saved = s3.get_object(Bucket=BUCKET, Key=row['key'])['Body'].read()
            assert saved == raw, f'immutable conflict: {row["key"]}'
        except ClientError as error:
            assert error.response['Error']['Code'] in ('404', 'NoSuchKey', 'NotFound')
            s3.put_object(Bucket=BUCKET, Key=row['key'], Body=raw, ACL='public-read',
                          ContentType=mimetypes.guess_type(row['file'])[0] or 'application/octet-stream',
                          CacheControl='public,max-age=31536000,immutable', Metadata={'sha256': row['sha256']})
        assert s3.get_object(Bucket=BUCKET, Key=row['key'])['Body'].read() == raw

    with db:
        with db.cursor() as cursor:
            cursor.execute('SELECT asset_manifest FROM semologo.logo_versions WHERE id=%s AND is_current FOR UPDATE', (version_id,))
            locked = cursor.fetchone()
            assert locked and locked[0] == before, 'current manifest changed during preparation'
            cursor.execute('UPDATE semologo.logo_versions SET asset_manifest=%s::jsonb WHERE id=%s',
                           (json.dumps(updated, ensure_ascii=False), version_id))
            cursor.execute("UPDATE semologo.logo_posts SET payload=jsonb_set(payload,'{variants_n}',to_jsonb(%s::int),true),updated_at=now() WHERE id=%s",
                           (len(manifest['variants']), BRAND))
            cursor.execute("SELECT id,asset_manifest->'variants' FROM semologo.logo_versions WHERE brand_id=%s AND is_current", (BRAND,))
            current = cursor.fetchall()
            assert len(current) == 1, 'current version count changed'
            if current[0][1] != manifest:
                cursor.execute('UPDATE semologo.logo_versions SET asset_manifest=%s::jsonb WHERE id=%s',
                               (json.dumps(updated, ensure_ascii=False), current[0][0]))

    raw_manifest = (json.dumps(manifest, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
    s3.put_object(Bucket=BUCKET, Key=f'_clients/{BRAND}/variants.json', Body=raw_manifest,
                  ACL='public-read', ContentType='application/json', CacheControl='public,max-age=60')
    assert s3.get_object(Bucket=BUCKET, Key=f'_clients/{BRAND}/variants.json')['Body'].read() == raw_manifest
    db.close()
    write_json('published.json', {'status': 'published', 'brand_id': BRAND,
                                  'variant_key': VARIANT_KEY, 'coverage': result,
                                  'objects_verified': len(uploads)})
    print(json.dumps({'status': 'published', 'brand_id': BRAND, 'coverage': result}, ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--publish', action='store_true')
    main(parser.parse_args().publish)

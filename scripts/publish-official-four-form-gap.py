#!/usr/bin/env python3
"""Publish one visually reviewed official variant into an existing near-complete logo.

Input is a project-local release-input.json containing hashed source AI, SVG,
PNG and preview paths. The current primary and all prior variants are retained.
"""
import argparse
import copy
import hashlib
import json
import mimetypes
import re
import runpy
import subprocess
from pathlib import Path

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from logo_variant_enrichment import coverage

ROOT = Path(__file__).resolve().parents[1]
BUCKET = 'vibers-bucket'


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def save(folder, name, value):
    (folder / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def main(input_file, publish):
    config = json.loads(input_file.read_text())
    folder = input_file.parent
    brand = config['brand_id']
    assert re.fullmatch(r'[a-z0-9-]+', brand)
    assert config['form'] in ('symbol', 'wordmark', 'horizontal', 'vertical')
    batch = config['variant_key'].rsplit('-', 1)[-1]
    assert re.fullmatch(r'20\d{6}', batch), 'variant key must end in a batch date'
    paths = {}
    uploads = []
    for kind in ('source', 'svg', 'png', 'preview'):
        path = ROOT / config[f'{kind}_file']
        assert path.is_file() and path.is_relative_to(ROOT)
        sha = digest(path.read_bytes())
        assert sha == config[f'{kind}_sha256'], path
        remote = f'sources/official-four-form-{batch}/{sha[:20]}/{path.name}'
        paths[kind] = remote
        uploads.append({'id': brand, 'kind': kind, 'file': str(path.relative_to(ROOT)),
                        'key': f'_clients/{brand}/{remote}', 'sha256': sha})

    publisher = runpy.run_path(str(ROOT / 'scripts/publish-svg-background-audit-20261014.py'))
    secrets = publisher['secrets']()
    db = publisher['database'](secrets['DB_VIBERS_MAIN_URL'])
    with db.cursor() as cursor:
        cursor.execute('SELECT status,payload FROM semologo.logo_posts WHERE id=%s', (brand,))
        post = cursor.fetchone()
        cursor.execute('SELECT id,asset_manifest FROM semologo.logo_versions WHERE brand_id=%s AND is_current', (brand,))
        versions = cursor.fetchall()
    assert post and post[0] == 'published' and config['brand_label'] in post[1].get('name_ko', '')
    assert len(versions) == 1
    version_id, before = versions[0]
    manifest = copy.deepcopy((before or {}).get('variants') or {})
    assert manifest.get('primary') and manifest.get('variants')
    assert config['form'] in coverage(manifest)['missing'], 'form already present'
    assert not any(v.get('key') == config['variant_key'] for v in manifest['variants'])
    cdn = subprocess.run(['curl', '-sSL', '--max-time', '30', '-H', 'Referer: https://semologo.com/',
                          '-w', '\n%{http_code}',
                          f'https://logo.vibers.co.kr/_clients/{brand}/variants.json'],
                         check=True, capture_output=True)
    body, status = cdn.stdout.rsplit(b'\n', 1)
    if status == b'200':
        assert [v['key'] for v in json.loads(body)['variants']] == [v['key'] for v in manifest['variants']]
    else:
        assert status == b'404', f'unexpected CDN manifest status: {status!r}'
        # Some older CMS identities have reviewed variants only in the DB. A
        # missing CDN manifest is safe to materialize when every old SVG loads.
        for existing in manifest['variants']:
            svg = (existing.get('files') or {}).get('svg')
            assert svg, f'old variant has no vector: {existing.get("key")}'
            subprocess.run(['curl', '-fsSI', '--max-time', '20',
                            '-H', 'Referer: https://semologo.com/',
                            f'https://logo.vibers.co.kr/_clients/{brand}/{svg}'],
                           check=True, capture_output=True)
    variant = {
        'key': config['variant_key'], 'form': config['form'], 'lockup': config['form'],
        'label': config['label'], 'lang': config['lang'], 'color': 'original',
        'files': {'svg': paths['svg'], 'png': paths['png'], 'ai': paths['source']},
        'preview_png': paths['preview'], 'origin': 'official', 'official': True,
        'provider': config['provider'], 'derived_from': config['source_page'],
        'source_url': config['source_url'], 'source_sha256': config['source_sha256'],
        'visual_sha256': config['svg_sha256'], 'source_note': config['source_note'],
        'review_status': 'verified', 'order': 100 + len(manifest['variants']),
    }
    manifest['variants'].append(variant)
    result = coverage(manifest)
    assert result['complete'] and result['distinct_artwork'] >= 4, result
    updated = copy.deepcopy(before)
    updated['variants'] = manifest
    previous_files = {item.get('key') for item in updated.get('files', [])}
    updated.setdefault('files', []).extend(row for row in uploads if row['key'] not in previous_files)
    save(folder, 'before.json', {'version_id': version_id, 'post': post[1], 'asset_manifest': before})
    save(folder, 'release.json', {'version_id': version_id, 'manifest': manifest,
                                  'coverage': result, 'uploads': uploads})
    if not publish:
        db.close()
        print(json.dumps({'status': 'ready', 'brand_id': brand, 'coverage': result}, ensure_ascii=False))
        return

    s3 = boto3.client('s3', endpoint_url='https://kr.object.ncloudstorage.com', region_name='kr-standard',
                      aws_access_key_id=secrets['NCP_ACCESS_KEY'], aws_secret_access_key=secrets['NCP_SECRET_KEY'],
                      config=Config(signature_version='s3v4', request_checksum_calculation='when_required',
                                    response_checksum_validation='when_required'))
    for row in uploads:
        raw = (ROOT / row['file']).read_bytes()
        try:
            assert s3.get_object(Bucket=BUCKET, Key=row['key'])['Body'].read() == raw
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
            assert locked and locked[0] == before, 'concurrent manifest change'
            cursor.execute('UPDATE semologo.logo_versions SET asset_manifest=%s::jsonb WHERE id=%s',
                           (json.dumps(updated, ensure_ascii=False), version_id))
            cursor.execute("UPDATE semologo.logo_posts SET payload=jsonb_set(payload,'{variants_n}',to_jsonb(%s::int),true),updated_at=now() WHERE id=%s",
                           (len(manifest['variants']), brand))
            cursor.execute("SELECT id,asset_manifest->'variants' FROM semologo.logo_versions WHERE brand_id=%s AND is_current", (brand,))
            current = cursor.fetchall()
            assert len(current) == 1
            if current[0][1] != manifest:
                cursor.execute('UPDATE semologo.logo_versions SET asset_manifest=%s::jsonb WHERE id=%s',
                               (json.dumps(updated, ensure_ascii=False), current[0][0]))

    raw_manifest = (json.dumps(manifest, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
    s3.put_object(Bucket=BUCKET, Key=f'_clients/{brand}/variants.json', Body=raw_manifest,
                  ACL='public-read', ContentType='application/json', CacheControl='public,max-age=60')
    assert s3.get_object(Bucket=BUCKET, Key=f'_clients/{brand}/variants.json')['Body'].read() == raw_manifest
    db.close()
    save(folder, 'published.json', {'status': 'published', 'brand_id': brand,
                                    'variant_key': config['variant_key'],
                                    'coverage': result, 'objects_verified': len(uploads)})
    print(json.dumps({'status': 'published', 'brand_id': brand, 'coverage': result}, ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('input', type=Path)
    parser.add_argument('--publish', action='store_true')
    args = parser.parse_args()
    main(args.input.resolve(), args.publish)

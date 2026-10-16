#!/usr/bin/env python3
"""Improve three existing brands with reviewed company-site vectors, preserving old files."""

import argparse
import hashlib
import io
import json
import runpy
from datetime import datetime, timezone
from pathlib import Path

import boto3
import cairosvg
import requests
from botocore.config import Config
from botocore.exceptions import ClientError
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'marketing/assets/gdweb-official-review-20261016'
ORIGIN = 'https://kr.object.ncloudstorage.com/vibers-bucket/_clients'
CDN = 'https://logo.vibers.co.kr/_clients'
BUCKET = 'vibers-bucket'
REVIEWED = {
    '27794': ('seojinsystem', 'dark'),
    '27578': ('gigavis', 'light'),
    '27560': ('saltlux', 'light'),
}


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def remote(ident, file, required=True):
    response = requests.get(f'{ORIGIN}/{ident}/{file}', timeout=30)
    if response.status_code == 404 and not required:
        return None
    response.raise_for_status()
    return response.content


def prepare():
    stage = {row['gdweb_id']: row for row in json.loads((OUT / 'manifest.json').read_text())['items']}
    selections = {row['gdweb_id']: row for row in json.loads((ROOT / 'data/collection/gdweb-svg-selections.json').read_text())['items']}
    reviews = {row['gdweb_id']: row for row in json.loads((ROOT / 'data/collection/gdweb-svg-review-20261016.json').read_text())['items']}
    timestamp = datetime.now(timezone.utc).isoformat()
    planned, uploads = [], {}
    for gdweb_id, (ident, background) in REVIEWED.items():
        assert reviews[gdweb_id]['catalog_match'] == ident and reviews[gdweb_id]['visual_review'] == 'match_candidate'
        assert stage[gdweb_id]['status'].startswith('vector_preflight_passed')
        raw = (OUT / f'{gdweb_id}.svg').read_bytes()
        assert digest(raw) == stage[gdweb_id]['sha256']
        png = cairosvg.svg2png(bytestring=raw, output_width=1200)
        with Image.open(io.BytesIO(png)) as image:
            alpha = image.convert('RGBA').getchannel('A')
            assert image.width >= 1000 and image.height >= 100 and alpha.getbbox()
            assert alpha.getextrema()[0] == 0
        prior_brand_raw = remote(ident, 'brand.json')
        prior_variants_raw = remote(ident, 'variants.json', required=False)
        brand = json.loads(prior_brand_raw)
        variants = json.loads(prior_variants_raw) if prior_variants_raw else {
            'schema': 1, 'algo_v': 1, 'id': ident, 'primary': 'legacy-png',
            'variants': [{'key': 'legacy-png', 'form': 'unknown', 'lang': 'unknown',
                          'color': 'original', 'label': '기존 수집 PNG · 보관',
                          'files': {'png': 'logo.png'}, 'origin': 'collected', 'order': 100}]}
        stem = 'sources/gdweb-official-20261016'
        svg_file, png_file = stem + '.svg', stem + '.png'
        uploads[f'_clients/{ident}/{svg_file}'] = (raw, 'image/svg+xml')
        uploads[f'_clients/{ident}/{png_file}'] = (png, 'image/png')
        if ident in ('seojinsystem', 'gigavis'):
            assert remote(ident, 'logo.svg', required=False) is None
            uploads[f'_clients/{ident}/logo.svg'] = (raw, 'image/svg+xml')
        variant = {'key': 'gdweb-official-20261016', 'form': 'wordmark', 'lockup': 'wordmark',
                   'lang': 'en', 'color': 'reverse' if background == 'dark' else 'original',
                   'label': '공식 사이트 워드마크 · 벡터', 'files': {'svg': svg_file, 'png': png_file},
                   'preview_png': png_file, 'origin': 'collected',
                   'provider': brand['domain'], 'source_url': selections[gdweb_id]['asset_url'],
                   'source_sha256': digest(raw), 'visual_sha256': digest(png),
                   'review_status': 'verified', 'order': 0}
        if ident == 'saltlux':
            # The old public SVG renders a different brand; retain bytes for history,
            # but do not offer it as a Saltlux downloadable variant.
            variants['variants'] = [item for item in variants['variants'] if item['key'] != 'wordmark']
        variants['variants'] = [item for item in variants['variants'] if item['key'] != variant['key']]
        variants['variants'].insert(0, variant)
        variants['primary'] = variant['key']
        patch = {
            'logo_svg': svg_file, 'svg_transparent': svg_file,
            'logo_png': png_file, 'preview_png': f'{CDN}/{ident}/{png_file}',
            'has_svg': True, 'has_png': True, 'catalog_override': True,
            'presentation': {'file': png_file, 'bg': background},
            'official_source_page': brand.get('website') or 'https://' + brand['domain'],
            'asset_origin': '기업 공식 사이트 SVG · GDWEB에서 사이트 발견 · 기존 자산 보존',
            'asset_review_status': 'verified', 'logo_published_at': timestamp,
        }
        if background == 'dark':
            patch['light'] = True
        else:
            patch['light'] = False
        if ident == 'saltlux':
            patch['rejected_asset_files'] = sorted(set(brand.get('rejected_asset_files') or []) | {'logo.svg', 'logo.png', 'logo-800.png'})
        updated_brand = {**brand, **patch}
        new_brand_raw = (json.dumps(updated_brand, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
        new_variants_raw = (json.dumps(variants, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
        planned.append({'id': ident, 'gdweb_id': gdweb_id, 'source_url': selections[gdweb_id]['asset_url'],
                        'source_sha256': digest(raw), 'prior_brand_sha256': digest(prior_brand_raw),
                        'prior_variants_sha256': digest(prior_variants_raw) if prior_variants_raw else None,
                        'prior_brand_raw': prior_brand_raw, 'prior_variants_raw': prior_variants_raw,
                        'brand_raw': new_brand_raw, 'variants_raw': new_variants_raw,
                        'patch': patch, 'variants': variants})
    return planned, uploads


def main(publish):
    planned, uploads = prepare()
    helper = runpy.run_path(str(ROOT / 'scripts/publish-svg-background-audit-20261014.py'))
    secret = helper['secrets']()
    db = helper['database'](secret['DB_VIBERS_MAIN_URL'])
    with db.cursor() as cursor:
        cursor.execute('SELECT id,status,payload FROM semologo.logo_posts WHERE id=ANY(%s)', ([r['id'] for r in planned],))
        posts = {row[0]: row for row in cursor.fetchall()}
        assert len(posts) == len(planned)
        for row in planned:
            post = posts[row['id']]
            assert post[1] == 'published' and post[2].get('name_ko') == json.loads(row['prior_brand_raw'])['name_ko']
            assert not post[2].get('catalog_override'), row['id'] + ': manually overridden already'
    plan = {'status': 'ready', 'brands': [{key: value for key, value in row.items()
            if key in ('id', 'gdweb_id', 'source_url', 'source_sha256', 'prior_brand_sha256', 'prior_variants_sha256')}
            for row in planned], 'uploads': [{'key': key, 'sha256': digest(raw), 'bytes': len(raw)}
                                         for key, (raw, _) in uploads.items()]}
    (OUT / 'existing-publication-plan.json').write_text(json.dumps(plan, ensure_ascii=False, indent=2) + '\n')
    if not publish:
        db.close()
        print(json.dumps({'status': 'ready', 'brands': len(planned), 'new_objects': len(uploads)}, ensure_ascii=False))
        return
    for row in planned:
        current = requests.get(row['source_url'], headers={'User-Agent': 'Mozilla/5.0'}, timeout=20)
        current.raise_for_status()
        assert digest(current.content) == row['source_sha256'], row['id'] + ': company SVG changed'
    s3 = boto3.client('s3', endpoint_url='https://kr.object.ncloudstorage.com', region_name='kr-standard',
        aws_access_key_id=secret['NCP_ACCESS_KEY'], aws_secret_access_key=secret['NCP_SECRET_KEY'],
        config=Config(signature_version='s3v4', request_checksum_calculation='when_required',
                      response_checksum_validation='when_required', retries={'max_attempts': 5}))
    for key, (raw, mime) in uploads.items():
        try:
            old = s3.get_object(Bucket=BUCKET, Key=key)['Body'].read()
            assert old == raw, key + ': immutable conflict'
        except ClientError as error:
            assert error.response['Error']['Code'] in ('404', 'NoSuchKey', 'NotFound')
            s3.put_object(Bucket=BUCKET, Key=key, Body=raw, ACL='public-read', ContentType=mime,
                          CacheControl='public,max-age=31536000,immutable', Metadata={'sha256': digest(raw)})
        assert s3.get_object(Bucket=BUCKET, Key=key)['Body'].read() == raw
    for row in planned:
        ident = row['id']
        assert remote(ident, 'brand.json') == row['prior_brand_raw'], ident + ': brand changed concurrently'
        assert remote(ident, 'variants.json', required=False) == row['prior_variants_raw'], ident + ': variants changed concurrently'
        (OUT / f'prior-{ident}-brand.json').write_bytes(row['prior_brand_raw'])
        if row['prior_variants_raw']:
            (OUT / f'prior-{ident}-variants.json').write_bytes(row['prior_variants_raw'])
        for file, raw in (('variants.json', row['variants_raw']), ('brand.json', row['brand_raw'])):
            key = f'_clients/{ident}/{file}'
            s3.put_object(Bucket=BUCKET, Key=key, Body=raw, ACL='public-read', ContentType='application/json',
                          CacheControl='public,max-age=60', Metadata={'sha256': digest(raw)})
            assert s3.get_object(Bucket=BUCKET, Key=key)['Body'].read() == raw
    with db:
        with db.cursor() as cursor:
            for row in planned:
                cursor.execute('SELECT payload FROM semologo.logo_posts WHERE id=%s AND status=%s FOR UPDATE',
                               (row['id'], 'published'))
                prior = cursor.fetchone()
                assert prior and not prior[0].get('catalog_override'), row['id'] + ': CMS changed concurrently'
                cursor.execute('UPDATE semologo.logo_posts SET payload=payload||%s::jsonb,updated_at=now() WHERE id=%s',
                               (json.dumps(row['patch'], ensure_ascii=False), row['id']))
                cursor.execute('SELECT id FROM semologo.logo_versions WHERE brand_id=%s AND is_current FOR UPDATE', (row['id'],))
                version = cursor.fetchone()
                assert version, row['id'] + ': version missing'
                cursor.execute('UPDATE semologo.logo_versions SET assets=assets||%s::jsonb,asset_manifest=%s::jsonb,label=%s,source_url=%s,source_note=%s,review_status=%s,verified_at=now() WHERE id=%s',
                               (json.dumps(row['patch'], ensure_ascii=False), json.dumps({'variants': row['variants']}, ensure_ascii=False),
                                '공식 사이트 워드마크 · 벡터', row['source_url'], 'GDWEB에서 사이트 발견. 기업 사이트 SVG와 흰색·검정 배경 렌더 검수. 기존 파일 보존.',
                                'verified', version[0]))
    db.close()
    (OUT / 'existing-published.json').write_text(json.dumps({'status': 'published',
        'ids': [r['id'] for r in planned], 'published_at': datetime.now(timezone.utc).isoformat()}, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'status': 'published', 'brands': [r['id'] for r in planned]}, ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--publish', action='store_true')
    main(parser.parse_args().publish)

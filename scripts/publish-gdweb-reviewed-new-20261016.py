#!/usr/bin/env python3
"""Publish four visually reviewed GDWEB-discovered official-site wordmarks."""

import argparse
import hashlib
import io
import json
import re
import runpy
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import boto3
import cairosvg
import requests
from botocore.config import Config
from botocore.exceptions import ClientError
from lxml import etree
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'marketing/assets/gdweb-official-review-20261016'
BUCKET = 'vibers-bucket'
CDN = 'https://logo.vibers.co.kr/_clients'
REVIEWED = {
    '27942': ('dtribe', '디트라이브', 'D:tribe', '서비스·기업', 'light'),
    '27799': ('makervil', '메이커빌', 'MAKERVIL', '서비스·기업', 'dark'),
    '27604': ('instantfunk', '인스턴트펑크', 'INSTANTFUNK', '뷰티·패션', 'light'),
    '27544': ('worxphere', '웍스피어', 'Worxphere', 'IT·테크', 'dark'),
}


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def normalized(value):
    return re.sub(r'[^a-z0-9가-힣]', '', unicodedata.normalize('NFKC', value).lower())


def vector(raw):
    assert b'<!DOCTYPE' not in raw.upper() and b'<!ENTITY' not in raw.upper()
    assert b'@import' not in raw.lower() and b'javascript:' not in raw.lower()
    root = etree.fromstring(raw, etree.XMLParser(resolve_entities=False, no_network=True))
    assert etree.QName(root).localname == 'svg'
    forbidden = {'script', 'foreignObject', 'image', 'text'}
    for node in root.iter():
        if not isinstance(node.tag, str):
            continue
        assert etree.QName(node).localname not in forbidden
        for key, value in node.attrib.items():
            local = etree.QName(key).localname.lower()
            assert not local.startswith('on')
            if local in ('href', 'src'):
                assert value.startswith('#')
            assert 'url(http' not in value.lower()
    return raw


def prepare():
    entries = {row['gdweb_id']: row for row in json.loads((ROOT / 'data/collection/gdweb-logo-candidates.json').read_text())['items']}
    selections = {row['gdweb_id']: row for row in json.loads((ROOT / 'data/collection/gdweb-svg-selections.json').read_text())['items']}
    review = {row['gdweb_id']: row for row in json.loads((ROOT / 'data/collection/gdweb-svg-review-20261016.json').read_text())['items']}
    stage = {row['gdweb_id']: row for row in json.loads((OUT / 'manifest.json').read_text())['items']}
    now = datetime.now(timezone.utc).isoformat()
    prepared, uploads = [], {}
    for gdweb_id, (ident, name_ko, name_en, category, background) in REVIEWED.items():
        entry, selected, checked, staged = entries[gdweb_id], selections[gdweb_id], review[gdweb_id], stage[gdweb_id]
        assert checked['catalog_match'] is None and checked['visual_review'] == 'match_candidate'
        assert checked['observed_form'] == 'wordmark' and staged['status'].startswith('vector_preflight_passed')
        assert selected['asset_url'] == staged['asset_url']
        host = urlparse(entry['official_site_candidate']).hostname
        assert host and urlparse(selected['asset_url']).hostname == host
        raw = vector((OUT / f'{gdweb_id}.svg').read_bytes())
        assert digest(raw) == staged['sha256']
        png = cairosvg.svg2png(bytestring=raw, output_width=1200)
        with Image.open(io.BytesIO(png)) as image:
            alpha = image.convert('RGBA').getchannel('A')
            assert image.width >= 1000 and image.height >= 100 and alpha.getbbox()
            assert alpha.getextrema()[0] == 0, ident + ': logo background is not transparent'
        brand = {
            'id': ident, 'name_ko': name_ko, 'name_en': name_en,
            'category': category, 'origin': 'KR', 'has_svg': True, 'has_png': True,
            'logo_svg': 'logo.svg', 'logo_png': 'logo.png',
            'preview_png': f'{CDN}/{ident}/logo.png',
            'website': entry['official_site_candidate'], 'domain': host.removeprefix('www.'),
            'official_source_page': entry['official_site_candidate'],
            'asset_origin': '브랜드 사이트에 게시된 SVG · GDWEB에서 사이트 발견 · 공식 CI 배포 패키지 여부 미확인',
            'asset_review_status': 'verified', 'added_at': now[:10], 'logo_published_at': now,
            'presentation': {'file': 'logo.png', 'bg': background},
        }
        if background == 'dark':
            brand['light'] = True
        variant = {
            'key': 'official-site-wordmark', 'form': 'wordmark', 'lockup': 'wordmark',
            'lang': 'en', 'color': 'reverse' if background == 'dark' else 'original',
            'label': '공식 사이트 워드마크', 'files': {'svg': 'logo.svg', 'png': 'logo.png'},
            'preview_png': 'logo.png', 'origin': 'collected', 'provider': host,
            'source_url': selected['asset_url'], 'source_sha256': digest(raw),
            'visual_sha256': digest(png), 'review_status': 'verified', 'order': 0,
        }
        manifest = {'schema': 1, 'algo_v': 1, 'id': ident,
                    'primary': 'official-site-wordmark', 'variants': [variant]}
        files = {
            'logo.svg': (raw, 'image/svg+xml'), 'logo.png': (png, 'image/png'),
            'brand.json': ((json.dumps(brand, ensure_ascii=False, separators=(',', ':')) + '\n').encode(), 'application/json'),
            'variants.json': ((json.dumps(manifest, ensure_ascii=False, separators=(',', ':')) + '\n').encode(), 'application/json'),
        }
        for filename, value in files.items():
            uploads[f'_clients/{ident}/{filename}'] = value
        prepared.append({'gdweb_id': gdweb_id, 'id': ident, 'name': name_ko,
                         'asset_url': selected['asset_url'], 'source_sha256': digest(raw),
                         'brand': brand, 'manifest': manifest})
    return prepared, uploads


def main(publish):
    prepared, uploads = prepare()
    helper = runpy.run_path(str(ROOT / 'scripts/publish-svg-background-audit-20261014.py'))
    secret = helper['secrets']()
    db = helper['database'](secret['DB_VIBERS_MAIN_URL'])
    ids = [row['id'] for row in prepared]
    with db.cursor() as cursor:
        cursor.execute('SELECT id FROM semologo.logo_posts WHERE id=ANY(%s)', (ids,))
        assert not cursor.fetchall(), 'Selected CMS ID already exists'
        for row in prepared:
            cursor.execute("SELECT id FROM semologo.logo_posts WHERE status='published' AND (lower(payload->>'name_ko')=lower(%s) OR lower(payload->>'name_en')=lower(%s)) LIMIT 1", (row['name'], row['brand']['name_en']))
            assert not cursor.fetchone(), row['name'] + ': duplicate CMS brand'
    response = requests.get('https://kr.object.ncloudstorage.com/vibers-bucket/_clients/brands-slim.json', timeout=60)
    response.raise_for_status()
    catalog = response.json()
    catalog = catalog.get('brands', catalog) if isinstance(catalog, dict) else catalog
    assert not {item['id'] for item in catalog}.intersection(ids), 'Selected catalog ID already exists'
    existing_names = {normalized(value) for item in catalog
                      for value in (item.get('name_ko'), item.get('name_en'), *(item.get('aliases') or [])) if value}
    for row in prepared:
        assert normalized(row['name']) not in existing_names, row['name'] + ': catalog name already exists'
        assert normalized(row['brand']['name_en']) not in existing_names, row['id'] + ': catalog English name already exists'
    plan = {'schema': 1, 'status': 'ready', 'brands': [
        {key: value for key, value in row.items() if key not in ('brand', 'manifest')} for row in prepared],
        'uploads': [{'key': key, 'sha256': digest(raw), 'bytes': len(raw)} for key, (raw, _) in uploads.items()],
        'catalog_sha256': digest(response.content)}
    (OUT / 'new-publication-plan.json').write_text(json.dumps(plan, ensure_ascii=False, indent=2) + '\n')
    if not publish:
        db.close()
        print(json.dumps({'status': 'ready', 'brands': len(prepared), 'objects': len(uploads)}, ensure_ascii=False))
        return
    for row in prepared:
        current = requests.get(row['asset_url'], headers={'User-Agent': 'Mozilla/5.0'}, timeout=20)
        current.raise_for_status()
        assert digest(current.content) == row['source_sha256'], row['id'] + ': official site SVG changed'
    s3 = boto3.client('s3', endpoint_url='https://kr.object.ncloudstorage.com', region_name='kr-standard',
        aws_access_key_id=secret['NCP_ACCESS_KEY'], aws_secret_access_key=secret['NCP_SECRET_KEY'],
        config=Config(signature_version='s3v4', request_checksum_calculation='when_required',
                      response_checksum_validation='when_required', retries={'max_attempts': 5}))
    for key, (raw, mime) in uploads.items():
        try:
            old = s3.get_object(Bucket=BUCKET, Key=key)['Body'].read()
            assert old == raw, key + ': immutable object conflict'
        except ClientError as error:
            assert error.response['Error']['Code'] in ('404', 'NoSuchKey', 'NotFound')
            s3.put_object(Bucket=BUCKET, Key=key, Body=raw, ACL='public-read', ContentType=mime,
                          CacheControl='public,max-age=60' if key.endswith('.json') else 'public,max-age=31536000,immutable',
                          Metadata={'sha256': digest(raw)})
        assert s3.get_object(Bucket=BUCKET, Key=key)['Body'].read() == raw
    with db:
        with db.cursor() as cursor:
            for row in prepared:
                cursor.execute("INSERT INTO semologo.logo_posts(id,payload,status) VALUES(%s,%s::jsonb,'published') ON CONFLICT DO NOTHING",
                               (row['id'], json.dumps(row['brand'], ensure_ascii=False)))
                assert cursor.rowcount == 1, row['id']
                cursor.execute('SELECT id FROM semologo.logo_versions WHERE brand_id=%s AND is_current FOR UPDATE', (row['id'],))
                version = cursor.fetchone()
                assert version, row['id'] + ': version trigger missing'
                cursor.execute('UPDATE semologo.logo_versions SET asset_manifest=%s::jsonb,review_status=%s,verified_at=now() WHERE id=%s',
                               (json.dumps({'variants': row['manifest']}, ensure_ascii=False), 'verified', version[0]))
    db.close()
    (OUT / 'new-published.json').write_text(json.dumps({'status': 'published', 'ids': ids,
        'objects': len(uploads), 'published_at': datetime.now(timezone.utc).isoformat()}, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'status': 'published', 'brands': ids, 'objects': len(uploads)}, ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--publish', action='store_true')
    main(parser.parse_args().publish)

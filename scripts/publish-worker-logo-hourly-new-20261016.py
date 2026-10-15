#!/usr/bin/env python3
"""Publish reviewed official SVGs collected by the hourly worker fleet."""
import argparse
import hashlib
import io
import json
import runpy
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

import boto3
import cairosvg
from botocore.config import Config
from botocore.exceptions import ClientError
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CDN = 'https://logo.vibers.co.kr/_clients'
BUCKET = 'vibers-bucket'
BATCHES = {
    'r27': (
        ROOT / 'marketing/assets/worker-logo-hourly-reviewed-20261016',
        ROOT / 'marketing/assets/worker-logo-hourly-backlog-20261016/semologo-sources.json',
        {
            'us-index-btsg': ('brightspring-health-services', 'BrightSpring Health Services', '의료·바이오', 'light'),
            'us-index-gkos': ('glaukos', 'Glaukos', '의료·바이오', 'light'),
            'us-index-krys': ('krystal-biotech', 'Krystal Biotech', '의료·바이오', 'light'),
            'us-index-umbf': ('umb-financial', 'UMB Financial', '금융·결제', 'light'),
        }),
    'r28-vaxcyte': (
        ROOT / 'marketing/assets/worker-logo-hourly-new-20261016',
        ROOT / 'marketing/assets/worker-logo-hourly-new-20261016/semologo-sources.json',
        {'us-hourly-pcvx': ('vaxcyte', 'Vaxcyte', '의료·바이오', 'light')}),
    'r28-cycle': (
        ROOT / 'marketing/assets/worker-logo-hourly-r28-cycle-20261016',
        ROOT / 'marketing/assets/worker-logo-hourly-new-20261016/semologo-sources.json',
        {
            'us-hourly-jbtm': ('jbt-marel', 'JBT Marel', '제조·그룹', 'light'),
            'us-hourly-lnth': ('lantheus', 'Lantheus', '의료·바이오', 'light'),
            'us-hourly-novt': ('novanta', 'Novanta', '제조·그룹', 'light'),
        }),
    'r28-next': (
        ROOT / 'marketing/assets/worker-logo-hourly-20261016-0832',
        ROOT / 'marketing/assets/worker-logo-hourly-new-20261016/semologo-sources.json',
        {
            'us-hourly-gva': ('granite-construction', 'Granite Construction', '건설·부동산', 'light'),
            'us-hourly-hcc': ('warrior-met-coal', 'Warrior Met Coal', '에너지·화학', 'light'),
            'us-hourly-opln': ('openlane', 'OPENLANE', '유통·쇼핑', 'light'),
            'us-hourly-tpc': ('tutor-perini', 'Tutor Perini', '건설·부동산', 'light'),
        }),
}


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def main(publish, batch):
    output, plan, reviewed = BATCHES[batch]
    results = {row['sourceId']: row for row in json.loads((output / 'manifest.json').read_text())['results']}
    sources = {row['id']: row for row in json.loads(plan.read_text())['sources']}
    audits = {row['sourceId']: row for row in json.loads((output / 'audit.json').read_text())}
    helper = runpy.run_path(str(ROOT / 'scripts/publish-svg-background-audit-20261014.py'))
    secret = helper['secrets']()
    db = helper['database'](secret['DB_VIBERS_MAIN_URL'])
    s3 = boto3.client('s3', endpoint_url='https://kr.object.ncloudstorage.com', region_name='kr-standard',
        aws_access_key_id=secret['NCP_ACCESS_KEY'], aws_secret_access_key=secret['NCP_SECRET_KEY'],
        config=Config(signature_version='s3v4', request_checksum_calculation='when_required',
                      response_checksum_validation='when_required'))
    uploaded = {}
    prepared = []
    timestamp = datetime.now(timezone.utc).isoformat()
    for source_id, (ident, name, category, background) in reviewed.items():
        source, result, audit = sources[source_id], results[source_id], audits[source_id]
        assert result['status'] == 'succeeded' and result['sourceChanged'] is False
        assert audit['safe'] and audit['safety'] == 'safe-vector' and audit['bbox']
        raw = (output / result['file']).read_bytes()
        assert sha(raw) == source['expectedSha256'] == result['sha256']
        assert b'<image' not in raw.lower() and b'<script' not in raw.lower()
        with urlopen(Request(source['assetUrl'], headers={'User-Agent': 'Mozilla/5.0 SemoLogo-source-preflight'}), timeout=20) as response:
            current = response.read(150_001)
            assert response.status == 200
        assert current == raw, source_id + ': official source changed'
        png = cairosvg.svg2png(bytestring=raw, output_width=1200)
        with Image.open(io.BytesIO(png)) as image:
            rgba = image.convert('RGBA')
            assert image.width >= 1000 and image.height >= 100
            assert rgba.getchannel('A').getbbox() and rgba.getchannel('A').getextrema()[0] == 0
        domain = urlparse(source['sourcePage']).hostname
        assert domain and urlparse(source['assetUrl']).hostname.endswith(domain.removeprefix('www.'))
        ticker = source_id.rsplit('-', 1)[-1].upper()
        brand = {'id': ident, 'name_ko': name, 'name_en': name, 'category': category,
                 'origin': 'GLOBAL', 'has_svg': True, 'has_png': True,
                 'logo_svg': 'logo.svg', 'logo_png': 'logo.png',
                 'preview_png': f'{CDN}/{ident}/logo.png',
                 'website': 'https://' + domain + '/', 'domain': domain.removeprefix('www.'),
                 'official_source_page': source['sourcePage'],
                 'asset_origin': '기업 공식 사이트 SVG · 원본 해시와 라이트/다크 미리보기 검수',
                 'asset_review_status': 'verified', 'added_at': timestamp[:10],
                 'logo_published_at': timestamp, 'aliases': [ticker]}
        if background == 'dark':
            brand['presentation'] = {'file': 'logo.png', 'bg': 'dark'}
            brand['light'] = True
        variants = {'schema': 1, 'algo_v': 1, 'id': ident, 'primary': 'official-site',
                    'variants': [{'key': 'official-site', 'form': 'horizontal', 'lockup': 'horizontal',
                                  'lang': 'en', 'color': 'reverse' if background == 'dark' else 'original',
                                  'label': '기업 사이트 로고', 'files': {'svg': 'logo.svg', 'png': 'logo.png'},
                                  'preview_png': 'logo.png', 'origin': 'official-site',
                                  'provider': domain, 'source_url': source['assetUrl'],
                                  'source_sha256': sha(raw), 'visual_sha256': sha(png),
                                  'review_status': 'verified', 'order': 0}]}
        for filename, value, mime in [('logo.svg', raw, 'image/svg+xml'), ('logo.png', png, 'image/png'),
                                      ('brand.json', (json.dumps(brand, ensure_ascii=False, separators=(',', ':')) + '\n').encode(), 'application/json'),
                                      ('variants.json', (json.dumps(variants, ensure_ascii=False, separators=(',', ':')) + '\n').encode(), 'application/json')]:
            uploaded[f'_clients/{ident}/{filename}'] = (value, mime)
        prepared.append({'id': ident, 'name': name, 'sourceId': source_id, 'brand': brand,
                         'variants': variants, 'sourceSha256': sha(raw)})

    with db.cursor() as cursor:
        cursor.execute('SELECT id FROM semologo.logo_posts WHERE id=ANY(%s)', ([row['id'] for row in prepared],))
        assert not cursor.fetchall(), 'A selected CMS ID already exists'
        for row in prepared:
            cursor.execute("SELECT id FROM semologo.logo_posts WHERE status='published' AND (lower(payload->>'name_ko')=lower(%s) OR lower(payload->>'name_en')=lower(%s)) LIMIT 5", (row['name'], row['name']))
            assert not cursor.fetchall(), row['name'] + ': duplicate company name'
    # The static catalog and the live CMS are separate identity checks.
    snapshot = output / 'catalog-baseline-slim.json'
    if not snapshot.exists():
        with urlopen('https://kr.object.ncloudstorage.com/vibers-bucket/_clients/brands-slim.json', timeout=120) as response:
            snapshot.write_bytes(response.read())
    slim = json.loads(snapshot.read_text())
    slim = slim.get('brands', slim) if isinstance(slim, dict) else slim
    ids = {row['id'] for row in slim}
    assert not ids.intersection(row['id'] for row in prepared)
    (output / 'new-publication-plan.json').write_text(json.dumps({'schema': 1,
        'items': [{k: v for k, v in row.items() if k not in ('brand', 'variants')} for row in prepared],
        'uploads': [{'key': key, 'sha256': sha(raw), 'bytes': len(raw)} for key, (raw, _) in uploaded.items()]},
        ensure_ascii=False, indent=2) + '\n')
    if not publish:
        db.close()
        print(json.dumps({'status': 'ready', 'newBrands': len(prepared), 'uploads': len(uploaded)}))
        return
    for key, (raw, mime) in uploaded.items():
        try:
            prior = s3.get_object(Bucket=BUCKET, Key=key)['Body'].read()
            assert prior == raw, key + ': immutable object conflict'
        except ClientError as error:
            assert error.response['Error']['Code'] in ('404', 'NoSuchKey', 'NotFound')
            s3.put_object(Bucket=BUCKET, Key=key, Body=raw, ACL='public-read', ContentType=mime,
                          CacheControl='public,max-age=60' if key.endswith('.json') else 'public,max-age=31536000,immutable',
                          Metadata={'sha256': sha(raw)})
        assert s3.get_object(Bucket=BUCKET, Key=key)['Body'].read() == raw
    with db:
        with db.cursor() as cursor:
            for row in prepared:
                cursor.execute("SELECT id FROM semologo.logo_posts WHERE status='published' AND (lower(payload->>'name_ko')=lower(%s) OR lower(payload->>'name_en')=lower(%s)) LIMIT 1 FOR UPDATE", (row['name'], row['name']))
                assert not cursor.fetchone(), row['name'] + ': concurrent duplicate'
                cursor.execute("INSERT INTO semologo.logo_posts(id,payload,status) VALUES(%s,%s::jsonb,'published') ON CONFLICT DO NOTHING",
                    (row['id'], json.dumps(row['brand'], ensure_ascii=False)))
                assert cursor.rowcount == 1, row['id']
                cursor.execute('SELECT id FROM semologo.logo_versions WHERE brand_id=%s AND is_current FOR UPDATE', (row['id'],))
                current = cursor.fetchall()
                assert len(current) == 1, row['id'] + ': version trigger missing'
                cursor.execute('UPDATE semologo.logo_versions SET asset_manifest=%s::jsonb,review_status=%s,verified_at=now() WHERE id=%s',
                    (json.dumps({'variants': row['variants']}, ensure_ascii=False), 'verified', current[0][0]))
    with db.cursor() as cursor:
        cursor.execute("SELECT count(*) FROM semologo.logo_posts WHERE id=ANY(%s) AND status='published'", ([row['id'] for row in prepared],))
        assert cursor.fetchone()[0] == len(prepared)
    db.close()
    (output / 'new-published.json').write_text(json.dumps({'status': 'published',
        'brands': [row['id'] for row in prepared], 'verifiedObjects': len(uploaded),
        'publishedAt': timestamp}, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'status': 'published', 'newBrands': len(prepared), 'verifiedObjects': len(uploaded)}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--publish', action='store_true')
    parser.add_argument('--batch', choices=sorted(BATCHES), default='r27')
    args = parser.parse_args()
    main(args.publish, args.batch)

#!/usr/bin/env python3
"""Publish visually reviewed, new US-index company logos from archived site SVGs.

The selection is deliberately explicit. Discovery results are candidates, not
permission to publish a favicon, partner badge, embedded bitmap, or duplicate.
Run without --publish to validate and write a reviewable plan.
"""
import argparse
import hashlib
import html
import io
import json
import re
import runpy
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

import boto3
import cairosvg
from botocore.config import Config
from botocore.exceptions import ClientError
from lxml import etree
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'marketing/assets/index-new-batch-20261015'
BUCKET = 'vibers-bucket'
CDN = 'https://logo.vibers.co.kr/_clients'

# ticker: (stable slug, public name, category). Every image was checked on the
# contact sheet; ambiguous/blank/third-party artwork is intentionally absent.
REVIEWED = {
    'NKTX': ('nkarta', 'Nkarta', '의료·바이오'),
    'IRWD': ('ironwood-pharmaceuticals', 'Ironwood Pharmaceuticals', '의료·바이오'),
    'MGNI': ('magnite', 'Magnite', '미디어·엔터'),
    'SRZN': ('surrozen', 'Surrozen', '의료·바이오'),
    'ASUR': ('asure-software', 'Asure Software', 'IT·테크'),
    'TGTX': ('tg-therapeutics', 'TG Therapeutics', '의료·바이오'),
    'NUVB': ('nuvation-bio', 'Nuvation Bio', '의료·바이오'),
    'CTRE': ('caretrust-reit', 'CareTrust REIT', '건설·부동산'),
    'ELVN': ('enliven-therapeutics', 'Enliven Therapeutics', '의료·바이오'),
    'NAVI': ('navient', 'Navient', '금융·결제'),
    'AVPT': ('avepoint', 'AvePoint', 'IT·테크'),
    'FIVN': ('five9', 'Five9', 'IT·테크'),
    'BLFS': ('biolife-solutions', 'BioLife Solutions', '의료·바이오'),
    'VCYT': ('veracyte', 'Veracyte', '의료·바이오'),
    'RBBN': ('ribbon-communications', 'Ribbon Communications', '통신'),
    'CRBU': ('caribou-biosciences', 'Caribou Biosciences', '의료·바이오'),
    'CNR': ('core-natural-resources', 'Core Natural Resources', '에너지·화학'),
    'CNMD': ('conmed', 'CONMED', '의료·바이오'),
    'MRCY': ('mercury-systems', 'Mercury Systems', '항공·우주·방산'),
    'ACHC': ('acadia-healthcare', 'Acadia Healthcare', '의료·바이오'),
    'RDVT': ('red-violet', 'red violet', 'IT·테크'),
    'SNDA': ('sonida-senior-living', 'Sonida Senior Living', '의료·바이오'),
    'INTA': ('intapp', 'Intapp', 'IT·테크'),
    'KOPN': ('kopin', 'Kopin', 'IT·테크'),
    'OPFI': ('oppfi', 'OppFi', '금융·결제'),
    'MGRC': ('mcgrath-rentcorp', 'McGrath RentCorp', '유통·쇼핑'),
    'DGII': ('digi-international', 'Digi International', 'IT·테크'),
    'SABS': ('sab-biotherapeutics', 'SAB Biotherapeutics', '의료·바이오'),
    'NKSH': ('national-bankshares', 'National Bankshares', '금융·결제'),
}
PROHIBITED_TICKER_IDENTITIES = {
    'CPS': 'cooper-standard',
    'INBK': 'first-internet-bank',
    'KWY': 'kingsway-corporation',
}


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def canonical(raw):
    xml = etree.fromstring(raw, etree.XMLParser(resolve_entities=False, no_network=True))
    assert etree.QName(xml).localname == 'svg'
    assert b'<!ENTITY' not in raw and b'@import' not in raw and b'<script' not in raw.lower()
    forbidden = {'script', 'foreignObject', 'image', 'text'}
    assert not any(etree.QName(el).localname in forbidden for el in xml.iter() if isinstance(el.tag, str))
    for el in xml.iter():
        if not isinstance(el.tag, str):
            continue
        for key, value in el.attrib.items():
            assert not etree.QName(key).localname.lower().startswith('on')
            if etree.QName(key).localname.lower() in {'href', 'src'}:
                assert value.startswith('#')
            assert 'url(http' not in value.lower() and 'javascript:' not in value.lower()
    return raw


def main(publish, selection_path=None):
    selection = json.loads(selection_path.read_text()) if selection_path else None
    reviewed = {ticker: tuple(values) for ticker, values in selection['reviewed'].items()} if selection else REVIEWED
    out = (ROOT / 'marketing/assets' / selection['batch']).resolve() if selection else OUT
    assert out.is_relative_to(ROOT / 'marketing/assets') and out.name.startswith('index-new-batch')
    discovery = {row['ticker']: row for row in json.loads((ROOT / 'data/collection/us-equity-index-logo-discovery.json').read_text())['items']}
    candidates = {row['ticker']: row for row in json.loads((ROOT / 'data/collection/us-equity-index-logo-review-queue.json').read_text())['items']}
    published_at = datetime.now(timezone.utc).isoformat()
    prepared = []
    uploads = {}
    for ticker, values in reviewed.items():
        ident, name, category = values[:3]
        assert ident != PROHIBITED_TICKER_IDENTITIES.get(ticker), 'Index/domain identity mismatch: ' + ticker
        form = values[3] if len(values) > 3 else ('symbol' if ticker == 'CTRE' else 'horizontal')
        dark = values[4] if len(values) > 4 else False
        alias_mode = values[5] if len(values) > 5 else 'source'
        assert form in {'symbol', 'horizontal', 'vertical', 'wordmark'} and isinstance(dark, bool)
        assert alias_mode in {'source', 'none'}
        source = discovery[ticker]
        candidate = candidates[ticker]
        assert candidate['format'] == 'svg'
        path = Path(candidate['file'])
        assert path.is_file() and path.stat().st_size == candidate['bytes']
        raw = canonical(path.read_bytes())
        domain = source.get('official_domain') or source.get('domain_candidate')
        assert domain and source['company_name']
        asset_url = next((html.unescape(u) for u in source['asset_links']
                          if re.sub(r'[^0-9A-Za-z._-]', '_', Path(urlparse(u).path).name) == path.name), None)
        assert asset_url and urlparse(asset_url).hostname.endswith(domain), ticker
        png = cairosvg.svg2png(bytestring=raw, output_width=1200)
        with Image.open(io.BytesIO(png)) as image:
            rgba = image.convert('RGBA')
            alpha = rgba.getchannel('A')
            assert alpha.getbbox() and alpha.getextrema()[0] == 0
            assert image.width >= 1000 and image.height >= 100
        files = {'logo.svg': (raw, 'image/svg+xml'), 'logo.png': (png, 'image/png')}
        brand = {'id': ident, 'name_ko': name, 'name_en': name, 'category': category,
                 'origin': 'GLOBAL', 'has_svg': True, 'has_png': True,
                 'logo_svg': 'logo.svg', 'logo_png': 'logo.png',
                 'preview_png': f'{CDN}/{ident}/logo.png',
                 'website': 'https://' + domain + '/', 'domain': domain,
                 'official_source_page': 'https://' + domain + '/',
                 'asset_origin': '기업 사이트에서 수집한 SVG · 공식 CI 배포 패키지 여부 미확인',
                 'asset_review_status': 'verified', 'added_at': published_at[:10],
                 'logo_published_at': published_at,
                 'aliases': [source['company_name'], ticker] if alias_mode == 'source' else []}
        if dark:
            brand.update({'light': True, 'presentation': {'file': 'logo.png', 'bg': 'dark'}})
        manifest = {'schema': 1, 'algo_v': 1, 'id': ident, 'primary': 'site-logo',
                    'variants': [{'key': 'site-logo', 'form': form,
                                  'lockup': form, 'lang': 'none' if form == 'symbol' else 'en',
                                  'color': 'reverse' if dark else 'original',
                                  'label': '기업 사이트 SVG', 'files': {'svg': 'logo.svg', 'png': 'logo.png'},
                                  'preview_png': 'logo.png', 'origin': 'collected', 'provider': domain,
                                  'source_url': asset_url, 'source_sha256': digest(raw),
                                  'visual_sha256': digest(png), 'review_status': 'verified', 'order': 0}]}
        files['brand.json'] = ((json.dumps(brand, ensure_ascii=False, separators=(',', ':')) + '\n').encode(), 'application/json')
        files['variants.json'] = ((json.dumps(manifest, ensure_ascii=False, separators=(',', ':')) + '\n').encode(), 'application/json')
        for filename, value in files.items():
            uploads[f'_clients/{ident}/{filename}'] = value
        prepared.append({'ticker': ticker, 'id': ident, 'name': name, 'brand': brand,
                         'manifest': manifest, 'source_url': asset_url, 'source_sha256': digest(raw)})

    publisher = runpy.run_path(str(ROOT / 'scripts/publish-svg-background-audit-20261014.py'))
    secrets = publisher['secrets']()
    db = publisher['database'](secrets['DB_VIBERS_MAIN_URL'])
    with db.cursor() as cursor:
        cursor.execute('SELECT id FROM semologo.logo_posts WHERE id=ANY(%s)', ([r['id'] for r in prepared],))
        assert not cursor.fetchall(), 'Some selected CMS IDs already exist'
    # The fixed catalog and CMS overlay are both checked before any write.
    out.mkdir(parents=True, exist_ok=True)
    catalog_snapshot = out / 'catalog-baseline-slim.json'
    if not catalog_snapshot.exists():
        with urlopen('https://kr.object.ncloudstorage.com/vibers-bucket/_clients/brands-slim.json', timeout=120) as response:
            catalog_snapshot.write_bytes(response.read())
    slim = json.loads(catalog_snapshot.read_text())
    slim = slim.get('brands', slim) if isinstance(slim, dict) else slim
    ids = {row['id'] for row in slim}
    assert not ids.intersection(r['id'] for r in prepared), 'Some selected catalog IDs already exist'
    (out / 'publication-plan.json').write_text(json.dumps({
        'schema': 1, 'count': len(prepared), 'items': [{k: v for k, v in row.items() if k not in ('brand', 'manifest')} for row in prepared],
        'uploads': [{'key': key, 'sha256': digest(raw), 'bytes': len(raw)} for key, (raw, _) in uploads.items()]
    }, ensure_ascii=False, indent=2) + '\n')
    if not publish:
        print(json.dumps({'status': 'ready', 'new_brands': len(prepared), 'uploads': len(uploads)}, ensure_ascii=False))
        db.close()
        return

    # The September archive is only published if the company still serves the
    # exact same vector today. A 200 HTML fallback or redesign fails closed.
    provenance = []
    for row in prepared:
        request = Request(row['source_url'], headers={'User-Agent': 'Mozilla/5.0'})
        with urlopen(request, timeout=20) as response:
            current = response.read(1_000_001)
            assert response.status == 200 and 'svg' in response.headers.get('content-type', '').lower(), row['ticker']
        assert digest(current) == row['source_sha256'], row['ticker'] + ': site asset changed'
        provenance.append({'ticker': row['ticker'], 'source_url': row['source_url'], 'sha256': row['source_sha256']})
    (out / 'source-verification.json').write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + '\n')

    s3 = boto3.client('s3', endpoint_url='https://kr.object.ncloudstorage.com', region_name='kr-standard',
        aws_access_key_id=secrets['NCP_ACCESS_KEY'], aws_secret_access_key=secrets['NCP_SECRET_KEY'],
        config=Config(signature_version='s3v4', request_checksum_calculation='when_required',
                      response_checksum_validation='when_required', retries={'max_attempts': 5}))
    for key, (raw, mime) in uploads.items():
        try:
            saved = s3.get_object(Bucket=BUCKET, Key=key)['Body'].read()
            assert saved == raw, 'Existing object conflict: ' + key
        except ClientError as error:
            assert error.response['Error']['Code'] in {'404', 'NoSuchKey', 'NotFound'}
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
    with db.cursor() as cursor:
        cursor.execute("SELECT count(*) FROM semologo.logo_posts WHERE id=ANY(%s) AND status='published'", ([r['id'] for r in prepared],))
        assert cursor.fetchone()[0] == len(prepared)
    db.close()
    (out / 'published.json').write_text(json.dumps({'count': len(prepared), 'ids': [r['id'] for r in prepared],
        'verified_objects': len(uploads), 'published_at': published_at}, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'status': 'published', 'new_brands': len(prepared), 'verified_objects': len(uploads)}, ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--publish', action='store_true')
    parser.add_argument('--selection', type=Path, help='JSON with batch name and visually reviewed ticker identities')
    args = parser.parse_args()
    main(args.publish, args.selection)

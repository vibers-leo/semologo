#!/usr/bin/env python3
"""Upgrade three exact-matched PNG-only records with reviewed official SVGs."""
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
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'marketing/assets/worker-logo-cycle-20261015c'
PLAN = ROOT / 'data/collection/semologo-worker-sources-cycle-20261015c.json'
SELECTION = {
    'ko-official-국립중앙의료원-logo': 'gongu-ci-0980',
    'ko-official-eco융합섬유연구원-logo': 'gongu-ci-0137',
    'ko-official-국민권익위원회-main-logo': 'gongu-ci-0987',
}


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def main(publish):
    sources = {x['id']: x for x in json.loads(PLAN.read_text())['sources']}
    results = {x['sourceId']: x for x in json.loads((OUT / 'manifest.json').read_text())['results']}
    audits = {x['sourceId']: x for x in json.loads((OUT / 'audit.json').read_text())['rows']}
    helper = runpy.run_path(str(ROOT / 'scripts/publish-svg-background-audit-20261014.py'))
    secret = helper['secrets']()
    db = helper['database'](secret['DB_VIBERS_MAIN_URL'])
    s3 = boto3.client('s3', endpoint_url='https://kr.object.ncloudstorage.com', region_name='kr-standard',
        aws_access_key_id=secret['NCP_ACCESS_KEY'], aws_secret_access_key=secret['NCP_SECRET_KEY'],
        config=Config(signature_version='s3v4', request_checksum_calculation='when_required',
                      response_checksum_validation='when_required'))
    rows = []
    for source_id, brand_id in SELECTION.items():
        source, result, audit = sources[source_id], results[source_id], audits[source_id]
        assert result['status'] == 'succeeded' and audit['safety'] == 'safe-vector' and audit['rendered']
        raw = (OUT / result['file']).read_bytes()
        assert sha(raw) == result['sha256'] == source['expectedSha256']
        with urlopen(Request(source['assetUrl'], headers={'User-Agent': 'Mozilla/5.0 SemoLogo-source-preflight'}), timeout=20) as response:
            current = response.read(150_001)
        assert sha(current) == sha(raw)
        png = cairosvg.svg2png(bytestring=raw, output_width=1200)
        with Image.open(io.BytesIO(png)) as image:
            rgba = image.convert('RGBA')
            assert rgba.width >= 1000 and rgba.height >= 100 and rgba.getchannel('A').getbbox()
        with db.cursor() as cursor:
            cursor.execute('SELECT status,payload FROM semologo.logo_posts WHERE id=%s', (brand_id,))
            item = cursor.fetchone()
            cursor.execute('SELECT id,asset_manifest FROM semologo.logo_versions WHERE brand_id=%s AND is_current', (brand_id,))
            versions = cursor.fetchall()
        assert item and item[0] == 'published' and len(versions) == 1
        post = item[1]
        assert post['name_ko'] == source['nameKo'] and not post.get('logo_svg') and not post.get('presentation')
        assert versions[0][1] is None
        old = s3.get_object(Bucket='vibers-bucket', Key=f'_clients/{brand_id}/logo.png')['Body'].read()
        assert old.startswith(b'\x89PNG')
        stem = 'sources/worker-large-reviewed-20261015/' + sha(raw)[:20]
        svg_rel, png_rel = stem + '.svg', stem + '.png'
        variants = {'schema': 1, 'algo_v': 1, 'id': brand_id, 'primary': 'official-site-20261015',
                    'variants': [
                        {'key': 'official-site-20261015', 'form': 'horizontal', 'lockup': 'horizontal',
                         'lang': 'ko', 'color': 'original', 'label': '기관 공식 사이트 벡터',
                         'files': {'svg': svg_rel, 'png': png_rel}, 'preview_png': png_rel,
                         'origin': 'official-site', 'official': False, 'provider': source['nameKo'],
                         'source_url': source['assetUrl'], 'source_sha256': sha(raw),
                         'visual_sha256': sha(png), 'review_status': 'verified', 'order': 0},
                        {'key': 'existing-png', 'form': 'horizontal', 'lockup': 'horizontal',
                         'lang': 'ko', 'color': 'original', 'label': '기존 제공 PNG',
                         'files': {'png': 'logo.png'}, 'preview_png': 'logo.png',
                         'origin': 'collected', 'order': 1}]}
        patch = {'has_svg': True, 'logo_svg': svg_rel, 'svg_transparent': svg_rel,
                 'has_png': True, 'logo_png': png_rel,
                 'preview_png': f'https://logo.vibers.co.kr/_clients/{brand_id}/{png_rel}',
                 'presentation': {'file': png_rel, 'bg': 'light'}, 'variants_n': 2,
                 'official_source_page': source['sourcePage'],
                 'asset_origin': '기관 공식 사이트 SVG · 기존 PNG 보존',
                 'asset_review_status': 'verified',
                 'logo_published_at': datetime.now(timezone.utc).isoformat()}
        rows.append({'id': brand_id, 'sourceId': source_id, 'sourceSha256': sha(raw),
                     'oldPngSha256': sha(old), 'baseline': post, 'raw': raw, 'png': png,
                     'svgRel': svg_rel, 'pngRel': png_rel, 'variants': variants, 'patch': patch})
    summary = {'brands': [{k: x[k] for k in ('id', 'sourceId', 'sourceSha256', 'oldPngSha256')}
                           for x in rows], 'status': 'ready' if not publish else 'publishing'}
    (OUT / 'reviewed-publication-plan.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n')
    if not publish:
        db.close()
        print(json.dumps({'status': 'ready', 'brands': len(rows)}))
        return
    for row in rows:
        for relative, content, mime in ((row['svgRel'], row['raw'], 'image/svg+xml'),
                                        (row['pngRel'], row['png'], 'image/png')):
            key = f"_clients/{row['id']}/{relative}"
            s3.put_object(Bucket='vibers-bucket', Key=key, Body=content, ACL='public-read',
                          ContentType=mime, CacheControl='public,max-age=31536000,immutable',
                          Metadata={'sha256': sha(content)})
            assert s3.get_object(Bucket='vibers-bucket', Key=key)['Body'].read() == content
    with db:
        with db.cursor() as cursor:
            for row in rows:
                cursor.execute('SELECT payload FROM semologo.logo_posts WHERE id=%s FOR UPDATE', (row['id'],))
                assert cursor.fetchone()[0] == row['baseline'], row['id'] + ': concurrent edit'
                cursor.execute('UPDATE semologo.logo_posts SET payload=payload||%s::jsonb,updated_at=now() WHERE id=%s',
                               (json.dumps(row['patch'], ensure_ascii=False), row['id']))
    with db:
        with db.cursor() as cursor:
            for row in rows:
                cursor.execute('SELECT id,asset_manifest FROM semologo.logo_versions WHERE brand_id=%s AND is_current FOR UPDATE', (row['id'],))
                versions = cursor.fetchall()
                assert len(versions) == 1 and versions[0][1] is None
                cursor.execute('UPDATE semologo.logo_versions SET asset_manifest=%s::jsonb,review_status=%s,verified_at=now() WHERE id=%s',
                    (json.dumps({'variants': row['variants']}, ensure_ascii=False), 'verified', versions[0][0]))
    for row in rows:
        key = f"_clients/{row['id']}/variants.json"
        raw = (json.dumps(row['variants'], ensure_ascii=False, separators=(',', ':')) + '\n').encode()
        s3.put_object(Bucket='vibers-bucket', Key=key, Body=raw, ACL='public-read',
                      ContentType='application/json', CacheControl='public,max-age=60')
        assert s3.get_object(Bucket='vibers-bucket', Key=key)['Body'].read() == raw
    db.close()
    (OUT / 'reviewed-published.json').write_text(json.dumps({'status': 'published',
        'brands': [x['id'] for x in rows]}, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'status': 'published', 'brands': len(rows)}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--publish', action='store_true')
    main(parser.parse_args().publish)

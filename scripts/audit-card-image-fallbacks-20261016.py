#!/usr/bin/env python3
"""Bounded, read-only check of real card image fallbacks and stored bytes."""
import argparse
import concurrent.futures
import datetime
import json
import shlex
import subprocess
from pathlib import Path
from urllib.parse import urlparse

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

ROOT = Path(__file__).resolve().parents[1]
CDN = 'https://logo.vibers.co.kr/_clients/'
PNG = b'\x89PNG\r\n\x1a\n'


def credentials():
    result = {}
    for line in Path('/Users/juuuno/Desktop/macminim4/.secrets/보안.env').read_text().splitlines():
        if line.startswith('export '): line = line[7:]
        if '=' not in line: continue
        key, value = line.split('=', 1)
        if key in ('NCP_ACCESS_KEY', 'NCP_SECRET_KEY'):
            result[key] = shlex.split(value, comments=True)[0]
    return result


def image_candidates(brand):
    """Mirror src/lib/logo-png-source.ts for published CDN assets."""
    ident = brand['id']
    png, svg, preview = (brand.get(key) for key in ('logo_png', 'logo_svg', 'preview_png'))
    if isinstance(png, str) and png.startswith('blob:'): return [png]
    if not (png or brand.get('has_png')) and isinstance(svg, str) and svg.startswith('/submissions/'):
        return [f'/api/logo-preview/?id={ident}']
    if ident == 'osan-cultural-foundation': return [f'/api/logo-preview/?id={ident}']
    png_path = png if isinstance(png, str) and png.endswith('.png') else 'logo.png'
    png_url = png_path if png_path.startswith(('https://', '/')) else f'{CDN}{ident}/{png_path}'
    transparent = f'{CDN}{ident}/logo-transparent.png'
    rejected = brand.get('rejected_asset_files') or []
    reviewed = ident in ('s-oil', 'sk') and 'logo-transparent.png' not in rejected
    if isinstance(preview, str) and not preview.startswith(('https://', '/')):
        preview = f'{CDN}{ident}/{preview}'
    pngs = ([transparent] if reviewed else []) + ([preview] if preview else []) + [png_url]
    if not reviewed and 'logo-transparent.png' not in rejected: pngs.append(transparent)
    if not (brand.get('has_svg') or svg): return list(dict.fromkeys(pngs))
    file = brand.get('svg_transparent') or svg or 'logo.svg'
    if not isinstance(file, str) or file in rejected or '..' in file or not file.endswith('.svg'):
        return list(dict.fromkeys(pngs))
    svg_url = file if file.startswith('/submissions/') else f'{CDN}{ident}/{file}'
    if not (brand.get('has_png') or png or preview): return list(dict.fromkeys([svg_url, *pngs]))
    return list(dict.fromkeys([*pngs, svg_url]))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--pages', type=int, default=5)
    parser.add_argument('--output', type=Path, default=ROOT / 'marketing/assets/card-image-fallback-audit-20261016.json')
    args = parser.parse_args()
    brands = {}
    for sort in ('recent', 'fame'):
        for page in range(args.pages):
            url = f'https://semologo.com/api/catalog/?sort={sort}&limit=120&offset={page*120}'
            raw = subprocess.run(['curl', '-fsSL', '--max-time', '25', url], check=True, capture_output=True).stdout
            rows = json.loads(raw)['brands']
            brands.update((row['id'], row) for row in rows)
            if len(rows) < 120: break
    secret = credentials()
    s3 = boto3.client('s3', endpoint_url='https://kr.object.ncloudstorage.com', region_name='kr-standard',
                      aws_access_key_id=secret['NCP_ACCESS_KEY'], aws_secret_access_key=secret['NCP_SECRET_KEY'],
                      config=Config(signature_version='s3v4', request_checksum_calculation='when_required',
                                    response_checksum_validation='when_required'))

    def check(url):
        if url.startswith('/api/logo-preview/'): return 'dynamic'
        if url.startswith('blob:'): return 'local'
        if url.startswith('/submissions/'):
            result = subprocess.run(['curl', '-sSL', '--max-time', '12', '-o', '/dev/null', '-w', '%{http_code}',
                                     'https://semologo.com' + url], capture_output=True, text=True)
            return 'present' if result.stdout == '200' else 'missing'
        if not url.startswith(CDN): return 'external'
        key = urlparse(url).path.lstrip('/')
        try:
            obj = s3.get_object(Bucket='vibers-bucket', Key=key, Range='bytes=0-127')
            head = obj['Body'].read()
            valid = head.startswith(PNG) if key.endswith('.png') else b'<svg' in head.lower() or b'<?xml' in head.lower()
            return 'present' if valid else 'invalid-bytes'
        except ClientError as error:
            return 'missing' if error.response['Error']['Code'] in ('404', 'NoSuchKey') else 'error'

    candidates = {ident: image_candidates(brand) for ident, brand in brands.items()}
    urls = list(dict.fromkeys(url for group in candidates.values() for url in group))
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        checked = dict(zip(urls, pool.map(check, urls)))
    rows = []
    for ident, group in candidates.items():
        statuses = [checked[url] for url in group]
        first = next((i for i, status in enumerate(statuses) if status == 'present'), None)
        status = ('direct' if first == 0 else 'fallback' if first is not None else
                  'dynamic-only' if 'dynamic' in statuses else 'unverified' if 'external' in statuses or 'local' in statuses else 'broken')
        rows.append({'id': ident, 'status': status, 'first_good': first,
                     'candidates': [{'url': url, 'status': checked[url]} for url in group]})
    summary = {status: sum(row['status'] == status for row in rows)
               for status in ('direct', 'fallback', 'dynamic-only', 'unverified', 'broken')}
    report = {'checked_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'scope': {'sort': ['recent', 'fame'], 'pages_per_sort': args.pages},
              'sample': len(rows), 'summary': summary, 'rows': rows}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'sample': len(rows), **summary,
                      'affected_ids': [row['id'] for row in rows if row['status'] in ('fallback', 'broken')]}, ensure_ascii=False))


if __name__ == '__main__': main()

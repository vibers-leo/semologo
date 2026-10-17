#!/usr/bin/env python3
"""Rank alternate official CI images for unresolved paired institution reviews.

Image similarity only prioritizes visual inspection; it never verifies identity.
"""
import argparse
import concurrent.futures
import hashlib
import io
import json
import re
import runpy
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlparse

import boto3
import cv2
import numpy as np
import requests
from botocore.config import Config
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'marketing/assets/public-ci-recovery-20261017'
HELP = runpy.run_path(str(ROOT / 'scripts/publish-commons-taiwan-new-20261017.py'))
REVIEW = runpy.run_path(str(ROOT / 'scripts/prepare-public-ci-roster-review.py'))


def fingerprint(image):
    canvas = Image.new('RGB', image.size, 'white')
    canvas.paste(image, (0, 0), image)
    gray = np.asarray(canvas.convert('L'))
    foreground = gray < 240
    if foreground.any():
        ys, xs = np.where(foreground)
        gray = gray[ys.min():ys.max()+1, xs.min():xs.max()+1]
    small = cv2.resize(gray, (32, 32), interpolation=cv2.INTER_AREA).astype(np.float32)
    coeff = cv2.dct(small)[:8, :8]
    return coeff > np.median(coeff[1:])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--workers', type=int, default=8)
    parser.add_argument('--mode', choices=('initial', 'legal', 'new-direct'), default='initial')
    args = parser.parse_args()
    if not 1 <= args.workers <= 12:
        parser.error('workers must be 1..12')
    suffix = '' if args.mode == 'initial' else '-' + args.mode
    paired = json.loads((OUT / f'paired-results{suffix}.json').read_text())
    selected = {x['member_key'] for filename in (
        'public-ci-roster-reviewed-20261017.json',
        'public-ci-roster-alt-reviewed-20261017.json',
        'public-ci-roster-legal-reviewed-20261017.json',
        'public-ci-roster-new-direct-reviewed-20261017.json')
        for x in json.loads((ROOT / 'data/collection' / filename).read_text())['items']}
    queue = [r for r in paired if r.get('pair_index') and r['member_key'] not in selected]
    official = defaultdict(list)
    for r in json.loads((ROOT / 'data/collection/official-ci-assets-staged.json').read_text())['candidates']:
        official[(REVIEW['norm'] if args.mode == 'initial' else REVIEW['legal_norm'])(r['name_ko'])].append(r)
    keys = HELP['credentials']()
    s3 = boto3.client('s3', endpoint_url='https://kr.object.ncloudstorage.com',
                      region_name='kr-standard', aws_access_key_id=keys['NCP_ACCESS_KEY'],
                      aws_secret_access_key=keys['NCP_SECRET_KEY'],
                      config=Config(signature_version='s3v4', request_checksum_calculation='when_required'))

    def scan(row):
        ident = row['exact_candidates'][0]
        left_raw = s3.get_object(Bucket='vibers-bucket', Key=f'_clients/{ident}/logo.png')['Body'].read()
        left = REVIEW['decode'](left_raw, 'logo.png')
        baseline = fingerprint(left)
        source_rows = official[(REVIEW['norm'] if args.mode == 'initial' else REVIEW['legal_norm'])(row['name'])]
        links = sorted({u for src in source_rows for u in src.get('asset_links', [])},
                       key=lambda u: (-REVIEW['rank_link'](u), u))
        options = []
        for url in links[:16]:
            if REVIEW['rank_link'](url) < 0 or url == row['asset_url']:
                continue
            try:
                page = next((src['official_source_page'] for src in source_rows
                             if urlparse(src['official_source_page']).hostname == urlparse(url).hostname),
                            source_rows[0]['official_source_page'])
                r = requests.get(url, timeout=11,
                                 headers={'User-Agent': 'Mozilla/5.0 SemoLogo-official-ci-review/1.0',
                                          'Referer': page})
                r.raise_for_status()
                if len(r.content) > 4_000_000:
                    continue
                image = REVIEW['decode'](r.content, url)
                if min(image.size) < 32:
                    continue
                distance = int(np.count_nonzero(fingerprint(image) != baseline))
                options.append({'url': url, 'source_page': page, 'source_bytes': len(r.content),
                                'sha256': hashlib.sha256(r.content).hexdigest(),
                                'phash_distance': distance, 'image': image})
            except Exception:
                continue
        options.sort(key=lambda x: x['phash_distance'])
        return row, left, options[:2]

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        results = list(pool.map(scan, queue))
    report = []
    font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Unicode.ttf', 14)
    for n, (row, left, options) in enumerate(results):
        report.append({'alternate_index': n+1, 'member_key': row['member_key'],
                       'name': row['name'], 'brand_id': row['exact_candidates'][0],
                       'initial_pair_index': row['pair_index'],
                       'options': [{k:v for k,v in o.items() if k!='image'} for o in options]})
    (OUT / f'alternate-results{suffix}.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    for start in range(0, len(results), 30):
        sheet = Image.new('RGB', (1800, 1740), 'white')
        draw = ImageDraw.Draw(sheet)
        for j, (row, left, options) in enumerate(results[start:start+30]):
            col, line = j % 3, j // 3
            x, y = col*600, line*174
            images = [left] + [o['image'] for o in options]
            for k, image in enumerate(images[:3]):
                sheet.paste(REVIEW['tile'](image, (190, 138)), (x+k*200, y))
            label = f"{start+j+1:03d} {row['exact_candidates'][0]} {row['name']}"
            draw.text((x+3, y+141), label[:44], fill='black', font=font)
        sheet.save(OUT / f'alternates{suffix}-{start//30+1}.jpg', quality=88)
    print(json.dumps({'scanned': len(results), 'with_alternative': sum(bool(x[2]) for x in results),
                      'distance_le_8': sum(bool(x[2]) and x[2][0]['phash_distance'] <= 8 for x in results),
                      'sheets': (len(results)+29)//30}))


if __name__ == '__main__':
    main()

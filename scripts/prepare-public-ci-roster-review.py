#!/usr/bin/env python3
"""Prepare paired official/CMS image review for unresolved CleanEye institutions.

This does not verify identities or publish assets; it only stages bounded evidence.
"""
import argparse
import concurrent.futures
import io
import json
import re
import runpy
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlparse

import boto3
import cairosvg
import requests
from botocore.config import Config
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT = ROOT / 'marketing/assets/public-ci-recovery-20261017'
HELP = runpy.run_path(str(ROOT / 'scripts/publish-commons-taiwan-new-20261017.py'))
Image.MAX_IMAGE_PIXELS = 24_000_000


def norm(value):
    return re.sub(r'[^가-힣a-z0-9]', '', str(value or '').lower())


def legal_norm(value):
    return re.sub(r'^(재단법인|사단법인|주식회사|유한회사|사회복지법인|공익재단법인)', '', norm(value))


def decode(raw, url):
    if raw[:200].lstrip().lower().startswith((b'<svg', b'<?xml')) or urlparse(url).path.lower().endswith('.svg'):
        if len(raw) > 2_000_000 or re.search(
            br'<!DOCTYPE|<!ENTITY|<(?:image|script|foreignObject)\b|data:image/|javascript:|\bon[a-z]+\s*=|\b(?:xlink:)?href\s*=|@import|url\s*\(', raw, re.I):
            raise ValueError('unsafe-svg')
        raw = cairosvg.svg2png(bytestring=raw, output_width=900)
    with Image.open(io.BytesIO(raw)) as image:
        image.load()
        if image.width < 20 or image.height < 20 or image.width * image.height > 24_000_000:
            raise ValueError('bad-dimensions')
        return image.convert('RGBA')


def rank_link(url):
    path = urlparse(url).path.lower()
    if not path.endswith(('.png', '.svg', '.jpg', '.jpeg')):
        return -100
    score = 0
    for word, points in [('logo', 20), ('ci', 8), ('symbol', 12), ('brand', 8), ('header', 5), ('footer', 3)]:
        if word in path:
            score += points
    for word in ('banner', 'popup', 'sns', 'arrow', 'icon', 'bg_', 'background'):
        if word in path:
            score -= 20
    return score


def tile(image, size=(290, 140)):
    card = Image.new('RGB', size, '#dddddd')
    image.thumbnail((size[0] - 12, size[1] - 12), Image.Resampling.LANCZOS)
    x = (size[0] - image.width) // 2
    y = (size[1] - image.height) // 2
    card.paste(image, (x, y), image)
    return card


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, default=DEFAULT_OUT)
    parser.add_argument('--legal-alias', action='store_true', help='review legal-entity prefix aliases missed by exact matching')
    parser.add_argument('--new-direct-only', action='store_true', help='review only direct assets discovered after initial audit')
    parser.add_argument('--workers', type=int, default=10)
    args = parser.parse_args()
    if not 1 <= args.workers <= 12:
        parser.error('workers must be 1..12')
    args.out.mkdir(parents=True, exist_ok=True)
    members = json.loads((args.out / 'unverified.json').read_text())
    posts = {r['id']: r for r in json.loads((args.out / 'cms-candidates.json').read_text())}
    official = defaultdict(list)
    for row in json.loads((ROOT / 'data/collection/official-ci-assets-staged.json').read_text())['candidates']:
        official[(legal_norm if args.legal_alias else norm)(row['name_ko'])].append(row)
    already_reviewed = {x['member_key'] for path in (
        ROOT / 'data/collection/public-ci-roster-reviewed-20261017.json',
        ROOT / 'data/collection/public-ci-roster-alt-reviewed-20261017.json',
        ROOT / 'data/collection/public-ci-roster-legal-reviewed-20261017.json')
        for x in json.loads(path.read_text())['items']}
    previous_direct = set()
    if args.new_direct_only:
        for filename in ('all-701-audit.json', 'all-701-audit-legal.json'):
            previous_direct.update(x['member_key'] for x in json.loads((args.out / filename).read_text()) if x['official_links'])
    queue = []
    audit = []
    for m in members:
        exact = [posts[x] for x in m['metadata'].get('candidates', [])
                 if x in posts and posts[x]['status'] == 'published' and
                 (legal_norm if args.legal_alias else norm)(posts[x]['name_ko']) ==
                 (legal_norm if args.legal_alias else norm)(m['name'])]
        sources = official[(legal_norm if args.legal_alias else norm)(m['name'])]
        links = sorted({link for x in sources for link in x.get('asset_links', [])},
                       key=lambda link: (-rank_link(link), link))
        record = {'member_key': m['member_key'], 'name': m['name'],
                  'exact_candidates': [p['id'] for p in exact],
                  'official_pages': [s['official_source_page'] for s in sources],
                  'official_links': len(links)}
        audit.append(record)
        if len(exact) == 1 and links and (not args.legal_alias or m['member_key'] not in already_reviewed) and (not args.legal_alias or args.new_direct_only or norm(exact[0]['name_ko']) != norm(m['name'])) and (not args.new_direct_only or m['member_key'] not in previous_direct and m['member_key'] not in already_reviewed):
            queue.append((record, links[:6]))
    keys = HELP['credentials']()
    s3 = boto3.client('s3', endpoint_url='https://kr.object.ncloudstorage.com',
                      region_name='kr-standard', aws_access_key_id=keys['NCP_ACCESS_KEY'],
                      aws_secret_access_key=keys['NCP_SECRET_KEY'],
                      config=Config(signature_version='s3v4', request_checksum_calculation='when_required'))

    def prepare(item):
        record, links = item
        ident = record['exact_candidates'][0]
        try:
            current = s3.get_object(Bucket='vibers-bucket', Key=f'_clients/{ident}/logo.png')['Body'].read()
            left = decode(current, 'logo.png')
        except Exception as error:
            return {**record, 'error': 'current-png-' + type(error).__name__}
        for url in links:
            try:
                source_page = next((page for page in record['official_pages'] if urlparse(page).hostname == urlparse(url).hostname), record['official_pages'][0])
                result = requests.get(url, timeout=15, headers={'User-Agent': 'Mozilla/5.0 SemoLogo-official-ci-review/1.0', 'Referer': source_page})
                result.raise_for_status()
                if len(result.content) > 4_000_000:
                    continue
                right = decode(result.content, url)
                # A tiny image or icon is not useful identity evidence.
                if min(right.size) < 32:
                    continue
                return {**record, 'asset_url': url, 'source_page': source_page,
                        'source_bytes': len(result.content), 'left': left, 'right': right}
            except Exception:
                continue
        return {**record, 'error': 'official-asset-unavailable'}

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        prepared = list(pool.map(prepare, queue))
    rows = []
    for item in prepared:
        if 'left' in item:
            left, right = item.pop('left'), item.pop('right')
            item['pair_index'] = len(rows) + 1
            rows.append((item, tile(left), tile(right)))
    suffix = '-new-direct' if args.new_direct_only else '-legal' if args.legal_alias else ''
    (args.out / f'all-701-audit{suffix}.json').write_text(json.dumps(audit, ensure_ascii=False, indent=2) + '\n')
    (args.out / f'paired-results{suffix}.json').write_text(json.dumps(prepared, ensure_ascii=False, indent=2) + '\n')
    font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Unicode.ttf', 16)
    for batch in range(0, len(rows), 30):
        chunk = rows[batch:batch+30]
        sheet = Image.new('RGB', (1800, 10 * 174), 'white')
        draw = ImageDraw.Draw(sheet)
        for j, (row, left, right) in enumerate(chunk):
            col, line = j % 3, j // 3
            x, y = col * 600, line * 174
            sheet.paste(left, (x, y))
            sheet.paste(right, (x+300, y))
            label = f"{row['pair_index']:03d} {row['exact_candidates'][0]} {row['name']}"
            draw.text((x+5, y+143), label[:46], fill='black', font=font)
        sheet.save(args.out / f'compare{suffix}-{batch//30+1}.jpg', quality=88)
    print(json.dumps({'unverified': len(members), 'exact_candidate_with_official_links': len(queue),
                      'paired': len(rows), 'failed': len(prepared)-len(rows),
                      'sheets': (len(rows)+29)//30}, ensure_ascii=False))


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Stage issuer-site SVGs for visual identity review; never auto-release candidates."""

import concurrent.futures
import hashlib
import html
import importlib.util
import io
import json
import re
import subprocess
from pathlib import Path
from urllib.parse import unquote, urlparse

import cairosvg
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'marketing/assets/goldmine-r35'
DISCOVERY = ROOT / 'data/collection/us-equity-index-logo-discovery.json'
PRIOR_ASSETS = Path('/Volumes/HDD-1TB/semologo-migration/20261005/project/marketing/assets')
MANUAL_REVIEW = ROOT / 'data/collection/goldmine-r35-manual-review.json'
SPEC = importlib.util.spec_from_file_location('hourly_preflight', ROOT / 'scripts/prepare-worker-logo-hourly-new-20261016.py')
PREFLIGHT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PREFLIGHT)


def candidate_links(row, used_urls):
    domain = (row.get('official_domain') or row.get('domain_candidate') or '').removeprefix('www.')
    if not domain or row['status'] == 'domain-identity-mismatch':
        return []
    result = []
    for unclean in row.get('asset_links', []):
        url = html.unescape(unclean)
        parsed = urlparse(url)
        host = (parsed.hostname or '').removeprefix('www.')
        path = unquote(parsed.path).lower()
        if parsed.scheme != 'https' or not (host == domain or host.endswith('.' + domain)):
            continue
        if not path.endswith('.svg') or url in used_urls:
            continue
        if not re.search(r'logo|wordmark|brand|identity', path):
            continue
        if re.search(r'favicon|icon|social|partner|client|customer|arrow|chevron|search|play|menu|fund', path):
            continue
        result.append(url)
    return result


def rank(url, name):
    path = unquote(urlparse(url).path).lower()
    basename = path.rsplit('/', 1)[-1]
    tokens = [word.lower() for word in re.findall(r'[a-zA-Z]{4,}', name)]
    company_match = int(any(word in basename for word in tokens))
    return (company_match * 10 + int('wordmark' in basename) * 5
            + int('logo' in basename) * 3 - int(basename == 'logo.svg') * 4
            - int('footer' in basename) - int('mobile' in basename))


def make_sheet(sources, filename, background):
    cells = []
    for row in sources:
        raw = subprocess.run(['curl', '-fsSL', '--max-time', '15', '--max-filesize', '150000',
                              row['assetUrl']], capture_output=True, check=True).stdout
        if hashlib.sha256(raw).hexdigest() != row['expectedSha256']:
            raise ValueError('Source changed after preflight: ' + row['id'])
        picture = Image.open(io.BytesIO(cairosvg.svg2png(bytestring=raw, output_width=340))).convert('RGBA')
        picture.thumbnail((350, 115))
        canvas = Image.new('RGB', (380, 165), background)
        canvas.paste(picture, ((380 - picture.width) // 2, 8 + (115 - picture.height) // 2), picture)
        ImageDraw.Draw(canvas).text((8, 137), row['id'] + ' · ' + row['nameKo'][:26],
                                    fill='#ffffff' if background == '#15171d' else '#111111')
        cells.append(canvas)
    width = 5 * 380
    sheet = Image.new('RGB', (width, ((len(cells) + 4) // 5) * 165), background)
    for n, cell in enumerate(cells):
        sheet.paste(cell, ((n % 5) * 380, (n // 5) * 165))
    sheet.save(OUT / filename, quality=90)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    roster = json.loads((OUT / 'current-roster.json').read_text())['sources']
    known_urls = {item['assetUrl'] for item in roster}
    known_tickers = {item['id'].rsplit('-', 1)[-1].upper() for item in roster if item['id'].startswith('us-')}
    rejected = {}
    for path in PRIOR_ASSETS.glob('worker-logo-bulk*/manual-rejections.json'):
        rejected.update(json.loads(path.read_text()))
    if MANUAL_REVIEW.exists():
        reviewed = json.loads(MANUAL_REVIEW.read_text())
        rejected.update({item: 'visual_identity_mismatch_or_wrong_asset'
                         for item in reviewed['rejectedForIdentityMismatchOrWrongAsset']})
    rows = []
    for item in json.loads(DISCOVERY.read_text())['items']:
        ticker = item['ticker']
        ident = 'us-bulk-' + ticker.lower()
        if ticker in known_tickers or ident in rejected:
            continue
        links = candidate_links(item, known_urls)
        if not links:
            continue
        asset = max(links, key=lambda url: rank(url, item['company_name']))
        domain = item.get('official_domain') or item.get('domain_candidate')
        source_page = item.get('official_source_url') or 'https://' + domain + '/'
        rows.append((ident, item['company_name'], source_page, asset))
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        checked = list(pool.map(PREFLIGHT.preflight, rows))
    valid = [row for row in checked if 'expectedSha256' in row]
    failed = [row for row in checked if 'error' in row]
    (OUT / 'preflight.json').write_text(json.dumps({'selected': len(rows), 'valid': valid,
        'failed': failed, 'previously_rejected': rejected}, ensure_ascii=False, indent=2) + '\n')
    if valid:
        make_sheet(valid, 'review-light.jpg', '#ffffff')
        make_sheet(valid, 'review-dark.jpg', '#15171d')
    print(json.dumps({'selected': len(rows), 'valid': len(valid), 'failed': len(failed),
                      'roster': len(roster), 'output': str(OUT)}, ensure_ascii=False))


if __name__ == '__main__':
    main()

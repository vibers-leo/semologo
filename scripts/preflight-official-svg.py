#!/usr/bin/env python3
"""Preview untried SVG links discovered on the fixed official CI-page index."""
import argparse
import hashlib
import io
import json
import re
import gzip
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

import cairosvg
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
STAGED = ROOT / 'data/collection/official-ci-assets-staged.json'
BLOCK = re.compile(r'icon|arrow|sns|social|search|btn|menu|close|banner|quick|webaward|a11y|googlelogo|logout|logo-mcst|logo-kspo', re.I)
MATCH = re.compile(r'logo|(^|[/_\-])ci([/_\-.]|$)|symbol|emblem|signature', re.I)


def candidates(roster_path, limit, dataset):
    old = {item['assetUrl'] for item in json.loads(roster_path.read_text())['sources']}
    groups = defaultdict(list)
    if dataset == 'us-equity':
        indexed = json.loads((ROOT / 'data/collection/us-equity-index-logo-discovery.json').read_text())['items']
        indexed = [dict(id='us-index-' + item['ticker'].lower(), name_ko=item['company_name'],
                        official_source_page=item['official_source_url'], asset_links=item.get('asset_links', []))
                   for item in indexed if item.get('official_source_url') and item.get('ticker')]
    else:
        indexed = json.loads(STAGED.read_text())['candidates']
    for item in indexed:
        for url in item.get('asset_links', []):
            # The Windows collector deliberately accepts HTTPS only. Probe the
            # upgraded asset URL here, so unusable HTTP links never enter a roster.
            if url.startswith('http://'):
                url = 'https://' + url[7:]
            path = urlparse(url).path
            if not path.lower().endswith('.svg') or url in old or BLOCK.search(path) or not MATCH.search(path):
                continue
            if dataset == 'us-equity':
                source_host = urlparse(item['official_source_page']).hostname or ''
                asset_host = urlparse(url).hostname or ''
                if not (asset_host == source_host or asset_host.endswith('.' + source_host)):
                    continue
            score = (3 if re.search(r'/ci[/_\-.]|ci[_\-.]|signature', path, re.I) else 0)
            score += 2 if 'logo' in path.lower() else 0
            score -= 1 if re.search(r'white|gray|footer|bottom|ft_logo|btm-logo', path, re.I) else 0
            groups[item['id']].append((score, item, url))
    for rows in groups.values():
        rows.sort(key=lambda row: (-row[0], row[2]))
    ordered = []
    for round_number in range(3):
        for key in sorted(groups):
            if len(groups[key]) > round_number:
                ordered.append(groups[key][round_number])
    return ordered[:limit]


def fetch(row):
    _, item, url = row
    result = {'id': item['id'], 'nameKo': item['name_ko'], 'sourcePage': item['official_source_page'], 'assetUrl': url}
    try:
        request = Request(url, headers={'User-Agent': 'Mozilla/5.0 SemoLogo-official-CI-review'})
        with urlopen(request, timeout=15) as response:
            body = response.read(150_001)
        if len(body) > 150_000 or b'<svg' not in body[:2048].lower():
            raise ValueError('not a bounded SVG')
        compressed_size = len(gzip.compress(body, compresslevel=9)) if len(body) > 20_000 else 0
        if compressed_size > 45_000:
            raise ValueError('SVG exceeds bounded worker result')
        png = cairosvg.svg2png(bytestring=body, output_width=500, output_height=300)
        result['expectedSha256'] = hashlib.sha256(body).hexdigest()
        result['originalBytes'] = len(body)
        result['compressedBytes'] = compressed_size
        result['preview'] = Image.open(io.BytesIO(png)).convert('RGBA')
        return result
    except Exception as exc:
        result['error'] = type(exc).__name__
        return result


def sheet(rows, output, background):
    width, height, cols = 320, 230, 4
    image = Image.new('RGB', (width * cols, height * ((len(rows) + cols - 1) // cols)), background)
    draw = ImageDraw.Draw(image)
    for index, row in enumerate(rows):
        x, y = index % cols * width, index // cols * height
        preview = row['preview']
        preview.thumbnail((300, 170))
        image.paste(preview, (x + (width - preview.width) // 2, y + (180 - preview.height) // 2), preview)
        color = '#222' if background == 'white' else '#eee'
        draw.text((x + 8, y + 184), f"{index}: {row['nameKo'][:22]}", fill=color)
        draw.text((x + 8, y + 204), urlparse(row['assetUrl']).path[-45:], fill=color)
    image.save(output, quality=85)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--roster', required=True, type=Path)
    parser.add_argument('--out', required=True, type=Path)
    parser.add_argument('--limit', type=int, default=80)
    parser.add_argument('--dataset', choices=['korean-ci', 'us-equity'], default='korean-ci')
    args = parser.parse_args()
    if not 1 <= args.limit <= 300:
        parser.error('limit must be 1..300')
    args.out.mkdir(parents=True, exist_ok=True)
    chosen = candidates(args.roster, args.limit, args.dataset)
    with ThreadPoolExecutor(max_workers=8) as pool:
        fetched = list(pool.map(fetch, chosen))
    valid = [row for row in fetched if 'preview' in row]
    report = {'selected': len(chosen), 'valid': [{k: v for k, v in row.items() if k != 'preview'} for row in valid], 'failed': [row for row in fetched if 'error' in row]}
    (args.out / 'preflight.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    if valid:
        sheet(valid, args.out / 'light.jpg', 'white')
        sheet(valid, args.out / 'dark.jpg', '#18181b')
    print(json.dumps({'selected': len(chosen), 'valid': len(valid), 'failed': len(report['failed']), 'entities': len({row['id'] for row in valid})}, ensure_ascii=False))


if __name__ == '__main__':
    main()

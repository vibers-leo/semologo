#!/usr/bin/env python3
"""Stage selected company-site SVGs for visual review without publishing them."""

import hashlib
import io
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import cairosvg
import requests
from lxml import etree
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'marketing/assets/gdweb-official-review-20261016'
HEADER = {'User-Agent': 'Mozilla/5.0 (compatible; SemoLogo-source-review/1.0)'}


def stage(selection, entry):
    url = selection['asset_url']
    site = entry['official_site_candidate']
    if urlparse(url).scheme != 'https' or urlparse(url).hostname != urlparse(site).hostname:
        raise ValueError('asset host differs from the listed official site')
    response = requests.get(url, headers=HEADER, timeout=20)
    response.raise_for_status()
    raw = response.content
    if not 0 < len(raw) <= 150_000 or b'<!DOCTYPE' in raw.upper():
        raise ValueError('invalid size or document type')
    root = etree.fromstring(raw, etree.XMLParser(resolve_entities=False, no_network=True))
    if etree.QName(root).localname != 'svg':
        raise ValueError('not SVG')
    if root.xpath('//*[local-name()="script" or local-name()="image" or local-name()="foreignObject"]'):
        raise ValueError('contains active or raster content')
    if root.xpath('//*[@href or @*[local-name()="href"]]'):
        raise ValueError('contains linked content')
    if not root.xpath('//*[local-name()="path" or local-name()="polygon" or local-name()="circle" or local-name()="rect"]'):
        raise ValueError('no vector shapes')
    preview = Image.open(io.BytesIO(cairosvg.svg2png(bytestring=raw, output_width=600))).convert('RGBA')
    if not preview.getchannel('A').getbbox():
        raise ValueError('empty render')
    stem = entry['gdweb_id']
    (OUT / f'{stem}.svg').write_bytes(raw)
    preview.save(OUT / f'{stem}.png')
    return {'gdweb_id': stem, 'listing_title': entry['listing_title'],
            'gdweb_url': entry['discovery_url'], 'official_site': site,
            'asset_url': url, 'sha256': hashlib.sha256(raw).hexdigest(),
            'bytes': len(raw), 'preview_size': list(preview.size),
            'status': 'vector_preflight_passed_visual_review_pending'}


def main():
    catalog = json.loads((ROOT / 'data/collection/gdweb-logo-candidates.json').read_text())
    selections = json.loads((ROOT / 'data/collection/gdweb-svg-selections.json').read_text())['items']
    by_id = {item['gdweb_id']: item for item in catalog['items']}
    OUT.mkdir(parents=True, exist_ok=True)
    results = []
    for item in selections:
        try:
            results.append(stage(item, by_id[item['gdweb_id']]))
        except (KeyError, ValueError, requests.RequestException, etree.XMLSyntaxError) as error:
            results.append({'gdweb_id': item['gdweb_id'], 'asset_url': item['asset_url'],
                            'status': 'preflight_failed', 'error': type(error).__name__ + ': ' + str(error)[:160]})
    passed = [item for item in results if item['status'].startswith('vector_preflight')]
    sheet = Image.new('RGB', (1200, ((len(passed) + 2) // 3) * 220), '#e8e8e8')
    draw = ImageDraw.Draw(sheet)
    for index, item in enumerate(passed):
        image = Image.open(OUT / f"{item['gdweb_id']}.png").convert('RGBA')
        image.thumbnail((360, 160))
        x, y = index % 3 * 400, index // 3 * 220
        for background, offset in (('#ffffff', 0), ('#121214', 190)):
            draw.rectangle((x + offset + 5, y + 5, x + offset + 185, y + 175), fill=background)
            small = image.copy()
            small.thumbnail((175, 150))
            sheet.paste(small, (x + offset + 95 - small.width // 2,
                                y + 90 - small.height // 2), small)
        draw.text((x + 8, y + 185), item['gdweb_id'], fill='#111111')
    sheet.save(OUT / 'contact-sheet.jpg', quality=90)
    (OUT / 'manifest.json').write_text(json.dumps({
        'schema_version': 1, 'staged_at': datetime.now(timezone.utc).isoformat(),
        'publication_status': 'NOT_PUBLISHED', 'items': results,
    }, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'selected': len(results), 'vector_preflight_passed': len(passed),
                      'failed': len(results) - len(passed), 'output': str(OUT)}, ensure_ascii=False))


if __name__ == '__main__':
    main()

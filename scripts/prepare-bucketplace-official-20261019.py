#!/usr/bin/env python3
"""Prepare today's official Ohouse lockup without altering its vector paths."""
import hashlib
import json
import re
from pathlib import Path

import cairosvg
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = Path('/Volumes/HDD-1TB/semologo-migration/popular-over10-20261019')
OUT.mkdir(parents=True, exist_ok=True)
html = (OUT / 'bucketplace-index.html').read_text()
match = re.search(r'<a[^>]+class="navigation__logo"[^>]*>(<svg.*?</svg>)', html, re.S)
assert match, 'Official website logo was not found'
svg = re.sub(r'\sheight="32"', '', match.group(1), count=1).encode()
assert b'viewBox="0 0 481 136"' in svg and b'<path' in svg
assert not re.search(rb'<(?:script|image|foreignObject)\b|onload=|javascript:', svg, re.I)
png = cairosvg.svg2png(bytestring=svg, output_width=1600)
with Image.open(__import__('io').BytesIO(png)) as image:
    assert image.width == 1600 and image.height > 400
    assert image.getchannel('A').getbbox()[2] >= 1590
paths = {}
for ext, raw in [('svg', svg), ('png', png)]:
    filename = f'official-horizontal-{hashlib.sha256(raw).hexdigest()[:16]}.{ext}'
    (OUT / filename).write_bytes(raw)
    paths[ext] = f'sources/popular-refresh-20261019/{filename}'
manifest = {
    'schema': 1, 'algo_v': 1, 'id': 'bucketplace', 'primary': 'official-horizontal',
    'variants': [
        {'key': 'official-horizontal', 'form': 'horizontal', 'lang': 'ko', 'color': 'original',
         'label': '오늘의집 공식 가로형 로고', 'files': paths, 'order': 0,
         'origin': 'collected', 'provider': '오늘의집 공식 회사 사이트',
         'source_url': 'https://www.bucketplace.com/index.html',
         'source_note': '공식 홈페이지 상단의 인라인 SVG 경로를 그대로 사용. 고정 높이 속성을 제거해 전체 viewBox를 표시.'},
        {'key': 'legacy-symbol', 'form': 'symbol', 'lang': 'none', 'color': 'original',
         'label': '기존 수집 심볼', 'files': {'svg': 'logo.svg', 'png': 'logo-800.png'},
         'order': 1, 'origin': 'collected', 'provider': '기존 수집본'},
    ],
}
patch = {
    'id': 'bucketplace', 'name_ko': '오늘의집', 'name_en': 'Ohouse',
    'website': 'https://ohou.se/', 'domain': 'ohou.se',
    'logo_svg': paths['svg'], 'svg_transparent': paths['svg'], 'logo_png': paths['png'],
    'preview_png': f'https://logo.vibers.co.kr/_clients/bucketplace/{paths["png"]}',
    'has_svg': True, 'has_png': True, 'light': False,
    'presentation': {'file': paths['png'], 'bg': 'light', 'svgFile': paths['svg']},
    'variants_n': 2, 'asset_review_status': 'verified',
    'official_source_page': 'https://www.bucketplace.com/index.html',
    'asset_origin': '오늘의집 공식 회사 사이트 인라인 SVG',
    'logo_published_at': '2026-10-19T00:00:00Z',
}
release = {'schema': 1, 'snapshot_date': '2026-10-19', 'patches': {'bucketplace': patch},
           'variants': {'bucketplace': manifest}}
target = ROOT / 'src/lib/reviewed-popular-refresh-20261019.json'
if target.exists():
    previous = json.loads(target.read_text())
    release['patches'] = {**previous.get('patches', {}), **release['patches']}
    release['variants'] = {**previous.get('variants', {}), **release['variants']}
target.write_text(json.dumps(release, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'files': paths}, ensure_ascii=False))

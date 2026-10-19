#!/usr/bin/env python3
"""Extract LINE's standalone wordmark paths from its official trademark guide."""

import hashlib
import json
import xml.etree.ElementTree as ET
from pathlib import Path

import cairosvg
import fitz

ROOT = Path(__file__).resolve().parents[1]
OUT = Path('/Volumes/HDD-1TB/semologo-migration/kmong-line-20261019')
PDF = OUT / '2021LINE_trademark_guide.pdf'
SOURCE = 'https://vos.line-scdn.net/lbstw-static/website/home/2021LINE_trademark_guide.pdf'
NS = {'svg': 'http://www.w3.org/2000/svg'}

document = fitz.open(PDF)
assert len(document) == 27 and document[5].rect == fitz.Rect(0, 0, 1920, 1200)
page = ET.fromstring(document[5].get_svg_image(text_as_path=True))
paths = [node for node in page.findall('.//svg:path', NS)
         if node.get('fill') == '#06c755' and node.get('transform', '').startswith('matrix(1,0,0,-1,')
         and 600 < float(node.get('transform').split(',')[-1].rstrip(')')) < 670]
assert len(paths) == 4, f'Expected four LINE letter paths, got {len(paths)}'
shapes = ''.join(ET.tostring(node, encoding='unicode') for node in paths)
svg = ('<svg xmlns="http://www.w3.org/2000/svg" width="286" height="126" '
       'viewBox="240 580 286 126">' + shapes + '</svg>').encode()
assert b'#06c755' in svg and b'<image' not in svg
png = cairosvg.svg2png(bytestring=svg, output_width=1600)
assets = {}
for ext, raw in [('svg', svg), ('png', png)]:
    filename = f'official-wordmark-{hashlib.sha256(raw).hexdigest()[:16]}.{ext}'
    (OUT / filename).write_bytes(raw)
    assets[ext] = f'sources/official-line-20261019/{filename}'

manifest_path = ROOT / 'src/lib/reviewed-kmong-line-20261019.json'
release = json.loads(manifest_path.read_text())
variants = release['variants']['line']['variants']
assert len(variants) == 3 and variants[2]['key'] in ('legacy-wordmark', 'official-wordmark')
variants[2] = {
    'key': 'official-wordmark', 'form': 'wordmark', 'lang': 'en', 'color': 'original',
    'label': '공식 LINE 글자 로고 · 녹색', 'files': assets,
    'provider': 'LINE 상표 가이드 (2021)', 'origin': 'collected', 'order': 2,
    'source_url': SOURCE,
    'source_note': 'LINE 공식 상표 가이드 P4의 Wordmark 벡터 경로를 그대로 추출. 색상·형태 변경 없음.',
}
release['patches']['line']['asset_origin'] = 'LINE 공식 브랜드 아이콘 AI·PNG 및 공식 상표 가이드 Wordmark 벡터'
manifest_path.write_text(json.dumps(release, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'source': SOURCE, 'files': assets}, ensure_ascii=False))

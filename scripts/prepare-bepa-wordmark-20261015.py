#!/usr/bin/env python3
"""Extract BEPA's standalone wordmark from its official linked AI source."""
import hashlib
import json
import subprocess
from pathlib import Path

from lxml import etree
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'marketing/assets/nhbank-bepa-expansion-20261010/sources/bepa-text.ai'
OUT = ROOT / 'marketing/assets/bepa-wordmark-20261015'
SOURCE_URL = 'https://www.bepa.kr/data/kor/contents/bepa_ci_text.ai'
SOURCE_PAGE = 'https://www.bepa.kr/kor/view.do?no=1660&view=view'
EXPECTED_SHA256 = '68d0f0489a4cb3e595881703079e8d97a43cd62e47c80e5b1bfa3b8315b8864c'


def run(*args):
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout


def main():
    assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == EXPECTED_SHA256
    OUT.mkdir(parents=True, exist_ok=True)
    svg = OUT / 'wordmark.svg'
    run('inkscape', str(SOURCE), '--export-type=svg', '--export-plain-svg',
        '--export-text-to-path', '--export-filename=' + str(svg))
    row = run('inkscape', str(svg), '--query-all').splitlines()[0].split(',')
    assert len(row) == 5, row
    x, y, width, height = map(float, row[1:])
    assert width > 0 and height > 0
    root = etree.parse(str(svg)).getroot()
    root.set('viewBox', f'{x} {y} {width} {height}')
    root.set('width', str(width))
    root.set('height', str(height))
    svg.write_bytes(etree.tostring(root))
    assert not etree.parse(str(svg)).xpath('//*[local-name()="image"]'), 'raster inside SVG'
    png = OUT / 'wordmark.png'
    run('inkscape', str(svg), '--export-filename=' + str(png), '--export-width=2400')
    preview = OUT / 'wordmark-preview.png'
    run('inkscape', str(svg), '--export-filename=' + str(preview), '--export-width=640')
    image = Image.open(png).convert('RGBA')
    assert 2399 <= image.width <= 2401 and image.getchannel('A').getextrema()[0] == 0
    assert image.getbbox(), 'empty image'
    proof = Image.new('RGB', (1200, 480), '#f5f5f5')
    for index, background in enumerate(('white', '#111827')):
        tile = Image.new('RGB', (600, 420), background)
        thumb = image.copy()
        thumb.thumbnail((560, 350))
        tile.paste(thumb, ((600 - thumb.width) // 2, (420 - thumb.height) // 2), thumb)
        proof.paste(tile, (index * 600, 0))
    ImageDraw.Draw(proof).text((16, 440), 'BEPA official wordmark AI / white and dark preview', fill='black')
    proof.save(OUT / 'review.png')
    report = {'brand_id': 'gongu-ci-1137', 'form': 'wordmark', 'source_url': SOURCE_URL,
              'source_page': SOURCE_PAGE, 'source_sha256': EXPECTED_SHA256,
              'svg_sha256': hashlib.sha256(svg.read_bytes()).hexdigest(),
              'png_sha256': hashlib.sha256(png.read_bytes()).hexdigest(),
              'preview_sha256': hashlib.sha256(preview.read_bytes()).hexdigest(),
              'png_size': image.size, 'vector_embedded_images': 0, 'status': 'ready-for-visual-review'}
    (OUT / 'prepared.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()

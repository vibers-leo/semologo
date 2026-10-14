#!/usr/bin/env python3
"""Crop the original wordmark artboard from Gwacheon Foundation's official AI."""
import hashlib
import json
import subprocess
from pathlib import Path

import fitz
from lxml import etree
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'marketing/assets/gcart-wordmark-20261015'
SOURCE = OUT / 'gcart-ci-basic-4.ai'
SOURCE_URL = ('https://www.gcart.or.kr/files/'
              '%EA%B3%BC%EC%B2%9C%EB%AC%B8%ED%99%94%EC%9E%AC%EB%8B%A8-CI-'
              '%EA%B8%B0%EB%B3%B8%ED%98%95-4%EC%A2%85.ai')
EXPECTED_SHA256 = '2ce647a4aed8ccb1d61e5485517176fa7719a94dff5c51e18a0a1ba588746973'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def render(svg, png, width):
    subprocess.run(['inkscape', str(svg), '--export-filename=' + str(png),
                    '--export-width=' + str(width)], check=True, capture_output=True)


def main():
    assert digest(SOURCE) == EXPECTED_SHA256
    document = fitz.open(SOURCE)
    assert len(document) == 1 and not document[0].get_images()
    page = document[0]
    # This is the standalone calligraphic name at the right of the third row.
    strokes = [drawing['rect'] for drawing in page.get_drawings()
               if drawing['rect'].x0 > 285 and 530 < drawing['rect'].y0 < 575]
    assert len(strokes) == 14, f'Unexpected official artboard layout: {len(strokes)} paths'
    box = fitz.Rect()
    for stroke in strokes:
        box |= stroke
    assert 295 < box.x0 < 296 and 553 < box.x1 < 554 and 537 < box.y0 < 538 and 571 < box.y1 < 572
    box = box + (-3, -3, 3, 3)
    root = etree.fromstring(page.get_svg_image(text_as_path=True).encode())
    root.set('viewBox', f'{box.x0} {box.y0} {box.width} {box.height}')
    root.set('width', str(box.width))
    root.set('height', str(box.height))
    root.set('overflow', 'hidden')
    svg = OUT / 'wordmark.svg'
    svg.write_bytes(etree.tostring(root))
    assert not etree.parse(str(svg)).xpath('//*[local-name()="image"]')
    png = OUT / 'wordmark.png'
    preview = OUT / 'wordmark-preview.png'
    render(svg, png, 2400)
    render(svg, preview, 640)
    image = Image.open(png).convert('RGBA')
    assert 2399 <= image.width <= 2401 and image.getchannel('A').getextrema()[0] == 0
    proof = Image.new('RGB', (1200, 480), '#f5f5f5')
    for index, bg in enumerate(('white', '#d1d5db')):
        tile = Image.new('RGB', (600, 420), bg)
        thumb = image.copy()
        thumb.thumbnail((560, 350))
        tile.paste(thumb, ((600 - thumb.width) // 2, (420 - thumb.height) // 2), thumb)
        proof.paste(tile, (index * 600, 0))
    ImageDraw.Draw(proof).text((16, 440), 'Gwacheon official CI / extracted wordmark', fill='black')
    proof.save(OUT / 'review.png')
    config = {
        'brand_id': 'gongu-ci-0490', 'brand_label': '과천문화재단',
        'variant_key': 'official-wordmark-20261015', 'form': 'wordmark',
        'label': '국문 글자형 · 공식 CI 원본', 'lang': 'ko',
        'provider': '과천문화재단', 'source_file': str(SOURCE.relative_to(ROOT)),
        'source_url': SOURCE_URL, 'source_page': 'https://www.gcart.or.kr/kr/about/ci.do',
        'source_sha256': EXPECTED_SHA256,
        'svg_file': str(svg.relative_to(ROOT)), 'svg_sha256': digest(svg),
        'png_file': str(png.relative_to(ROOT)), 'png_sha256': digest(png),
        'preview_file': str(preview.relative_to(ROOT)), 'preview_sha256': digest(preview),
        'source_note': '공식 CI 기본형 4종 AI의 국문 글자형 경로를 원본 비율로 분리. 다른 시그니처와 색상은 보존.',
    }
    (OUT / 'release-input.json').write_text(json.dumps(config, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'status': 'ready-for-visual-review', 'box': tuple(box),
                      'source_sha256': EXPECTED_SHA256, 'svg_sha256': config['svg_sha256'],
                      'png_sha256': config['png_sha256']}, ensure_ascii=False))


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Extract exact vector artwork from the brands' official PDF/AI and stage CDN files."""
import hashlib
import io
import json
from pathlib import Path

import cairosvg
import fitz
from lxml import etree
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = Path('/Volumes/HDD-1TB/semologo-migration/kmong-line-20261019')
CDN = 'https://logo.vibers.co.kr/_clients'
SOURCE = {
    'kmong-guide.pdf': '129d0507c120c2a7fc375cad162a3702a6d84e3dff76e595340bc0c8a2f83f24',
    'LINE_Brand_icon_RGB.ai': '2b7553bad35d6b5a00d355437af6b4ec6e9afbfe34b9ff5de0f8ed7a37d1d699',
    'LINE_Brand_icon.png': '5e93437eb5ec0dcdece92d1562fcd435d1d521cca5c013d2d9e15b544a1d8a39',
    'kmong-apple-icon.png': '19de74dea67c6d86bd6a664e7d657eadf945edf7b96c7b9236b87c4607052f7a',
    'line--src-364c9cf.svg': '4d358cf98e570d57f845cadaf89585a97cd171400964936e91ed95857deaf174',
}


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def path_svg(pdf, indices):
    """Copy only the selected original filled paths; no tracing or recolouring."""
    drawings = fitz.open(OUT / pdf)[0].get_drawings()
    chosen = [drawings[i] for i in indices]
    rect = fitz.Rect(chosen[0]['rect'])
    for drawing in chosen[1:]:
        rect |= drawing['rect']
    if pdf == 'kmong-guide.pdf':
        # Leave a tiny transparent edge so anti-aliased glyph boundaries never clip.
        rect = fitz.Rect(rect.x0 - rect.width * .01, rect.y0 - rect.height * .03,
                         rect.x1 + rect.width * .01, rect.y1 + rect.height * .03)
    paths = []
    for drawing in chosen:
        commands, last = [], None
        for item in drawing['items']:
            kind, start = item[0], item[1]
            if last is None or abs(last.x - start.x) + abs(last.y - start.y) > .01:
                commands.append(f'M{start.x:.4f} {start.y:.4f}')
            if kind == 'l':
                end = item[2]
                commands.append(f'L{end.x:.4f} {end.y:.4f}')
            elif kind == 'c':
                a, b, end = item[2:5]
                commands.append(f'C{a.x:.4f} {a.y:.4f} {b.x:.4f} {b.y:.4f} {end.x:.4f} {end.y:.4f}')
            else:
                raise ValueError(f'Unexpected PDF drawing command: {kind}')
            last = end
        color = '#' + ''.join(f'{round(component * 255):02x}' for component in drawing['fill'])
        paths.append(f'<path fill="{color}" fill-rule="{"evenodd" if drawing["even_odd"] else "nonzero"}" d="{" ".join(commands)}"/>')
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{rect.x0:.4f} {rect.y0:.4f} '
           f'{rect.width:.4f} {rect.height:.4f}">{"".join(paths)}</svg>\n').encode()
    doc = etree.fromstring(svg)
    assert len(doc) == len(indices) and all(etree.QName(element).localname == 'path' for element in doc)
    return svg


def stage(brand, label, raw, extension):
    folder = f'sources/official-{brand}-20261019'
    name = f'{label}-{sha(raw)[:16]}.{extension}'
    local = OUT / brand / folder / name
    local.parent.mkdir(parents=True, exist_ok=True)
    local.write_bytes(raw)
    uploads.append({'file': str(local.relative_to(OUT)), 'key': f'_clients/{brand}/{folder}/{name}',
                    'sha256': sha(raw), 'bytes': len(raw), 'mime': 'image/svg+xml' if extension == 'svg' else 'image/png'})
    return f'{folder}/{name}'


def render_svg(raw, width):
    png = cairosvg.svg2png(bytestring=raw, output_width=width)
    with Image.open(io.BytesIO(png)) as image:
        assert image.width == width and image.mode == 'RGBA'
        alpha = image.getchannel('A')
        assert alpha.getbbox() and alpha.getextrema()[0] == 0
    return png


for name, expected in SOURCE.items():
    assert sha((OUT / name).read_bytes()) == expected, f'Official source changed: {name}'

uploads = []
black_svg = path_svg('kmong-guide.pdf', [6, 7, 8, 9, 10])
white_svg = path_svg('kmong-guide.pdf', [19, 20, 21, 22, 23])
line_svg = path_svg('LINE_Brand_icon_RGB.ai', [2, 3, 4, 5, 6, 7])
assert b'#000000' in black_svg and b'#ffffff' in white_svg and b'#06c755' in line_svg
kmong_black_svg = stage('kmong', 'wordmark-black', black_svg, 'svg')
kmong_black_png = stage('kmong', 'wordmark-black', render_svg(black_svg, 1600), 'png')
kmong_white_svg = stage('kmong', 'wordmark-white', white_svg, 'svg')
kmong_white_png = stage('kmong', 'wordmark-white', render_svg(white_svg, 1600), 'png')
kmong_icon_png = stage('kmong', 'app-icon', (OUT / 'kmong-apple-icon.png').read_bytes(), 'png')
line_icon_svg = stage('line', 'brand-icon', line_svg, 'svg')
line_icon_png = stage('line', 'brand-icon', (OUT / 'LINE_Brand_icon.png').read_bytes(), 'png')
legacy_line_wordmark = (OUT / 'line--src-364c9cf.svg').read_bytes()
assert all(etree.QName(element).localname in ('svg', 'path', 'g') for element in etree.fromstring(legacy_line_wordmark).iter())
legacy_line_wordmark_svg = stage('line', 'legacy-wordmark', legacy_line_wordmark, 'svg')
legacy_line_wordmark_png = stage('line', 'legacy-wordmark', render_svg(legacy_line_wordmark, 1600), 'png')

kmong_source = 'https://kmong.com/support/customer-center/posts/37'
kmong_guide = 'https://static.cdn.kmong.com/kmong-board/files/d03da49f26924c06abfc0e73fe937baf.pdf'
line_source = 'https://www.line.me/en/logo'
line_ai = 'https://www.line.me/static/logo/ai/LINE_Brand_icon_RGB.ai'
kmong_variants = {
    'schema': 1, 'algo_v': 1, 'id': 'kmong', 'primary': 'official-wordmark-black',
    'variants': [
        {'key': 'official-wordmark-black', 'form': 'wordmark', 'lang': 'en', 'color': 'black',
         'label': '공식 워드마크 · 검정', 'files': {'svg': kmong_black_svg, 'png': kmong_black_png},
         'provider': '크몽 브랜드 가이드', 'origin': 'collected', 'order': 0, 'source_url': kmong_guide},
        {'key': 'official-wordmark-white', 'form': 'wordmark', 'lang': 'en', 'color': 'white',
         'label': '공식 워드마크 · 흰색', 'files': {'svg': kmong_white_svg, 'png': kmong_white_png},
         'provider': '크몽 브랜드 가이드', 'origin': 'collected', 'order': 1, 'source_url': kmong_guide},
        {'key': 'official-app-icon', 'form': 'symbol', 'lang': 'none', 'color': 'original',
         'label': '공식 K 앱 아이콘 · PNG', 'files': {'png': kmong_icon_png},
         'provider': '크몽 공식 사이트', 'origin': 'collected', 'order': 2,
         'source_url': 'https://kmong.com/apple-touch-icon.png'},
    ],
}
line_variants = {
    'schema': 1, 'algo_v': 1, 'id': 'line', 'primary': 'official-brand-icon',
    'variants': [
        {'key': 'official-brand-icon', 'form': 'symbol', 'lang': 'none', 'color': 'original',
         'label': '공식 브랜드 아이콘 · 녹색', 'files': {'svg': line_icon_svg, 'png': line_icon_png},
         'provider': 'LINE 브랜드 가이드', 'origin': 'collected', 'order': 0, 'source_url': line_ai,
         'source_note': '공식 AI의 아이콘 경로를 형식만 SVG로 변환. 색상·형태·여백 변경 없음.'},
        {'key': 'legacy-chat-symbol', 'form': 'symbol', 'lang': 'none', 'color': 'legacy',
         'label': '이전 수집본 · 색상/도입 연도 미확인',
         'files': {'svg': 'logo.svg', 'png': 'logo.png'},
         'provider': '기존 수집본', 'origin': 'collected', 'order': 1},
        {'key': 'legacy-wordmark', 'form': 'wordmark', 'lang': 'en', 'color': 'legacy',
         'label': '기존 LINE 글자형 · 색상/도입 연도 미확인',
         'files': {'svg': legacy_line_wordmark_svg, 'png': legacy_line_wordmark_png},
         'provider': '기존 중복 콘텐츠에서 통합 · 공식 출처 미확인',
         'origin': 'collected', 'order': 2},
    ],
}
patches = {
    'kmong': {'id': 'kmong', 'name_ko': '크몽', 'name_en': 'kmong', 'category': '서비스·기업',
              'origin': 'KR', 'website': 'https://kmong.com/', 'domain': 'kmong.com',
              'logo_svg': kmong_black_svg, 'svg_transparent': kmong_black_svg,
              'logo_png': kmong_black_png, 'preview_png': f'{CDN}/kmong/{kmong_black_png}',
              'has_svg': True, 'has_png': True, 'light': False,
              'presentation': {'file': kmong_black_png, 'bg': 'light', 'svgFile': kmong_black_svg},
              'variants_n': 3, 'added_at': '2026-10-19', 'logo_published_at': '2026-10-19T00:00:00Z',
              'introduced_year': 2025, 'official_source_page': kmong_source,
              'asset_origin': '크몽 공식 브랜드 가이드 PDF 벡터 및 공식 앱 아이콘 PNG',
              'asset_review_status': 'verified'},
    'line': {'name_ko': '라인', 'name_en': 'LINE', 'website': 'https://line.me/', 'domain': 'line.me',
             'logo_svg': line_icon_svg, 'svg_transparent': line_icon_svg,
             'logo_png': line_icon_png, 'preview_png': f'{CDN}/line/{line_icon_png}',
             'has_svg': True, 'has_png': True, 'light': False,
             'presentation': {'file': line_icon_png, 'bg': 'light', 'svgFile': line_icon_svg},
             'variants_n': 3, 'logo_published_at': '2026-10-19T00:00:00Z',
             'official_source_page': line_source,
             'asset_origin': 'LINE 공식 브랜드 가이드 AI 및 PNG · 기존 글자형은 출처 미확인으로 보존', 'asset_review_status': 'verified'},
    'line--src-364c9cf': {'hidden': True, 'variant_of': 'line', 'merged_into': 'line',
                           'hidden_reason': 'LINE 글자형을 대표 콘텐츠의 기존 버전으로 통합'},
    'line-wordmark': {'hidden': True, 'variant_of': 'line', 'merged_into': 'line',
                      'hidden_reason': 'LINE 앱 아이콘 중복을 대표 콘텐츠로 통합'},
}
release = {'schema': 1, 'source_kind': 'official-brand-guides', 'snapshot_date': '2026-10-19',
           'patches': patches, 'variants': {'kmong': kmong_variants, 'line': line_variants}}
(ROOT / 'src/lib/reviewed-kmong-line-20261019.json').write_text(json.dumps(release, ensure_ascii=False, indent=2) + '\n')
(OUT / 'uploads.json').write_text(json.dumps(uploads, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'brands': list(patches), 'files': len(uploads), 'bytes': sum(x['bytes'] for x in uploads)}, ensure_ascii=False))

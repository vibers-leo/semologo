"""Prepare verified Dribbble media-kit and WikiLeaks site assets for the CDN."""
import hashlib
import io
import json
import zipfile
from pathlib import Path

import cairosvg
import requests
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'marketing/assets/dribbble-wikileaks-official-20261014'
OUT.mkdir(parents=True, exist_ok=True)
UPLOADS = []
PREFIX = 'sources/official-refresh-20261014'
CDN = 'https://logo.vibers.co.kr/_clients'
DRIBBBLE_KIT = 'https://cdn.dribbble.com/uploads/48952/original/636122d76554288248eec64ad170fd2a.zip?1693371020='
WIKILEAKS_ICON = 'https://wikileaks.org/static/img/wl-logo.png'


def store(brand, content, extension):
    digest = hashlib.sha256(content).hexdigest()
    relative = f'{PREFIX}/{digest[:20]}.{extension}'
    local = OUT / brand / Path(relative).name
    local.parent.mkdir(parents=True, exist_ok=True)
    local.write_bytes(content)
    UPLOADS.append({'brand': brand, 'file': str(local.relative_to(ROOT)),
                    'key': f'_clients/{brand}/{relative}', 'sha256': digest})
    return relative


response = requests.get(DRIBBBLE_KIT, timeout=40)
response.raise_for_status()
archive = zipfile.ZipFile(io.BytesIO(response.content))
assert set(name.rsplit('/', 1)[-1] for name in archive.namelist() if name.endswith('.svg')) == {'wordmark.svg', 'logo.svg'}
dribbble = {}
for name, output_width in [('wordmark', 2400), ('logo', 1200)]:
    svg = archive.read(f'Dribbble Media Kit/{name}.svg')
    assert b'<svg' in svg and b'<image' not in svg and b'data:image/' not in svg
    png = cairosvg.svg2png(bytestring=svg, output_width=output_width)
    image = Image.open(io.BytesIO(png))
    assert image.mode == 'RGBA' and image.getchannel('A').getextrema() == (0, 255)
    dribbble[name] = {'svg': store('dribbble', svg, 'svg'), 'png': store('dribbble', png, 'png')}

response = requests.get(WIKILEAKS_ICON, timeout=40)
response.raise_for_status()
wiki_png = response.content
wiki_image = Image.open(io.BytesIO(wiki_png))
assert wiki_image.size == (213, 500) and wiki_image.mode == 'RGBA'
wiki_file = store('wikileaks', wiki_png, 'png')

release = {
    'patches': {
        'dribbble': {
            'name_ko': 'Dribbble', 'name_en': 'Dribbble',
            'logo_svg': dribbble['wordmark']['svg'], 'svg_transparent': dribbble['wordmark']['svg'],
            'logo_png': dribbble['wordmark']['png'],
            'preview_png': f"{CDN}/dribbble/{dribbble['wordmark']['png']}",
            'has_svg': True, 'has_png': True, 'light': False, 'light_logo': False,
            'dark_variant': False,
            'presentation': {'file': dribbble['wordmark']['png'], 'bg': 'light',
                             'svgFile': dribbble['wordmark']['svg']},
            'variants_n': 2, 'logo_published_at': '2026-10-14T10:15:00Z',
            'official_source_page': 'https://dribbble.com/media-kit',
            'asset_origin': 'Dribbble 공식 미디어 키트', 'asset_review_status': 'verified',
        },
        'wikileaks': {
            'name_ko': '위키리크스', 'name_en': 'WikiLeaks', 'category': '미디어·엔터',
            'logo_svg': '', 'svg_transparent': '', 'logo_png': wiki_file,
            'preview_png': f'{CDN}/wikileaks/{wiki_file}',
            'has_svg': False, 'has_png': True, 'light': False, 'light_logo': False,
            'dark_variant': False,
            'presentation': {'file': wiki_file, 'bg': 'light'},
            'variants_n': 2, 'logo_published_at': '2026-10-14T10:14:00Z',
            'homepage': 'https://wikileaks.org/', 'official_source_page': 'https://wikileaks.org/',
            'asset_origin': 'WikiLeaks 공식 사이트 현재 헤더 이미지', 'asset_review_status': 'verified',
        },
    },
    'variants': {
        'dribbble': {
            'schema': 1, 'algo_v': 1, 'id': 'dribbble', 'primary': 'official-wordmark',
            'variants': [
                {'key': 'official-wordmark', 'form': 'wordmark', 'lockup': 'wordmark',
                 'lang': 'en', 'color': 'original', 'label': 'Dribbble 공식 글자형 · 투명 배경',
                 'files': dribbble['wordmark'], 'provider': 'Dribbble', 'origin': 'collected',
                 'official': True, 'order': 0, 'source_url': DRIBBBLE_KIT},
                {'key': 'official-symbol', 'form': 'symbol', 'lockup': 'symbol',
                 'lang': 'none', 'color': 'original', 'label': 'Dribbble 공식 공 심볼 · 투명 배경',
                 'files': dribbble['logo'], 'provider': 'Dribbble', 'origin': 'collected',
                 'official': True, 'order': 1, 'source_url': DRIBBBLE_KIT},
            ],
        },
        'wikileaks': {
            'schema': 1, 'algo_v': 1, 'id': 'wikileaks', 'primary': 'official-site-vertical',
            'variants': [
                {'key': 'official-site-vertical', 'form': 'vertical', 'lockup': 'vertical',
                 'lang': 'en', 'color': 'original', 'label': '현재 공식 사이트 로고 · PNG 원본',
                 'files': {'png': wiki_file}, 'provider': 'WikiLeaks', 'origin': 'collected',
                 'official': True, 'order': 0, 'source_url': WIKILEAKS_ICON,
                 'png_width': 213, 'png_height': 500},
                {'key': 'archive-2008-vector', 'form': 'vertical', 'lockup': 'vertical',
                 'lang': 'en', 'color': 'original', 'label': '2008년 로고 벡터 · 아카이브',
                 'files': {'svg': 'logo.svg', 'png': 'logo-800.png'},
                 'provider': 'Wikimedia Commons', 'origin': 'archive', 'order': 1,
                 'source_url': 'https://commons.wikimedia.org/wiki/File:Wikileaks_logo.svg',
                 'source_note': 'CC BY-SA 3.0 · 기존 로고는 현재 공식 사이트 대표 이미지와 다름'},
            ],
        },
    },
    'source_kind': 'official-brand-pages', 'snapshot_date': '2026-10-14',
}
(OUT / 'uploads.json').write_text(json.dumps(UPLOADS, ensure_ascii=False, indent=2) + '\n')
(OUT / 'release.json').write_text(json.dumps(release, ensure_ascii=False, indent=2) + '\n')
(ROOT / 'src/lib/reviewed-dribbble-wikileaks-20261014.json').write_text(json.dumps(release, ensure_ascii=False, indent=2) + '\n')
print('Prepared', len(UPLOADS), 'official files; Dribbble 2 forms, WikiLeaks current site PNG + archived vector')

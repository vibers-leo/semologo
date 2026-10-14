"""Keep Blackyak's icon, and make the official symbol+text lockup a transparent representative."""
import hashlib
import json
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path

import cairosvg
import requests
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'marketing/assets/blackyak-official-wordmark-20261014'
OUT.mkdir(parents=True, exist_ok=True)
CDN = 'https://logo.vibers.co.kr/_clients/blackyak/'
WHITE_SOURCE = 'https://cdn.byn.kr/corp/img/common/brand_logo_BY.svg'
BLACK_SOURCE = 'https://global.blackyak.com/cdn/shop/files/blackyak-logo_4x_231d717c-5f7e-4d34-a998-e7f50216747b.png?v=1654593748'
published_at = datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')
white_svg = requests.get(WHITE_SOURCE, timeout=25).content
black_original = requests.get(BLACK_SOURCE, timeout=25).content
assert white_svg.lstrip().startswith(b'<svg') and b'<image' not in white_svg and b'<script' not in white_svg
assert white_svg.count(b'fill="white"') >= 10
assert b'KIDS' not in white_svg.upper()
source_image = Image.open(BytesIO(black_original)).convert('RGBA')
assert source_image.width >= 600 and source_image.getextrema()[3][0] == 0
black_svg = white_svg.replace(b'fill="white"', b'fill="#000000"')
assert black_svg != white_svg
black_png = cairosvg.svg2png(bytestring=black_svg, output_width=2400)
white_png = cairosvg.svg2png(bytestring=white_svg, output_width=2400)
for raw in (black_png, white_png):
    image = Image.open(BytesIO(raw))
    assert image.mode == 'RGBA' and image.width == 2400 and image.getextrema()[3][0] == 0
files, uploads = {}, []
for name, raw, ext in [
    ('official-white', white_svg, 'svg'), ('official-black-original', black_original, 'png'),
    ('wordmark-black', black_svg, 'svg'), ('wordmark-black', black_png, 'png'),
    ('wordmark-white', white_png, 'png'),
]:
    sha = hashlib.sha256(raw).hexdigest()
    relative = f'sources/official-blackyak-20261014/{sha[:20]}.{ext}'
    local = OUT / f'{name}.{ext}'
    local.write_bytes(raw)
    files[f'{name}.{ext}'] = relative
    uploads.append({'id': 'blackyak', 'file': str(local.relative_to(ROOT)), 'key': f'_clients/blackyak/{relative}', 'sha256': sha, 'bytes': len(raw)})
old = requests.get(CDN + 'variants.json', timeout=25).json()
assert old['id'] == 'blackyak' and len(old['variants']) == 1 and old['variants'][0]['key'] == 'wordmark'
assert old['variants'][0]['files']['png'] == 'logo-800.png'  # The mismatched, symbol-only derivative.
variants = [
    {'key': 'official-horizontal-black', 'form': 'horizontal', 'lockup': 'horizontal', 'lang': 'en', 'color': 'black', 'label': '심볼+글자 가로형 · 검정 · 투명 배경', 'files': {'svg': files['wordmark-black.svg'], 'png': files['wordmark-black.png']}, 'provider': 'BYN블랙야크그룹 공식 SVG에서 검정색 파생', 'origin': 'derived', 'order': 0, 'source_url': WHITE_SOURCE, 'derived_from': files['official-white.svg'], 'source_note': '공식 그룹의 흰색 벡터를 검정으로 재색상. 공식 글로벌몰의 검정 로고와 형태 대조.'},
    {'key': 'official-horizontal-white', 'form': 'horizontal', 'lockup': 'horizontal', 'lang': 'en', 'color': 'white', 'label': '심볼+글자 가로형 · 흰색 · 공식 벡터', 'files': {'svg': files['official-white.svg'], 'png': files['wordmark-white.png']}, 'provider': 'BYN블랙야크그룹', 'origin': 'collected', 'order': 1, 'source_url': WHITE_SOURCE},
    {'key': 'official-global-black-png', 'form': 'horizontal', 'lockup': 'horizontal', 'lang': 'en', 'color': 'black', 'label': '심볼+글자 가로형 · 글로벌몰 PNG 원본', 'files': {'png': files['official-black-original.png']}, 'provider': 'BLACKYAK 글로벌몰', 'origin': 'collected', 'order': 2, 'source_url': BLACK_SOURCE},
    {'key': 'symbol-transparent', 'form': 'symbol', 'lockup': 'symbol', 'lang': 'none', 'color': 'black', 'label': '야크 심볼 · 투명 PNG', 'files': {'png': 'logo-transparent.png'}, 'provider': '기존 수집본', 'origin': 'collected', 'order': 3},
    {'key': 'legacy-wordmark-white', 'form': 'horizontal', 'lockup': 'horizontal', 'lang': 'en', 'color': 'white', 'label': '기존 흰색 벡터 · 시기 미확인', 'files': {'svg': 'logo.svg'}, 'provider': 'logo.dev 기존 수집본', 'origin': 'collected', 'order': 4},
]
manifest = {'schema': 1, 'algo_v': 1, 'id': 'blackyak', 'primary': 'official-horizontal-black', 'variants': variants}
png_file = files['wordmark-black.png']
patch = {'logo_svg': files['wordmark-black.svg'], 'svg_transparent': files['wordmark-black.svg'], 'logo_png': png_file, 'preview_png': CDN + png_file, 'has_svg': True, 'has_png': True, 'light': False, 'light_logo': False, 'dark_variant': False, 'presentation': {'file': png_file, 'bg': 'light', 'svgFile': files['wordmark-black.svg']}, 'variants_n': len(variants), 'logo_published_at': published_at, 'official_source_page': 'https://corp.byn.kr/ui/page/B_Brand_GroupCom', 'asset_origin': 'BYN블랙야크그룹 공식 SVG 및 BLACKYAK 글로벌몰 PNG', 'asset_review_status': 'verified'}
release = {'patches': {'blackyak': patch}, 'variants': {'blackyak': manifest}, 'source_kind': 'official-blackyak-sites', 'snapshot_date': '2026-10-14'}
for name, value in [('release', release), ('uploads', uploads), ('review-proof', {'official_white_source_sha256': hashlib.sha256(white_svg).hexdigest(), 'official_black_source_sha256': hashlib.sha256(black_original).hexdigest(), 'official_black_dimensions': source_image.size, 'vector_png_width': 2400, 'old_symbol_png_preserved': True})]:
    (OUT / f'{name}.json').write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
(ROOT / 'src/lib/reviewed-blackyak-wordmark-20261014.json').write_text(json.dumps(release, ensure_ascii=False, indent=2) + '\n')
print('Blackyak: official horizontal SVG, 2400px transparent PNG, original PNG, existing symbol retained')

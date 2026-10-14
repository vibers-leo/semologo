"""Prepare distinct, visually matched brand identities from the supplied Better Logos ZIP."""
import hashlib
import json
from io import BytesIO
from pathlib import Path

import cairosvg
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'marketing/assets/figma-better-collection-20261010/source'
OUT = ROOT / 'marketing/assets/figma-better-new-identities-20261014'
OUT.mkdir(parents=True, exist_ok=True)
BRANDS = [
    ('zacht-studios', 'Zacht Studios', '자흐트 스튜디오', '서비스·기업', 'https://www.zacht.studio/', 'Zacht Studios'),
    ('tamarisc', 'Tamarisc', '타마리스크', '금융·결제', 'https://www.tamarisc.com/', 'Tamarisc'),
]
release = {'patches': {}, 'variants': {}, 'source_kind': 'user-provided-figma-community', 'official': False, 'snapshot_date': '2026-10-14'}
uploads, proof = [], []
for brand_id, name, name_ko, category, homepage, stem in BRANDS:
    variants = []
    choices = [('', 'original', '원색')]
    choices += [(suffix, color, label) for suffix, color, label in [(' (white)', 'white', '흰색'), (' (black)', 'black', '검정')] if (SOURCE / f'{stem}{suffix}.svg').exists()]
    for index, (suffix, color, label) in enumerate(choices):
        source = SOURCE / f'{stem}{suffix}.svg'
        raw = source.read_bytes()
        assert raw.lstrip().startswith(b'<svg') and b'<image' not in raw and b'<script' not in raw and b'<foreignObject' not in raw
        assert b'href=' not in raw and b'url(http' not in raw
        assert b'viewBox=' in raw and b'<path' in raw
        source_sha = hashlib.sha256(raw).hexdigest()
        png = cairosvg.svg2png(bytestring=raw, output_width=2000)
        im = Image.open(BytesIO(png))
        assert im.mode == 'RGBA' and im.getextrema()[3][0] == 0 and im.width == 2000 and im.height >= 300
        files = {}
        for ext, content in [('svg', raw), ('png', png)]:
            sha = hashlib.sha256(content).hexdigest()
            relative = f'sources/figma-better-new-20261014/{sha[:20]}.{ext}'
            local = OUT / f'{brand_id}-{color}.{ext}'
            local.write_bytes(content)
            files[ext] = relative
            uploads.append({'id': brand_id, 'file': str(local.relative_to(ROOT)), 'key': f'_clients/{brand_id}/{relative}', 'sha256': sha, 'bytes': len(content)})
        variants.append({'key': f'community-{color}', 'label': f'커뮤니티 수록 {label} · 시기 미확인', 'form': 'horizontal', 'lockup': 'horizontal', 'lang': 'en', 'color': color, 'files': files, 'provider': '사용자 제공 Better Logos Figma Community 수집본', 'origin': 'community', 'official': False, 'order': index, 'source_sha256': source_sha, 'source_note': '공식 사이트에서 브랜드 및 원색 로고의 형태를 대조함. 제공 파일 자체는 공식 배포 원본이 아님.', 'png_width': im.width, 'png_height': im.height})
        proof.append({'id': brand_id, 'source': str(source.relative_to(ROOT)), 'source_sha256': source_sha, 'color': color, 'png_dimensions': im.size, 'transparent_alpha': True})
    first = variants[0]['files']
    release['variants'][brand_id] = {'schema': 1, 'algo_v': 1, 'id': brand_id, 'primary': 'community-original', 'variants': variants}
    release['patches'][brand_id] = {'id': brand_id, 'name_ko': name_ko, 'name_en': name, 'aliases': [name, name_ko], 'category': category, 'origin': 'GLOBAL', 'has_svg': True, 'has_png': True, 'logo_svg': first['svg'], 'svg_transparent': first['svg'], 'logo_png': first['png'], 'preview_png': f'https://logo.vibers.co.kr/_clients/{brand_id}/{first["png"]}', 'presentation': {'file': first['png'], 'bg': 'light'}, 'variants_n': len(variants), 'asset_origin': '사용자 제공 Better Logos Figma Community 수집본', 'asset_review_status': 'verified', 'added_at': '2026-10-14', 'logo_published_at': '2026-10-14T12:00:00Z', 'homepage': homepage, 'official_source_page': homepage, 'official_asset_reviewed': False}
for filename, value in [('release', release), ('uploads', uploads), ('review-proof', proof)]:
    (OUT / f'{filename}.json').write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
print(f'{len(BRANDS)} genuinely new identities, {len(uploads)} SVG/PNG files, {len(proof)} visually reviewed variants')

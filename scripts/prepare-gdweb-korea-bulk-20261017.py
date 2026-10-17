#!/usr/bin/env python3
"""Pin visually reviewed Korean first-party logos into publishable batches."""

import argparse
import hashlib
import io
import json
import re
import runpy
import shutil
import urllib.parse
from pathlib import Path

import cairosvg
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
RASTER = runpy.run_path(str(ROOT / 'scripts/publish-reviewed-fleet-raster.py'))
HELD_IDENTITIES = {38, 155, 210, 214, 225, 62}
NAME_OVERRIDES = {
    23: '셀파크피부과', 50: '챔피언스시티',
    78: '안성인삼농협', 132: 'AllinK Beauty',
    163: '대한민국 미술축제 (2026)', 205: '재능그룹',
}


def category(name):
    if re.search('의원|병원|피부과|한의원|치과|클리닉', name):
        return '의료·바이오'
    if re.search('대학|대학교|아카데미|교육', name):
        return '교육'
    if re.search('축제|어워드|프라이즈|뮤지엄|페스티벌', name):
        return '미디어·엔터'
    if re.search('호텔|리조트|스테이', name):
        return '숙박·여행'
    if re.search('건설|부동산|아파트|주택', name):
        return '건설·부동산'
    if re.search('공사|공단|재단|위원회', name):
        return '공공·기관'
    if re.search('소프트|AI|랩스|디지털', name, re.I):
        return 'IT·테크'
    return '브랜드'


def opaque_quality(image):
    rgba = image.convert('RGBA')
    alpha = rgba.getchannel('A')
    if alpha.getextrema() != (0, 255):
        raise ValueError('no full transparency')
    sample = rgba.copy()
    sample.thumbnail((400, 400))
    pixels = list(sample.get_flattened_data())
    solid = [p for p in pixels if p[3] >= 250]
    if not solid:
        raise ValueError('empty logo')
    white = sum(min(p[:3]) >= 245 for p in solid)
    if len(solid) / len(pixels) > .8 and white / len(pixels) > .5:
        raise ValueError('embedded white canvas')
    bright = sum(min(p[:3]) >= 225 for p in solid) / len(solid)
    if bright > .78:
        raise ValueError('white-only logo requires a dark representative background')
    return 1 - bright


def inspect(asset, base):
    path = base / asset['file']
    raw = path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != asset['sha256'] or len(raw) > 500_000:
        raise ValueError('asset bytes changed')
    ext = path.suffix
    if ext == '.svg':
        if not re.search(br'<svg(?:\s|>)', raw[:1500], re.I):
            raise ValueError('missing SVG root')
        if re.search(br'<(?:image|script|foreignObject)\b|data:image/|javascript:|\bonload\s*=|<!DOCTYPE|@import|url\(', raw, re.I):
            raise ValueError('linked, active or raster SVG')
        render = cairosvg.svg2png(bytestring=raw, output_width=1200)
        with Image.open(io.BytesIO(render)) as opened:
            if opened.height < 100:
                raise ValueError('render too flat')
            image = opened.convert('RGBA')
        score = opaque_quality(image)
        return 'svg', score + 2, image.size
    with Image.open(io.BytesIO(raw)) as opened:
        image = opened.convert('RGBA')
    if image.width < 400 or image.height < 80:
        raise ValueError('raster too small')
    score = opaque_quality(image)
    RASTER['make_png'](raw, {'id': asset['file'], 'width': image.width, 'height': image.height})
    return 'raster', score, image.size


def recommended_background(path):
    raw = path.read_bytes()
    with Image.open(io.BytesIO(cairosvg.svg2png(bytestring=raw, output_width=600))
                    if path.suffix == '.svg' else path) as opened:
        rgba = opened.convert('RGBA')
    rgba.thumbnail((300, 300))
    solid = [pixel for pixel in rgba.get_flattened_data() if pixel[3] >= 200]
    if not solid:
        raise ValueError('empty logo')
    pale_ratio = sum(min(pixel[:3]) > 170 for pixel in solid) / len(solid)
    return 'dark' if pale_ratio >= .35 else 'light'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--stage', type=Path, required=True)
    args = parser.parse_args()
    base = args.stage
    rows = {x['gdwebId']: x for x in json.loads((base / 'manifest.json').read_text())['results']}
    review = json.loads((base / 'renderable-index.json').read_text())
    indexes = json.loads((base / 'reviewed-indexes.json').read_text())
    selected, held = [], []
    for index in indexes:
        pick = review[index]
        row = rows[pick['gdwebId']]
        if index in HELD_IDENTITIES:
            held.append({'gdwebId': pick['gdwebId'], 'name': row['name'],
                         'reason': 'reviewed asset is unrelated or identity ambiguous'})
            continue
        possible = []
        for asset in row['assets']:
            try:
                kind, score, size = inspect(asset, base)
                possible.append((score, kind, size, asset))
            except Exception as error:
                held.append({'gdwebId': pick['gdwebId'], 'name': row['name'],
                             'assetUrl': asset['url'], 'reason': str(error)[:130]})
        if not possible:
            continue
        score, kind, size, asset = max(possible, key=lambda x: x[0])
        domain = urllib.parse.urlsplit(row['site']).hostname.removeprefix('www.')
        ident = re.sub('[^a-z0-9]+', '-', domain.lower()).strip('-')
        if not ident or len(ident) > 120:
            raise ValueError('Invalid domain ID: ' + domain)
        name = NAME_OVERRIDES.get(index, row['name'])
        item = {'id': ident, 'name': name, 'domain': domain, 'website': row['site'],
                'category': category(name), 'form': 'horizontal' if size[0] / size[1] >= 1.55 else 'symbol',
                'sourceFile': ident + ('.svg' if kind == 'svg' else '.png' if asset['file'].endswith('.png') else '.webp'),
                'sourcePage': row['site'], 'discoveryPage': row['discoveryPage'],
                'assetUrl': asset['url'], 'sha256': asset['sha256'],
                'gdwebId': row['gdwebId'], 'reviewedVisualIndex': index,
                'recommendedBg': recommended_background(base / asset['file'])}
        if kind == 'raster':
            item.update(width=size[0], height=size[1])
        selected.append((kind, item, asset['file']))
    for kind in ('svg', 'raster'):
        stem = f'gdweb-korea-bulk-20261017-{kind}'
        dest = ROOT / 'data/collection' / (stem + '-assets')
        dest.mkdir(parents=True, exist_ok=True)
        items = []
        for item_kind, item, source_file in selected:
            if item_kind != kind:
                continue
            target = dest / item['sourceFile']
            source = base / source_file
            if target.exists() and target.read_bytes() != source.read_bytes():
                raise ValueError('Conflicting batch source file: ' + str(target))
            shutil.copyfile(source, target)
            items.append(item)
        if len({x['id'] for x in items}) != len(items):
            raise ValueError('Duplicate domain IDs')
        manifest = {'schemaVersion': 1, 'status': 'visually-reviewed-pending-publish',
                    'source': 'GDWEB discovery → official Korean site → visual sheet review',
                    'items': items}
        (ROOT / 'data/collection' / (stem + '.json')).write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
        print(json.dumps({'kind': kind, 'selected': len(items), 'assets': str(dest)}))
    (base / 'review-holds.json').write_text(json.dumps(held, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'reviewed': len(indexes), 'selected': len(selected), 'heldAssets': len(held)}))


if __name__ == '__main__':
    main()

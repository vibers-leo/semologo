#!/usr/bin/env python3
"""Check recovered SVG originals and render a contact sheet for human review."""
import hashlib
import io
import json
from pathlib import Path

import cairosvg
from lxml import etree
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'marketing/assets/worker-logo-expansion-20261015'
VISUAL_HOLDS = {
    'ko-official-기장군도시관리공단': 'CI 사용 예시판이며 대표 로고 단독 파일이 아님',
    'ko-official-사천시복지청소년재단': '창립 30주년 기념 그래픽이며 기본 기관 로고가 아님',
    'us-index-cvrx': 'Barostim 제품 로고로 CVRx 기업 대표 로고가 아님',
    'us-index-rgnx': '장식 이미지로 기업 로고가 아님',
    'us-index-twst': '글자와 점 배열이 분리된 부분 로고',
    'us-index-neo': 'NeoGenomics 전체 로고가 아닌 일부 글자형',
    'us-index-swim': 'swim.com 워드마크와 Latham 기업 로고의 관계 확인 필요',
    'us-index-gdot': 'Green Dot Bank와 상장사 Green Dot Corp의 대표 관계 확인 필요',
}


def safe_svg(raw):
    try:
        root = etree.fromstring(raw, etree.XMLParser(resolve_entities=False, no_network=True))
        if etree.QName(root).localname != 'svg' or b'<!ENTITY' in raw or b'@import' in raw:
            return False, 'invalid-svg'
        for element in root.iter():
            if not isinstance(element.tag, str):
                continue
            if etree.QName(element).localname in {'script', 'foreignObject', 'image'}:
                return False, 'active-or-embedded-content'
            for key, value in element.attrib.items():
                local = etree.QName(key).localname.lower()
                if local.startswith('on') or 'javascript:' in value.lower() or 'url(http' in value.lower():
                    return False, 'active-or-external-reference'
                if local in {'href', 'src'} and not value.startswith('#'):
                    return False, 'external-reference'
        return True, 'safe-vector'
    except Exception:
        return False, 'parse-failed'


def main():
    manifest = json.loads((OUT / 'manifest.json').read_text())
    plan = {x['id']: x for x in json.loads((ROOT / 'data/collection/semologo-worker-sources-next-20261015.json').read_text())['sources']}
    rows = []
    for item in manifest['results']:
        if not item.get('file'):
            continue
        raw = (OUT / item['file']).read_bytes()
        assert hashlib.sha256(raw).hexdigest() == item['sha256']
        source = plan[item['sourceId']]
        okay, reason = safe_svg(raw)
        row = {'sourceId': item['sourceId'], 'lane': source['lane'], 'file': item['file'],
               'sha256': item['sha256'], 'bytes': len(raw), 'collectionPurpose': source['collectionPurpose'],
               'catalogExactNameMatches': source['catalogExactNameMatches'],
               'safety': reason, 'rendered': False, 'publicationStatus': 'PENDING',
               'reviewDecision': source.get('reviewDecision', 'hold-visual-review'),
               'reviewReason': source.get('reviewReason') or VISUAL_HOLDS.get(item['sourceId'])}
        if row['reviewReason'] and row['reviewDecision'] == 'hold-visual-review':
            row['reviewDecision'] = 'hold-quality-or-identity'
        if not okay:
            row['reviewDecision'] = 'hold-unsafe-svg'
        if okay:
            try:
                png = cairosvg.svg2png(bytestring=raw, output_width=380)
                with Image.open(io.BytesIO(png)) as pic:
                    rgba = pic.convert('RGBA')
                    row['rendered'] = bool(rgba.getchannel('A').getbbox())
                    row['previewSize'] = list(rgba.size)
            except Exception:
                row['safety'] = 'render-failed'
        rows.append(row)
    report = {'schemaVersion': 1, 'verifiedOriginals': len(rows), 'safeRendered': sum(x['rendered'] for x in rows),
              'rows': rows, 'reviewStatus': 'visual-and-identity-review-required'}
    (OUT / 'audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    previews = [row for row in rows if row['rendered']]
    width, tile_w, tile_h, cols = 1200, 240, 180, 5
    sheet = Image.new('RGB', (width, ((len(previews) + cols - 1) // cols) * tile_h), 'white')
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype('/System/Library/Fonts/AppleGothic.ttf', 12)
    for index, row in enumerate(previews):
        raw = (OUT / row['file']).read_bytes()
        png = cairosvg.svg2png(bytestring=raw, output_width=210)
        with Image.open(io.BytesIO(png)) as pic:
            image = pic.convert('RGBA')
            image.thumbnail((210, 130))
            x, y = (index % cols) * tile_w, (index // cols) * tile_h
            sheet.paste(image, (x + (tile_w - image.width) // 2, y + (130 - image.height) // 2), image)
            draw.text((x + 7, y + 135), row['sourceId'][:30], font=font, fill='black')
            draw.text((x + 7, y + 153), row['collectionPurpose'], font=font, fill='#666666')
    sheet.save(OUT / 'contact-sheet.jpg', quality=88)
    print(json.dumps({'verified': len(rows), 'safeRendered': report['safeRendered'],
                      'reviewRequired': len(rows)}, ensure_ascii=False))


if __name__ == '__main__':
    main()

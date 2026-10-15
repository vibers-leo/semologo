#!/usr/bin/env python3
"""Prepare reviewed CEPA and GWEP official vectors without redrawing their artwork."""
import hashlib
import json
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'marketing/assets/economic-promotion-audit-20261015'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(*args):
    subprocess.run(args, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)


def crop(source, target, box):
    tree = ET.parse(source)
    root = tree.getroot()
    x, y, width, height = box
    root.set('viewBox', f'{x} {y} {width} {height}')
    root.set('width', f'{width}pt')
    root.set('height', f'{height}pt')
    tree.write(target, encoding='utf-8', xml_declaration=True)


def png(svg, output):
    run('inkscape', str(svg), '--export-width=2400', '--export-background-opacity=0',
        f'--export-filename={output}')


def main():
    variants = {'gongu-ci-0094': [], 'gongu-ci-0418': [], 'gongu-ci-0571': []}
    cepa_names = {
        1: ('vertical-ko', 'vertical', '국문 세로형'),
        2: ('horizontal-ko', 'horizontal', '국문 가로형'),
        3: ('vertical-bilingual', 'vertical', '국영문 세로형'),
        4: ('horizontal-bilingual', 'horizontal', '국영문 가로형'),
        5: ('vertical-en', 'vertical', '영문 세로형'),
        6: ('horizontal-en', 'horizontal', '영문 가로형'),
    }
    for index, (key, form, label) in cepa_names.items():
        source = OUT / f'cepa-ai-{index}.ai'
        svg = OUT / f'cepa-{key}.svg'
        output = OUT / f'cepa-{key}.png'
        run('inkscape', str(source), '--pdf-poppler', '--export-area-drawing',
            '--export-plain-svg', f'--export-filename={svg}')
        png(svg, output)
        variants['gongu-ci-0094'].append({'key': key, 'form': form, 'label': label,
            'svg': svg.name, 'png': output.name, 'ai': source.name,
            'official_png': f'cepa-png-{index}.png'})

    # The official Korean horizontal lockup contains two independently drawn
    # groups, separated by a clear 13.5pt gap. Crop the viewBox only.
    cepa_horizontal = OUT / 'cepa-horizontal-ko.svg'
    for key, form, label, box in (
        ('symbol', 'symbol', 'CEPA 심볼마크', (0, 0, 239, 69.457031)),
        ('wordmark-ko', 'wordmark', '충남경제진흥원 글자형', (252, 0, 407.7, 69.457031)),
    ):
        svg = OUT / f'cepa-{key}.svg'
        output = OUT / f'cepa-{key}.png'
        crop(cepa_horizontal, svg, box)
        png(svg, output)
        variants['gongu-ci-0094'].append({'key': key, 'form': form, 'label': label,
            'svg': svg.name, 'png': output.name, 'ai': 'cepa-ai-2.ai'})

    gwep_source = OUT / 'gwep-official.ai'
    full = OUT / 'gwep-official-full.svg'
    run('inkscape', str(gwep_source), '--pdf-poppler', '--export-area-drawing',
        '--export-plain-svg', f'--export-filename={full}')
    for key, form, label, box in (
        ('horizontal', 'horizontal', '국영문 가로형 · 컬러', (12, -1, 192, 30)),
        ('symbol', 'symbol', '강원경제진흥원 심볼', (12.5, -1, 30.5, 30)),
        ('wordmark', 'wordmark', '국영문 글자형', (43.5, -1, 160, 30)),
    ):
        svg = OUT / f'gwep-{key}.svg'
        output = OUT / f'gwep-{key}.png'
        crop(full, svg, box)
        png(svg, output)
        variants['gongu-ci-0571'].append({'key': key, 'form': form, 'label': label,
            'svg': svg.name, 'png': output.name, 'ai': gwep_source.name})

    giba_names = {
        4: ('horizontal-bilingual', 'horizontal', '국영문 가로형'),
        6: ('vertical-bilingual', 'vertical', '국영문 세로형'),
        8: ('horizontal-en', 'horizontal', '영문 가로형'),
    }
    for index, (key, form, label) in giba_names.items():
        source = OUT / f'giba-{index}.ai'
        svg = OUT / f'giba-{key}.svg'
        output = OUT / f'giba-{key}.png'
        run('inkscape', str(source), '--pdf-poppler', '--export-area-drawing',
            '--export-plain-svg', f'--export-filename={svg}')
        png(svg, output)
        variants['gongu-ci-0418'].append({'key': key, 'form': form, 'label': label,
            'svg': svg.name, 'png': output.name, 'ai': source.name})
    for key, form, label, original, box in (
        ('symbol', 'symbol', '경남투자경제진흥원 심볼', 'giba-vertical-bilingual.svg',
            (118, -5, 142, 110)),
        ('wordmark-ko', 'wordmark', '국영문 글자형', 'giba-horizontal-bilingual.svg',
            (130, 0, 525.78425, 126.69543)),
    ):
        svg = OUT / f'giba-{key}.svg'
        output = OUT / f'giba-{key}.png'
        crop(OUT / original, svg, box)
        png(svg, output)
        variants['gongu-ci-0418'].append({'key': key, 'form': form, 'label': label,
            'svg': svg.name, 'png': output.name,
            'ai': 'giba-6.ai' if key == 'symbol' else 'giba-4.ai'})

    proof = {'sources': {
        'gongu-ci-0094': {'page': 'https://www.cepa.or.kr/introduce/introduce.do?ms=157&pm=3',
            'ai_zip': 'https://www.cepa.or.kr/css/egovframework/assets/img/new/CI_AI.zip',
            'png_zip': 'https://www.cepa.or.kr/css/egovframework/assets/img/new/CI_PNG.zip',
            'files': ['CI_AI.zip', 'CI_PNG.zip']},
        'gongu-ci-0571': {'page': 'https://gwep.or.kr/theme/page/html/company/023.php',
            'ai_zip': 'https://gwep.or.kr/theme/page/html/company/%EA%B0%95%EC%9B%90%ED%8A%B9%EB%B3%84%EC%9E%90%EC%B9%98%EB%8F%84%EA%B2%BD%EC%A0%9C%EC%A7%84%ED%9D%A5%EC%9B%90%EB%A1%9C%EA%B3%A0.zip',
            'files': ['GWEP-official.zip']},
        'gongu-ci-0418': {'page': 'https://giba.or.kr/fe/inform/ci/NR_index.do',
            'ai_zip': 'https://giba.or.kr/resources/front/images/GIBA_CI.Zip',
            'files': ['giba-CI.zip']}}}
    proof['variants'] = variants
    proof['sha256'] = {p.name: sha(p) for p in sorted(OUT.iterdir())
        if p.name in {f for x in proof['sources'].values() for f in x['files']}
        or any(p.name == v[k] for group in variants.values() for v in group
            for k in ('svg', 'png', 'ai', 'official_png') if k in v)}
    (OUT / 'prepared.json').write_text(json.dumps(proof, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'status': 'ready-for-visual-review',
        'variants': {brand: len(rows) for brand, rows in variants.items()}}, ensure_ascii=False))


if __name__ == '__main__':
    main()

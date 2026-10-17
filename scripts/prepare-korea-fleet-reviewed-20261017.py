#!/usr/bin/env python3
"""Pin visually approved Korean fleet results as immutable CMS publish batches."""

import argparse
import hashlib
import json
import re
import runpy
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PREP = runpy.run_path(str(ROOT / 'scripts/prepare-gdweb-korea-bulk-20261017.py'))


def category(name, domain):
    if domain.endswith('.go.kr'):
        return '공공·기관'
    if re.search('골프|스포츠|수영|탁구|지질공원', name):
        return '스포츠'
    if re.search('의료|의학|병원|피부|헬스|바이오|방역', name):
        return '의료·바이오'
    if re.search('대학교|대학|교육|학교|학회|학술', name):
        return '교육'
    if re.search('축제|영화제|로보월드|공연|엔터|미술관|박물관', name):
        return '미디어·엔터'
    if re.search('연합회|협회|재단|위원회|상담센터|진흥원|공동모금회', name):
        return '공공·기관'
    return PREP['category'](name)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--stage', type=Path, required=True)
    parser.add_argument('--selection', type=Path, required=True)
    parser.add_argument('--release-stem', default='korea-fleet-reviewed-20261017')
    args = parser.parse_args()
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]*', args.release_stem):
        raise ValueError('Invalid release stem')
    stage = args.stage
    selection = json.loads(args.selection.read_text())
    if not selection.get('visualReview') or not selection['items']:
        raise ValueError('Visual review selection is required')
    all_rows = json.loads((stage / 'quality-candidates.json').read_text())
    selected = []
    for entry in selection['items']:
        row = all_rows[entry['index']]
        if row != entry['source'] or row['domain'] != entry['domain']:
            raise ValueError('Reviewed selection changed: ' + entry['domain'])
        kind, _, size = PREP['inspect'](row, stage)
        if kind != row['kind'] or list(size) != row['size']:
            raise ValueError('Reviewed file dimensions changed: ' + entry['domain'])
        ident = re.sub('[^a-z0-9]+', '-', row['domain'].lower()).strip('-')
        if not ident or len(ident) > 120:
            raise ValueError('Invalid domain identity')
        source = stage / row['file']
        if hashlib.sha256(source.read_bytes()).hexdigest() != row['sha256']:
            raise ValueError('Original file hash changed')
        name = entry['name'].strip()
        if len(name) < 2:
            raise ValueError('Invalid reviewed name')
        suffix = source.suffix
        item = {'id': ident, 'name': name, 'domain': row['domain'],
                'website': row['pageUrl'], 'category': category(name, row['domain']),
                'form': 'horizontal' if size[0] / size[1] >= 1.55 else 'symbol',
                'sourceFile': ident + suffix, 'sourcePage': row['pageUrl'],
                'assetUrl': row['assetUrl'], 'sha256': row['sha256'],
                'reviewedVisualIndex': entry['index'],
                'recommendedBg': PREP['recommended_background'](source)}
        if kind == 'raster':
            item.update(width=size[0], height=size[1])
        selected.append((kind, item, source))
    if len({x[1]['id'] for x in selected}) != len(selected):
        raise ValueError('Duplicate reviewed identity')
    for kind in ('svg', 'raster'):
        stem = args.release_stem + '-' + kind
        target = ROOT / 'data/collection' / (stem + '-assets')
        target.mkdir(parents=True, exist_ok=True)
        items = []
        for selected_kind, item, source in selected:
            if selected_kind != kind:
                continue
            destination = target / item['sourceFile']
            if destination.exists() and destination.read_bytes() != source.read_bytes():
                raise ValueError('Conflicting reviewed source: ' + str(destination))
            shutil.copyfile(source, destination)
            items.append(item)
        manifest = {'schemaVersion': 1, 'status': 'visually-reviewed-pending-publish',
                    'source': 'Windows fleet .kr domain discovery; first-party HTTPS; manual contact-sheet review',
                    'items': items}
        (ROOT / 'data/collection' / (stem + '.json')).write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
        print(json.dumps({'kind': kind, 'selected': len(items)}))


if __name__ == '__main__':
    main()

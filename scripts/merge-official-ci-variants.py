#!/usr/bin/env python3
"""Merge reviewed official CI files into existing brand variant manifests.

The script deliberately never replaces logo.png/logo.svg.  A downloaded official
CI is added as a labelled variant so the detail page can expose symbol, lockup,
and source ZIP files side by side.
"""
import json, re, shutil, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CLIENTS = Path('/Volumes/Untitled/brand-logos/_clients')
MANIFEST = ROOT / 'data/collection/official-ci-review-candidates.json'
ASSETS = ROOT / 'artifacts/public-ci-assets'

def slug(value: str) -> str:
    return re.sub(r'[^0-9A-Za-z가-힣]+', '-', value).strip('-').lower()

def main() -> None:
    rows = json.loads(MANIFEST.read_text()).get('candidates', [])
    merged = 0
    held = 0
    for row in rows:
        brand_id = slug(row['id'])
        target = CLIENTS / brand_id
        manifest_path = target / 'variants.json'
        if not manifest_path.exists():
            held += 1
            continue
        data = json.loads(manifest_path.read_text())
        variants = data.setdefault('variants', [])
        for raw in row.get('candidates', []):
            src = ROOT / raw
            if not src.exists() or src.suffix.lower() not in {'.png', '.svg'}:
                continue
            key = 'official-ci-' + src.stem.lower()
            if any(v.get('key') == key for v in variants):
                continue
            rel = Path('sources') / 'official-ci' / src.name
            dest = target / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dest)
            variants.append({
                'key': key,
                'form': 'unknown',
                'lang': 'unknown',
                'color': 'color',
                'label': '공식 CI 원본',
                'files': {src.suffix.lower().lstrip('.'): str(rel)},
                'provider': 'official-ci-page',
                'origin': 'collected',
                'order': 100 + len(variants),
            })
            merged += 1
        manifest_path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n')
    print(json.dumps({'merged_variants': merged, 'held_missing_brand': held}, ensure_ascii=False))

if __name__ == '__main__':
    main()

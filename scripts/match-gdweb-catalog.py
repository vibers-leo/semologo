#!/usr/bin/env python3
"""Annotate GDWEB discovery with exact matches from the public catalog snapshot."""

import hashlib
import json
import re
import unicodedata
from pathlib import Path

import requests


ROOT = Path(__file__).resolve().parents[1]
QUEUE = ROOT / 'data/collection/gdweb-logo-candidates.json'
CATALOG = 'https://kr.object.ncloudstorage.com/vibers-bucket/_clients/brands-slim.json'


def normalized(value):
    return re.sub(r'[^a-z0-9가-힣]', '', unicodedata.normalize('NFKC', value).lower())


def main():
    response = requests.get(CATALOG, timeout=45)
    response.raise_for_status()
    brands = response.json()
    names = {}
    for brand in brands:
        for value in (brand.get('id'), brand.get('name_ko'), brand.get('name_en'),
                      *(brand.get('aliases') or [])):
            if value and normalized(value):
                names.setdefault(normalized(value), set()).add(brand['id'])
    queue = json.loads(QUEUE.read_text())
    for item in queue['items']:
        item['catalog_exact_ids'] = sorted(names.get(normalized(item['listing_title']), set()))
    queue['catalog_snapshot_sha256'] = hashlib.sha256(response.content).hexdigest()
    queue['dedup_scope'] = 'Exact normalized name/alias in brands-slim snapshot only; CMS additions and project-to-brand identity still require review.'
    QUEUE.write_text(json.dumps(queue, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'candidates': len(queue['items']),
                      'exact_catalog_matches': sum(bool(item['catalog_exact_ids']) for item in queue['items']),
                      'unmatched_or_project_names': sum(not item['catalog_exact_ids'] for item in queue['items'])},
                     ensure_ascii=False))


if __name__ == '__main__':
    main()

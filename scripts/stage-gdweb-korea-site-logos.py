#!/usr/bin/env python3
"""Stage bounded first-party logo candidates from Korean GDWEB-listed sites."""

import argparse
import concurrent.futures
import hashlib
import json
import re
import runpy
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path

from lxml import html

ROOT = Path(__file__).resolve().parents[1]
NET = runpy.run_path(str(ROOT / 'scripts/stage-fleet-domain-assets.py'))
EXTENSIONS = ('.svg', '.png', '.webp')


def logo_links(source, page):
    tree = html.fromstring(page)
    found = {}
    for node in tree.xpath('//img | //source | //link'):
        context = ' '.join(str(node.get(key) or '') for key in
                           ('alt', 'class', 'id', 'title', 'rel')).lower()
        for attr in ('src', 'data-src', 'srcset', 'href'):
            raw = node.get(attr)
            if not raw:
                continue
            candidate = raw.split(',')[0].strip().split(' ')[0]
            url = urllib.parse.urljoin(source, candidate)
            path = urllib.parse.unquote(urllib.parse.urlsplit(url).path).lower()
            if not path.endswith(EXTENSIONS):
                continue
            if not NET['public_first_party'](url, urllib.parse.urlsplit(source).hostname):
                continue
            basename = Path(path).name
            if re.search(r'favicon|icon[-_]?\d|google|facebook|instagram|naver|kakao|banner|slider|badge|appstore|playstore', path):
                continue
            score = 4 * bool(re.search(r'logo|ci[-_.]|emblem|symbol|brand', basename))
            score += 3 * bool(re.search(r'logo|브랜드|로고|ci\b', context))
            score += 2 * bool(re.search(r'/common/|/header/|/layout/|/gnb/', path))
            score += int(path.endswith('.svg'))
            if score >= 3:
                found[url] = max(score, found.get(url, 0))
    return sorted(found, key=lambda url: (-found[url], url))[:3]


def scan(row, out):
    site = row.get('official_site_candidate') or ''
    parsed = urllib.parse.urlsplit(site)
    result = {'gdwebId': row['gdweb_id'], 'name': row['listing_title'],
              'discoveryPage': row['discovery_url'], 'site': site,
              'status': 'failed', 'assets': []}
    if parsed.scheme != 'https' or not parsed.hostname:
        result['status'] = 'not_https'
        return result
    try:
        if not NET['robots_allows'](parsed.hostname):
            result['status'] = 'robots_disallowed'
            return result
        _, _, page = NET['secure_get'](site, parsed.hostname, 1_500_000)
        for url in logo_links(site, page):
            try:
                final, mime, raw = NET['secure_get'](url, parsed.hostname, 500_000)
                path = urllib.parse.urlsplit(final).path.lower()
                if b'<svg' in raw[:2048].lower() and path.endswith('.svg'):
                    ext = '.svg'
                elif raw.startswith(b'\x89PNG\r\n\x1a\n'):
                    ext = '.png'
                elif raw.startswith(b'RIFF') and raw[8:12] == b'WEBP':
                    ext = '.webp'
                else:
                    continue
                digest = hashlib.sha256(raw).hexdigest()
                target = out / (digest + ext)
                if not target.exists():
                    target.write_bytes(raw)
                elif target.read_bytes() != raw:
                    raise ValueError('Digest collision')
                result['assets'].append({'url': final, 'file': target.name,
                                         'sha256': digest, 'bytes': len(raw), 'mime': mime})
            except Exception as error:
                result.setdefault('assetErrors', []).append(type(error).__name__)
        result['status'] = 'staged_review_required' if result['assets'] else 'no_downloadable_logo'
    except Exception as error:
        result['error'] = type(error).__name__ + ': ' + str(error)[:120]
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--discovery', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--workers', type=int, default=12)
    args = parser.parse_args()
    if not 1 <= args.workers <= 24:
        parser.error('workers must be 1–24')
    args.output.mkdir(parents=True, exist_ok=True)
    rows = json.loads(args.discovery.read_text())['items']
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        found = list(pool.map(lambda row: scan(row, args.output), rows))
    report = {'schemaVersion': 1, 'createdAt': datetime.now(timezone.utc).isoformat(),
              'source': str(args.discovery), 'publication': 'private stage; visual review required',
              'sitesScanned': len(rows), 'sitesWithAssets': sum(bool(x['assets']) for x in found),
              'uniqueFiles': len({a['file'] for x in found for a in x['assets']}),
              'results': found}
    (args.output / 'manifest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({key: report[key] for key in ('sitesScanned', 'sitesWithAssets', 'uniqueFiles')}))


if __name__ == '__main__':
    main()

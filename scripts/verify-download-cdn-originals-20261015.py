#!/usr/bin/env python3
"""Compare selected Downloads originals to their actual public CDN bytes."""
import concurrent.futures
import hashlib
import json
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOWNLOADS = Path('/Users/juuuno/Downloads')
OUT = ROOT / 'marketing/assets/download-original-audit-20261015'


def strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for child in value.values():
            yield from strings(child)
    elif isinstance(value, list):
        for child in value:
            yield from strings(child)


def check(item):
    name, brand, asset, expected = item
    url = 'https://logo.vibers.co.kr/_clients/' + urllib.parse.quote(brand) + '/' + urllib.parse.quote(asset, safe='/')
    try:
        request = urllib.request.Request(url, headers={'User-Agent': 'SemoLogo-source-audit/1.0'})
        raw = urllib.request.urlopen(request, timeout=15).read()
        actual = hashlib.sha256(raw).hexdigest()
        return {'name': name, 'brandId': brand, 'asset': asset, 'status': 'match' if actual == expected else 'mismatch',
                'sourceSha256': expected, 'cdnSha256': actual, 'bytes': len(raw)}
    except Exception as error:
        return {'name': name, 'brandId': brand, 'asset': asset, 'status': 'fetch_failed',
                'errorType': type(error).__name__}


def main():
    releases = [json.loads(p.read_text()) for p in (ROOT / 'src/lib').glob('reviewed*.json')]
    candidates = []
    for path in DOWNLOADS.iterdir():
        if path.is_symlink() or not path.is_file() or path.suffix.lower() not in {'.ai', '.svg', '.zip', '.png'}:
            continue
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        found = False
        for release in releases:
            for section in ('patches', 'variants'):
                for brand, record in release.get(section, {}).items():
                    for asset in strings(record):
                        if asset.startswith('sources/') and digest[:20] in asset:
                            candidates.append((path.name, brand, asset, digest))
                            found = True
                            break
                    if found:
                        break
                if found:
                    break
            if found:
                break
    # The user-supplied WikiLeaks SVG is the existing 2008 archive asset.
    wikileaks = DOWNLOADS / 'Wikileaks_logo.svg'
    if wikileaks.is_file():
        candidates.append((wikileaks.name, 'wikileaks', 'logo.svg', hashlib.sha256(wikileaks.read_bytes()).hexdigest()))
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
        results = sorted(executor.map(check, candidates), key=lambda row: row['name'])
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'cdn-original-check.json').write_text(json.dumps({'results': results}, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'checked': len(results), 'matched': sum(r['status'] == 'match' for r in results),
                      'unmatched': [r['name'] for r in results if r['status'] != 'match']}, ensure_ascii=False))


if __name__ == '__main__':
    main()

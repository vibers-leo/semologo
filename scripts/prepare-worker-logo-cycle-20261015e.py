#!/usr/bin/env python3
"""Preflight win02's live-deduped company-site SVG lane."""
import concurrent.futures
import gzip
import hashlib
import json
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'data/collection/semologo-worker-sources-cycle-20261015e.json'
TICKERS = ('ATRC', 'ANRO', 'CVSA', 'ACCO', 'EVMN', 'WOR', 'DBD', 'ALKS')


def inspect(row):
    try:
        with urlopen(Request(row['assetUrl'], headers={'User-Agent': 'Mozilla/5.0 SemoLogo-source-preflight'}), timeout=20) as response:
            assert response.status == 200
            raw = response.read(150_001)
        assert 0 < len(raw) <= 150_000 and b'<svg' in raw[:1000].lower()
        zipped = gzip.compress(raw, compresslevel=9, mtime=0)
        assert len(raw) <= 20_000 or len(zipped) <= 45_000
        row.update(expectedSha256=hashlib.sha256(raw).hexdigest(), bytes=len(raw),
                   gzipBytes=len(zipped), preflight='ok')
    except Exception as error:
        row['preflight'] = f'{type(error).__name__}: {str(error)[:120]}'
    return row


def main():
    review = {x['ticker']: x for x in json.loads((ROOT / 'data/collection/us-equity-index-logo-review-queue.json').read_text())['items']}
    discovery = {x['ticker']: x for x in json.loads((ROOT / 'data/collection/us-equity-index-logo-discovery.json').read_text())['items']}
    prior = set()
    for path in ('semologo-worker-sources-next-20261015.json', 'semologo-worker-sources-cycle-20261015b.json',
                 'semologo-worker-sources-cycle-20261015c.json',
                 'semologo-worker-sources-cycle-20261015d.json'):
        data = json.loads((ROOT / 'data/collection' / path).read_text())
        prior.update(x['assetUrl'] for x in data['sources'])
    rows = []
    for ticker in TICKERS:
        selected, origin = review[ticker], discovery[ticker]
        assert selected['format'] == 'svg' and origin['status'] != 'domain-identity-mismatch'
        domain = origin.get('official_domain') or origin.get('domain_candidate')
        filename = Path(selected['file']).name
        urls = [u for u in origin['asset_links'] if Path(urlparse(u).path).name == filename
                and urlparse(u).hostname and urlparse(u).hostname.endswith(domain) and u not in prior]
        assert len(urls) == 1, (ticker, urls)
        rows.append({'id': 'us-index-' + ticker.lower(), 'nameKo': origin['company_name'],
                     'lane': 'win-02', 'sourcePage': origin.get('official_source_url') or 'https://' + domain + '/',
                     'assetUrl': urls[0], 'origin': 'company-site-candidate',
                     'identityReviewRequired': True, 'publicationStatus': 'PENDING'})
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        checked = list(pool.map(inspect, rows))
    ready = [row for row in checked if row['preflight'] == 'ok']
    OUTPUT.write_text(json.dumps({'schemaVersion': 1, 'batch': 'semologo-cycle-20261015e',
        'policy': 'collection-only; official identity and visual review before publication',
        'maxBytes': 150_000, 'maxGzipBytes': 45_000, 'sources': ready,
        'preflightFailures': [row for row in checked if row['preflight'] != 'ok']}, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'proposed': len(rows), 'ready': len(ready), 'failed': len(rows)-len(ready)}))


if __name__ == '__main__':
    main()

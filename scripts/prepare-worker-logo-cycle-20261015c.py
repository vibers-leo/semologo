#!/usr/bin/env python3
"""Recheck oversized official SVG sources for bounded gzip transport."""
import concurrent.futures
import gzip
import hashlib
import json
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
PREVIOUS = ROOT / 'data/collection/semologo-worker-sources-cycle-20261015b.json'
OUTPUT = ROOT / 'data/collection/semologo-worker-sources-cycle-20261015c.json'


def inspect(row):
    row = {k: v for k, v in row.items() if k not in ('preflight', 'publicationStatus')}
    try:
        with urlopen(Request(row['assetUrl'], headers={'User-Agent': 'Mozilla/5.0 SemoLogo-source-preflight'}), timeout=20) as response:
            assert response.status == 200
            raw = response.read(150_001)
        assert 20_000 < len(raw) <= 150_000 and b'<svg' in raw[:1000].lower()
        packed = gzip.compress(raw, compresslevel=9, mtime=0)
        assert len(packed) <= 45_000
        row.update(expectedSha256=hashlib.sha256(raw).hexdigest(), bytes=len(raw), gzipBytes=len(packed), preflight='ok')
    except Exception as error:
        row['preflight'] = f'{type(error).__name__}: {str(error)[:120]}'
    row['publicationStatus'] = 'PENDING'
    return row


def main():
    previous = json.loads(PREVIOUS.read_text())
    candidates = previous['preflightFailures']
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        rows = list(pool.map(inspect, candidates))
    ready = [row for row in rows if row['preflight'] == 'ok']
    OUTPUT.write_text(json.dumps({'schemaVersion': 1, 'batch': 'semologo-cycle-20261015c',
        'policy': 'collection-only; visual, identity and SVG safety review before publication',
        'maxBytes': 150_000, 'maxGzipBytes': 45_000, 'sources': ready,
        'preflightFailures': [row for row in rows if row['preflight'] != 'ok']}, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'proposed': len(candidates), 'ready': len(ready), 'failed': len(rows)-len(ready)}, ensure_ascii=False))


if __name__ == '__main__':
    main()

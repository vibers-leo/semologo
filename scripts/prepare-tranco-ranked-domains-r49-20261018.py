#!/usr/bin/env python3
"""Prepare a large, ranked website cohort ahead of Common Crawl-only domains."""

import argparse
import gzip
import hashlib
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/collection/tranco-ranked-domains-20261018'
AUDIT = ROOT / 'data/collection/mass-domain-seeds-20261016.json'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database', type=Path, required=True)
    args = parser.parse_args()
    audit = json.loads(AUDIT.read_text())
    assert audit['trancoRows'] >= 999_000
    OUT.mkdir(parents=True, exist_ok=True)
    sources = [OUT / 'win-01.csv.gz', OUT / 'win-02.csv.gz']
    buffers = [bytearray(b'tranco_rank,domain\n'), bytearray(b'tranco_rank,domain\n')]
    counts = [0, 0]
    with sqlite3.connect(f'file:{args.database}?mode=ro', uri=True) as db:
        rows = db.execute('''SELECT domain,tranco_rank FROM domains
            WHERE tranco_rank>=11000 AND domain NOT LIKE '%.kr'
            ORDER BY tranco_rank''')
        for domain, rank in rows:
            owner = sum(counts) % 2
            buffers[owner].extend(f'{rank},{domain}\n'.encode())
            counts[owner] += 1
    assert 900_000 <= sum(counts) <= 1_000_000, 'Unexpected Tranco cohort'
    files = []
    for index, owner in enumerate(('win-01', 'win-02')):
        raw = gzip.compress(bytes(buffers[index]), compresslevel=9, mtime=0)
        sources[index].write_bytes(raw)
        digest = sha(raw)
        files.append({'worker': owner, 'count': counts[index],
                      'file': str(sources[index].relative_to(ROOT)),
                      'sha256': digest, 'bytes': len(raw),
                      'key': f'automation/v1/tenants/internal/projects/semologo/seeds/tranco-ranked-20261018/{owner}-{digest[:16]}.csv.gz'})
    manifest = {'schemaVersion': 1, 'createdAt': datetime.now(timezone.utc).isoformat(),
                'source': 'Tranco rank corpus already audited in mass-domain-seeds-20261016.json',
                'sourceSha256': audit['sources']['tranco']['sha256'],
                'startRank': 11000, 'excludedTld': '.kr',
                'candidateDomains': sum(counts),
                'policy': 'Website candidates only; official SVG, identity and quality review before CMS publication',
                'files': files}
    (OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'candidateDomains': sum(counts), 'files': files}, ensure_ascii=False))


if __name__ == '__main__':
    main()

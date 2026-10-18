#!/usr/bin/env python3
"""Prepare ranked .kr website candidates for the existing reviewed SVG pipeline."""

import argparse
import gzip
import hashlib
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/collection/korea-ranked-domains-20261018'
OLD = ROOT / 'data/collection/korea-wikidata-domains-20261017'
SOURCE_AUDIT = ROOT / 'data/collection/mass-domain-seeds-20261016.json'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database', type=Path, required=True)
    args = parser.parse_args()
    audit = json.loads(SOURCE_AUDIT.read_text())
    assert audit['uniqueCandidateDomains'] >= 3_000_000
    database_sha = sha(args.database.read_bytes())
    old = set()
    for owner in ('win-01', 'win-02'):
        with gzip.open(OLD / f'{owner}.csv.gz', 'rt') as source:
            next(source)
            old.update(line.strip().rsplit(',', 1)[-1] for line in source)
    with sqlite3.connect(f'file:{args.database}?mode=ro', uri=True) as db:
        rows = db.execute('''SELECT domain, tranco_rank, majestic_rank FROM domains
            WHERE domain LIKE '%.kr' AND (tranco_rank IS NOT NULL OR majestic_rank IS NOT NULL)''').fetchall()
    ranked = [(domain, tranco, majestic) for domain, tranco, majestic in rows if domain not in old]
    # Public institutions and Korean organizations first; then ranked companies.
    def priority(row):
        domain, tranco, majestic = row
        institution = domain.endswith(('.go.kr', '.or.kr', '.ac.kr', '.re.kr'))
        return (0 if institution else 1, tranco or 10**9, majestic or 10**9, domain)
    ranked.sort(key=priority)
    assert 4000 <= len(ranked) <= 6000, 'Unexpected ranked Korean cohort'
    OUT.mkdir(parents=True, exist_ok=True)
    files = []
    for index, owner in enumerate(('win-01', 'win-02')):
        items = ranked[index::2]
        csv = 'tranco_rank,majestic_rank,domain\n' + ''.join(
            f'{tranco or ""},{majestic or ""},{domain}\n' for domain, tranco, majestic in items)
        raw = gzip.compress(csv.encode(), compresslevel=9, mtime=0)
        path = OUT / f'{owner}.csv.gz'
        path.write_bytes(raw)
        digest = sha(raw)
        files.append({'worker': owner, 'count': len(items), 'file': str(path.relative_to(ROOT)),
                      'sha256': digest, 'bytes': len(raw),
                      'key': f'automation/v1/tenants/internal/projects/semologo/seeds/kr-ranked-20261018/{owner}-{digest[:16]}.csv.gz'})
    manifest = {'schemaVersion': 1, 'createdAt': datetime.now(timezone.utc).isoformat(),
                'source': 'verified local Tranco/Majestic rank corpus from mass-domain-seeds-20261016.json',
                'rankCorpusSha256': database_sha, 'excludedWikidataDomains': len(old),
                'rankedKrDomains': len(rows), 'candidateDomains': len(ranked),
                'policy': 'Candidate websites only; first-party SVG, identity and quality review before CMS publication',
                'files': files}
    (OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'candidateDomains': len(ranked), 'files': files}, ensure_ascii=False))


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Build immutable KR domain-discovery seeds from Wikidata official-site claims.

Inputs are a saved WDQS P17=Q884/P856 response plus previously scheduled
domains. These are discovery candidates, never publishable logo evidence.
"""
import argparse
import gzip
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/collection/korea-wikidata-domains-20261017'
QUERY = 'SELECT ?item ?site WHERE { ?item wdt:P17 wd:Q884; wdt:P856 ?site. MINUS { ?item wdt:P31 wd:Q5 } } LIMIT 60000'
SOURCE = 'https://query.wikidata.org/sparql'
HOST = re.compile(r'(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$')


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def priority(host):
    if host.endswith(('.go.kr', '.or.kr', '.co.kr', '.re.kr', '.ac.kr')):
        return 0
    if host.endswith(('.es.kr', '.ms.kr', '.hs.kr')):
        return 2
    return 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--wdqs', type=Path, required=True)
    parser.add_argument('--old-domains', type=Path, required=True)
    parser.add_argument('--processed-domains', type=Path, required=True)
    args = parser.parse_args()
    wdqs = json.loads(args.wdqs.read_text())
    old = set(args.old_domains.read_text().splitlines())
    processed = set(json.loads(args.processed_domains.read_text()))
    candidates = {}
    for row in wdqs['results']['bindings']:
        host = (urlsplit(row['site']['value']).hostname or '').lower().removeprefix('www.')
        qid = row['item']['value'].rsplit('/', 1)[-1]
        if HOST.fullmatch(host) and host.endswith('.kr') and re.fullmatch(r'Q[0-9]+', qid):
            candidates.setdefault(host, set()).add(qid)
    fresh = sorted(set(candidates) - old - processed, key=lambda host: (priority(host), host))
    assert len(wdqs['results']['bindings']) >= 20_000
    assert 15_000 <= len(fresh) <= 20_000, 'Unexpected fresh count: re-review source and exclusions'
    OUT.mkdir(parents=True, exist_ok=True)
    files = []
    for index, worker in enumerate(('win-01', 'win-02')):
        hosts = fresh[index::2]
        csv = 'qid,domain\n' + ''.join(
            f'{min(candidates[host], key=lambda q: int(q[1:]))},{host}\n' for host in hosts)
        raw = gzip.compress(csv.encode(), compresslevel=9, mtime=0)
        path = OUT / f'{worker}.csv.gz'
        path.write_bytes(raw)
        files.append({'worker': worker, 'count': len(hosts), 'file': str(path.relative_to(ROOT)),
                      'sha256': digest(raw), 'bytes': len(raw),
                      'key': 'automation/v1/tenants/internal/projects/semologo/seeds/'
                             f'kr-wikidata-20261017/{worker}-{digest(raw)[:16]}.csv.gz'})
    manifest = {'schemaVersion': 1, 'source': SOURCE, 'query': QUERY,
        'policy': 'P856 candidate website only; domain discovery, identity and visual review before publication',
        'retrievedAt': '2026-10-17', 'wdqsRows': len(wdqs['results']['bindings']),
        'wdqsSha256': digest(args.wdqs.read_bytes()), 'previousKrDomains': len(old),
        'previousFleetDomains': len(processed), 'candidateDomains': len(fresh), 'files': files}
    (OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'candidateDomains': len(fresh), 'files': files, 'sourceRows': manifest['wdqsRows']}, ensure_ascii=False))


if __name__ == '__main__':
    main()

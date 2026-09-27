#!/usr/bin/env python3
"""Discover official logo assets for the US equity index queue.

Only domains already marked official-domain-verified are fetched.  The script
records candidate SVG/PNG/JPG/WEBP links and provenance; it never publishes or
overwrites a brand record automatically.
"""
import json, re, sys
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
QUEUE = ROOT / 'data/collection/us-equity-index-logo-queue.json'
OUT = ROOT / 'data/collection/us-equity-index-logo-discovery.json'
EXTS = ('.svg', '.png', '.jpg', '.jpeg', '.webp')

def fetch(url):
    req = Request(url, headers={'User-Agent': 'SemoLogo-index-collector/1.0'})
    with urlopen(req, timeout=20) as r:
        return r.read().decode('utf-8', 'replace')

def discover(domain):
    base = 'https://' + domain.rstrip('/') + '/'
    html = fetch(base)
    links = []
    for raw in re.findall(r'''(?:href|src)=['"]([^'"]+)['"]''', html, re.I):
        u = urljoin(base, raw).split('#')[0]
        p = urlparse(u)
        if p.netloc.endswith(domain) and p.path.lower().endswith(EXTS) and u not in links:
            links.append(u)
    return links[:30]

def main():
    offset = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 20
    data = json.loads(QUEUE.read_text())
    q = next(x for x in data['queues'] if x['id'] == 'us-russell-2000')
    old = {}
    if OUT.exists(): old = {x['ticker']: x for x in json.loads(OUT.read_text()).get('items', [])}
    verified = [x for x in q['items'] if x.get('official_domain')][offset:offset+limit]
    for item in verified:
        if item['ticker'] in old: continue
        try:
            assets = discover(item['official_domain'])
            old[item['ticker']] = {**item, 'asset_links': assets,
                'status': 'logo-candidates-found' if assets else 'no-direct-logo-link'}
            print(item['ticker'], len(assets))
        except Exception as e:
            old[item['ticker']] = {**item, 'asset_links': [], 'status': 'domain-fetch-failed', 'error': str(e)[:200]}
            print(item['ticker'], 'ERROR', e, file=sys.stderr)
    OUT.write_text(json.dumps({'schema': 1, 'source_queue': str(QUEUE.relative_to(ROOT)),
        'policy': 'official-domain and rights review required before publication',
        'items': list(old.values())}, ensure_ascii=False, indent=2) + '\n')
    print('wrote', OUT, 'items', len(old))

if __name__ == '__main__': main()

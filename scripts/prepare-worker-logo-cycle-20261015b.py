#!/usr/bin/env python3
"""Preflight the next disjoint win01/win02 official-site SVG roster."""
import concurrent.futures
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'data/collection/semologo-worker-sources-cycle-20261015b.json'
MAX_BYTES = 20_000

# These asset names came from each institution's own CI page. Keep distinct
# forms as distinct source IDs so one institution can reach four-form coverage.
DOMESTIC = {
    '(재)우체국금융개발원': ['logo_b.svg'],
    '(재)우체국물류지원단': ['img-ci-logo02.svg', 'img-ci-logo03.svg'],
    'ECO융합섬유연구원': ['logo.svg'],
    'KDI국제정책대학원': ['logo.svg'],
    'KIAS고등과학원': ['logo.svg'],
    '강화군시설관리공단': ['gh_logo.svg'],
    '경기평택항만공사': ['logo.svg'],
    '경남투자경제진흥원': ['ko_type_ci.svg', 'main_ci.svg'],
    '경상북도안동의료원': ['logo.svg'],
    '공무원연금공단': ['symbol.svg', 'logo.svg'],
    '공정거래위원회': ['cts407_logo01.svg', 'cts407_logo02.svg'],
    '국가과학기술인력개발원': ['logo_kird.svg'],
    '국립중앙의료원': ['logo.svg'],
    '국민권익위원회': ['main-logo.svg'],
    '부산대학교병원': ['logo.svg'],
    '서울디자인재단': ['logo_black.svg'],
}
US = ('BBNX', 'ALEC', 'CLNE', 'DSGR', 'WHD', 'BZAI', 'LCUT', 'EVCM',
      'LIF', 'NABL', 'ALMS', 'SGHT', 'QCRH', 'TRAK')


def normalized(name):
    return re.sub(r'[^0-9a-z가-힣]', '', name.casefold())


def preflight(row):
    try:
        url = row['assetUrl']
        assert urlparse(url).scheme == 'https', 'non-HTTPS source'
        with urlopen(Request(url, headers={'User-Agent': 'Mozilla/5.0 SemoLogo-source-preflight'}), timeout=20) as response:
            assert response.status == 200, f'HTTP {response.status}'
            raw = response.read(MAX_BYTES + 1)
        assert 0 < len(raw) <= MAX_BYTES, f'exceeds {MAX_BYTES} bytes or empty'
        assert b'<svg' in raw[:1000].lower(), 'response is not SVG'
        row.update(expectedSha256=hashlib.sha256(raw).hexdigest(), bytes=len(raw), preflight='ok')
    except Exception as error:
        row['preflight'] = type(error).__name__ + ': ' + str(error)[:120]
    return row


def main():
    official = {x['name_ko']: x for x in json.loads((ROOT / 'data/collection/official-ci-assets-downloaded.json').read_text())['candidates']}
    review = {x['ticker']: x for x in json.loads((ROOT / 'data/collection/us-equity-index-logo-review-queue.json').read_text())['items']}
    discovery = {x['ticker']: x for x in json.loads((ROOT / 'data/collection/us-equity-index-logo-discovery.json').read_text())['items']}
    prior = json.loads((ROOT / 'data/collection/semologo-worker-sources-next-20261015.json').read_text())['sources']
    prior_urls = {row['assetUrl'] for row in prior}
    baseline = ROOT / 'marketing/assets/worker-logo-cycle-20261015b/server-roster-before.json'
    assert baseline.is_file(), 'Pinned pre-cycle roster is required for repeatable duplicate prevention'
    prior_urls.update(row['assetUrl'] for row in json.loads(baseline.read_text())['sources'])
    catalog = json.loads((ROOT / 'marketing/assets/collection-coverage/catalog.json').read_text())
    names = {}
    for brand in catalog:
        if brand.get('hidden') or brand.get('variant_of'):
            continue
        for name in (brand.get('name_ko', ''), brand.get('name_en', '')):
            if normalized(name):
                names.setdefault(normalized(name), set()).add(brand['id'])
    rows = []
    for name, filenames in DOMESTIC.items():
        source = official[name]
        for filename in filenames:
            urls = [u for u in source['asset_links'] if Path(urlparse(u).path).name == filename and urlparse(u).scheme == 'https']
            assert len(urls) == 1, (name, filename, urls)
            asset = urls[0]
            if asset in prior_urls:
                continue
            rows.append({'id': 'ko-official-' + normalized(name) + '-' + filename.removesuffix('.svg'),
                         'nameKo': name, 'lane': 'win-01', 'sourcePage': source['official_source_page'],
                         'assetUrl': asset, 'origin': 'official-institution-candidate',
                         'publicationStatus': 'PENDING'})
    for ticker in US:
        candidate, source = review[ticker], discovery[ticker]
        assert candidate['format'] == 'svg' and source['status'] != 'domain-identity-mismatch'
        name = Path(candidate['file']).name
        urls = [u for u in source['asset_links'] if Path(urlparse(u).path).name == name]
        assert len(urls) == 1, (ticker, urls)
        asset = urls[0]
        if asset in prior_urls:
            continue
        domain = source.get('official_domain') or source.get('domain_candidate')
        assert domain and urlparse(asset).hostname.endswith(domain)
        rows.append({'id': 'us-index-' + ticker.lower(), 'nameKo': source['company_name'],
                     'lane': 'win-02', 'sourcePage': source.get('official_source_url') or 'https://' + domain + '/',
                     'assetUrl': asset, 'origin': 'company-site-candidate',
                     'identityReviewRequired': True, 'publicationStatus': 'PENDING'})
    assert len({row['id'] for row in rows}) == len(rows)
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        checked = list(pool.map(preflight, rows))
    for row in checked:
        matches = sorted(names.get(normalized(row['nameKo']), ()))
        row['catalogExactNameMatches'] = matches
        row['collectionPurpose'] = 'existing-content-enhancement' if matches else 'new-content-candidate'
    ready = [row for row in checked if row['preflight'] == 'ok']
    OUTPUT.write_text(json.dumps({'schemaVersion': 1, 'batch': 'semologo-cycle-20261015b',
        'policy': 'collection-only; human visual and identity review before publication',
        'maxBytes': MAX_BYTES, 'sources': ready, 'preflightFailures': [row for row in checked if row['preflight'] != 'ok']},
        ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'proposed': len(rows), 'ready': len(ready),
        'byLane': {lane: sum(row['lane'] == lane for row in ready) for lane in ('win-01', 'win-02')},
        'newCandidates': sum(row['collectionPurpose'] == 'new-content-candidate' for row in ready),
        'failures': len(rows) - len(ready)}, ensure_ascii=False))


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Prepare bounded, reviewed source IDs for the next two-PC logo intake.

This only builds a private collection roster. Publication still requires
visual, company-identity and catalog-duplication review.
"""
import concurrent.futures
import hashlib
import json
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'data/collection/semologo-worker-sources-next-20261015.json'
MAX_BYTES = 20_000

# Official institution pages: asset URLs are chosen from the previously
# discovered official-site list, not from social icons or partner badges.
KOREAN = {
    '강원특별자치도 교육청': 'https://gwe.go.kr/resource/www/main/redesign/assets/images/common/logo-mark.svg?v=2',
    '게임물관리위원회': 'https://www.grac.or.kr/resource/images/main/renew/common/img_logo.svg',
    '경상북도개발공사': 'https://www.gbdc.co.kr/templates/cms/common/img/national_symbol.svg',
    '국립현대미술관': 'https://www.mmca.go.kr/asset/images/common/bg_logo_full.svg',
    '기장군도시관리공단': 'https://www.gijangcmc.or.kr/cmc/share/img/sub/intro/ci_color.svg',
    '기후에너지환경부': 'https://mcee.go.kr/images/main_202509/logo.svg',
    '사천시복지청소년재단': 'https://youthsacheon.com/images/common/sc_logo.svg',
}

# The index ticker only locates the collected source. It is never treated as
# proof that a guessed domain belongs to that listed company.
US_TICKERS = (
    'SD', 'TWST', 'OSCR', 'NTGR', 'FC', 'STRA', 'MAC',
    'SWIM', 'DAVE', 'DXPE', 'MTW', 'GDOT', 'RPD', 'CVRX',
    'PLUG', 'SCHL', 'VAL', 'NEO', 'RGNX', 'KLTR',
)
WIN01_HEALTHCARE = {'TWST', 'OSCR', 'CVRX', 'NEO', 'RGNX'}
REJECTED_AFTER_COLLECTION = {'VAL'}


def fetch(row):
    try:
        url = row['assetUrl']
        assert urlparse(url).scheme == 'https'
        with urlopen(Request(url, headers={'User-Agent': 'Mozilla/5.0 SemoLogo-source-preflight'}), timeout=18) as response:
            assert response.status == 200
            raw = response.read(MAX_BYTES + 1)
        assert 0 < len(raw) <= MAX_BYTES
        assert b'<svg' in raw[:1000].lower()
        row['expectedSha256'] = hashlib.sha256(raw).hexdigest()
        row['bytes'] = len(raw)
        row['preflight'] = 'ok'
    except Exception as exc:
        row['preflight'] = type(exc).__name__
    return row


def main():
    domestic = {x['name_ko']: x for x in json.loads((ROOT / 'data/collection/official-ci-assets-downloaded.json').read_text())['candidates']}
    review = {x['ticker']: x for x in json.loads((ROOT / 'data/collection/us-equity-index-logo-review-queue.json').read_text())['items']}
    discovery = {x['ticker']: x for x in json.loads((ROOT / 'data/collection/us-equity-index-logo-discovery.json').read_text())['items']}
    rows = []
    for name, url in KOREAN.items():
        source = domestic[name]
        assert url in source['asset_links']
        rows.append({'id': 'ko-official-' + name, 'nameKo': name, 'lane': 'win-01',
                     'sourcePage': source['official_source_page'], 'assetUrl': url,
                     'origin': 'official-institution-candidate', 'publicationStatus': 'PENDING'})
    for ticker in US_TICKERS:
        candidate, source = review[ticker], discovery[ticker]
        assert candidate['format'] == 'svg' and candidate['bytes'] > 0
        assert source['status'] != 'domain-identity-mismatch' or ticker in REJECTED_AFTER_COLLECTION
        name = Path(candidate['file']).name
        asset = next((url for url in source['asset_links'] if Path(urlparse(url).path).name == name), None)
        assert asset and urlparse(asset).hostname.endswith(source.get('official_domain') or source.get('domain_candidate'))
        rows.append({'id': 'us-index-' + ticker.lower(), 'nameKo': source['company_name'],
                     'lane': 'win-01' if ticker in WIN01_HEALTHCARE else 'win-02',
                     'sourcePage': source.get('official_source_url') or 'https://' + urlparse(asset).hostname + '/',
                     'assetUrl': asset, 'origin': 'company-site-candidate',
                     'publicationStatus': 'PENDING', 'identityReviewRequired': True})
        if ticker in REJECTED_AFTER_COLLECTION:
            rows[-1]['reviewDecision'] = 'reject-ticker-domain-identity'
            rows[-1]['reviewReason'] = 'VAL is Valaris Limited (valaris.com), but val.com belongs to another site.'
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        checked = list(pool.map(fetch, rows))
    OUTPUT.write_text(json.dumps({'schemaVersion': 1, 'batch': 'semologo-expansion-20261015',
                                  'policy': 'collection-only; no automatic public CMS write',
                                  'maxBytes': MAX_BYTES, 'sources': checked}, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'total': len(checked), 'ready': sum(x['preflight'] == 'ok' for x in checked),
                      'byLane': {lane: sum(x['lane'] == lane and x['preflight'] == 'ok' for x in checked)
                                 for lane in ('win-01', 'win-02')}, 'output': str(OUTPUT)}, ensure_ascii=False))


if __name__ == '__main__':
    main()

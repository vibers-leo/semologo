#!/usr/bin/env python3
"""Add fresh, official company SVG candidates to the hourly Windows handoff."""
import concurrent.futures
import hashlib
import html
import io
import json
import subprocess
import zipfile
from pathlib import Path
from urllib.parse import urlparse

import cairosvg
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OLD = ROOT / 'marketing/assets/worker-logo-hourly-backlog-20261016/vibers-fleet-workers-r27.zip'
DISCOVERY = ROOT / 'data/collection/us-equity-index-logo-discovery.json'
OUT = ROOT / 'marketing/assets/worker-logo-hourly-new-20261016'
# Each path is the company's own logo asset, selected from its discovered site.
# This is a collection queue; identity and appearance still require review before CMS publication.
SELECTION = {
    'PCVX': 'Vaxcyte-Logo.svg',
    'FSS': 'logo-Fedsig.svg',
    'LNTH': 'Lantheus_Logo_R_RGB.svg',
    'JBTM': 'jbt-marel-logo.svg',
    'CORZ': 'Core-Scientific-Logo.svg',
    'CWST': '/assets/icons/logo.svg',
    'NOVT': 'novanta-logo.svg',
    'GVA': '/public/images/logo.svg',
    'HCC': 'wmc-logo.svg',
    # The discovered insw.com asset renders Infrastructure NSW, not International Seaways.
    'TCBI': 'texas-capital-logo.svg',
    'TPC': 'TPC_logo.svg',
    'OPLN': '/images/logo.svg',
    'KTB': 'nav-kontoor-logo-color.svg',
    'RXO': '/RXO.svg',
    'DNLI': 'denali-logo.svg',
    'KNTK': 'kinetik_logo.svg',
    'CXT': 'logo--crane-nxt.svg',
    'BANF': '/Content/Images/logo.svg',
    'PRLB': 'Protolabs-logo-tagline.svg',
    'ADMA': 'ADMA%20logo.svg',
    'GRBK': 'greenbrick-partners-logo.svg',
    'SRPT': '/sarepta_corporate/logo.svg',
    'NNI': 'logo-nelnet-color.svg',
    'PAY': 'paymentus-logo.svg',
}


def preflight(row):
    source_id, name, page, asset = row
    try:
        raw = subprocess.run(['curl', '--fail', '--silent', '--show-error', '--location',
                              '--max-redirs', '2', '--max-time', '20', '--max-filesize', '150000',
                              '--proto', '=https', '--proto-redir', '=https',
                              '--user-agent', 'Mozilla/5.0 SemoLogo-source-preflight', asset],
                             check=True, capture_output=True).stdout
        assert 0 < len(raw) <= 150_000 and b'<svg' in raw[:1000].lower()
        assert b'<script' not in raw.lower() and b'<image' not in raw.lower()
        png = cairosvg.svg2png(bytestring=raw, output_width=500)
        with Image.open(io.BytesIO(png)) as image:
            assert image.width >= 300 and image.height >= 30
            assert image.convert('RGBA').getchannel('A').getbbox()
        return {'id': source_id, 'nameKo': name, 'sourcePage': page, 'assetUrl': asset,
                'expectedSha256': hashlib.sha256(raw).hexdigest()}
    except Exception as error:
        return {'id': source_id, 'error': type(error).__name__ + ': ' + str(error)[:150]}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(OLD) as archive:
        files = {name: archive.read(name) for name in archive.namelist() if name != 'bundle-manifest.json'}
        prior = json.loads(archive.read('bundle-manifest.json'))
    assert all(hashlib.sha256(value).hexdigest() == prior['files'][name] for name, value in files.items())
    assert b'20261016-semologo-hourly-r27' in files['runtime/version.mjs']
    roster = json.loads(files['runtime/semologo-sources.json'])
    assert len(roster['sources']) == 138
    existing_ids = {x['id'] for x in roster['sources']}
    existing_urls = {x['assetUrl'] for x in roster['sources']}
    discovered = {x['ticker']: x for x in json.loads(DISCOVERY.read_text())['items']}
    rows = []
    for ticker, marker in SELECTION.items():
        source = discovered[ticker]
        assert source['status'] != 'domain-identity-mismatch'
        domain = source.get('official_domain') or source.get('domain_candidate')
        assert domain
        matches = [html.unescape(url) for url in source['asset_links']
                   if marker in html.unescape(url)
                   and urlparse(html.unescape(url)).hostname
                   and urlparse(html.unescape(url)).hostname.removeprefix('www.').endswith(domain)]
        assert len(matches) == 1, (ticker, matches)
        asset = matches[0]
        source_id = 'us-hourly-' + ticker.lower()
        assert source_id not in existing_ids and asset not in existing_urls
        rows.append((source_id, source['company_name'], source.get('official_source_url') or 'https://' + domain + '/', asset))
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
        results = list(executor.map(preflight, rows))
    additions = [row for row in results if 'expectedSha256' in row]
    assert len(additions) >= 12, f'Only {len(additions)} valid sources; do not publish roster'
    roster['sources'].extend(additions)
    files['runtime/semologo-sources.json'] = (json.dumps(roster, ensure_ascii=False, indent=2) + '\n').encode()
    files['runtime/version.mjs'] = b"export const runtimeVersion='20261016-semologo-hourly-r28';\n"
    manifest = {'schemaVersion': 1, 'workers': ['win-01', 'win-02'], 'containsCredentials': False,
                'files': {name: hashlib.sha256(value).hexdigest() for name, value in files.items()}}
    package = OUT / 'vibers-fleet-workers-r28.zip'
    with zipfile.ZipFile(package, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for name, value in files.items():
            archive.writestr(name, value)
        archive.writestr('bundle-manifest.json', json.dumps(manifest, indent=2) + '\n')
    (OUT / 'semologo-sources.json').write_bytes(files['runtime/semologo-sources.json'])
    (OUT / 'roster-additions.json').write_text(json.dumps(additions, ensure_ascii=False, indent=2) + '\n')
    (OUT / 'preflight-failures.json').write_text(json.dumps([row for row in results if 'error' in row], ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'proposed': len(rows), 'ready': len(additions), 'failed': len(rows)-len(additions),
                      'rosterCount': len(roster['sources']), 'packageSha256': hashlib.sha256(package.read_bytes()).hexdigest(),
                      'rosterSha256': hashlib.sha256(files['runtime/semologo-sources.json']).hexdigest()}, ensure_ascii=False))


if __name__ == '__main__':
    main()

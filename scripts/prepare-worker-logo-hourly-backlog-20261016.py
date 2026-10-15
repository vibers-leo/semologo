#!/usr/bin/env python3
"""Preflight reviewed official-site logo forms and extend the r26 worker package."""
import concurrent.futures
import hashlib
import json
import subprocess
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OLD = ROOT / 'marketing/assets/worker-logo-hourly-20261016/vibers-fleet-workers-r26.zip'
OUT = ROOT / 'marketing/assets/worker-logo-hourly-backlog-20261016'
# Names and path endings come from the existing official CI discovery ledger.
SELECTION = [
    ('(재)사천시미생물발효재단', 'emblem.svg'),
    ('(재)우체국물류지원단', 'logo-on.svg'),
    ('(재)우체국물류지원단', 'img-ci-logo03.svg'),
    ('(재)우체국시설관리단', 'logo_footer.svg'),
    ('(재)경주문화재단', 'logo2.svg'),
    ('(재)경주스마트미디어센터', '/images/common/logo.svg'),
    ('(주)블랙밸리컨트리클럽', '/images/logo.svg'),
    ('KDI국제정책대학원', 'logo-v2.svg'),
    ('과학기술정책연구원', 'Logo_STEPI.svg'),
    ('구리도시공사', '/images/common/logo.svg'),
    ('구미문화재단', 'ci-symbol.svg'),
    ('국토연구원', '/main/img/layout/logo.svg'),
    ('기술보증기금', 'kibo-logo.svg'),
    ('대구농수산물유통관리공사', 'logo_b.svg'),
    ('대구동구문화재단', 'ft_logo_dgcf.svg'),
    ('대전연구원', 'ci_logo02.svg'),
    ('대전연구원', 'ci_logo03.svg'),
    ('대한체육회', '/static/sports/svg/logo.svg'),
    ('방송미디어통신위원회', '/main2025/images/logo.svg'),
    ('부산여성가족과 평생교육진흥원', '/Common/logo.svg'),
    ('서민금융진흥원', 'img_header_logo.svg'),
    ('서울디자인재단', 'logo_mo_black.svg'),
    ('(재)우체국금융개발원', 'logo_w.svg'),
    ('강원특별자치도 교육청', 'logo-text.svg?v=2'),
    ('공정거래위원회', 'cts407_logo03.svg'),
    ('강화군시설관리공단', 'ico-footer-logo.svg'),
    ('경상북도안동의료원', 'img_symbol_01.svg'),
    ('국가과학기술인력개발원', 'logoWhite.svg'),
    ('경남투자경제진흥원', 'img_ci_logo.svg'),
]


def preflight(row):
    name, page, asset = row
    try:
        raw = subprocess.run(['curl', '--fail', '--silent', '--show-error', '--location', '--max-redirs', '2',
                              '--max-time', '20', '--max-filesize', '150000', '--proto', '=https',
                              '--proto-redir', '=https', '--user-agent', 'Mozilla/5.0 SemoLogo-source-preflight',
                              asset], capture_output=True, check=True).stdout
        assert 0 < len(raw) <= 150000 and b'<svg' in raw[:1000].lower()
        return {'id': 'ko-hourly-' + hashlib.sha256(asset.encode()).hexdigest()[:12],
                'nameKo': name, 'sourcePage': page, 'assetUrl': asset,
                'expectedSha256': hashlib.sha256(raw).hexdigest()}
    except (subprocess.CalledProcessError, AssertionError):
        return None


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(OLD) as archive:
        files = {name: archive.read(name) for name in archive.namelist() if name != 'bundle-manifest.json'}
        prior = json.loads(archive.read('bundle-manifest.json'))
    assert all(hashlib.sha256(value).hexdigest() == prior['files'][name] for name, value in files.items())
    assert b'20261016-semologo-hourly-r26' in files['runtime/version.mjs']
    roster = json.loads(files['runtime/semologo-sources.json'])
    assert len(roster['sources']) == 111
    candidates = {x['name_ko']: x for x in json.loads((ROOT / 'data/collection/official-ci-assets-downloaded.json').read_text())['candidates']}
    existing = {x['assetUrl'] for x in roster['sources']}
    rows = []
    for name, ending in SELECTION:
        candidate = candidates[name]
        matches = [url for url in candidate['asset_links'] if url.startswith('https://') and url.endswith(ending)]
        assert len(matches) == 1, (name, ending, matches)
        if matches[0] not in existing:
            rows.append((name, candidate['official_source_page'], matches[0]))
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
        results = list(executor.map(preflight, rows))
    additions = [r for r in results if r]
    assert len(additions) >= 12, f'Only {len(additions)} valid sources; do not publish this roster'
    roster['sources'].extend(additions)
    files['runtime/semologo-sources.json'] = (json.dumps(roster, ensure_ascii=False, indent=2) + '\n').encode()
    files['runtime/version.mjs'] = b"export const runtimeVersion='20261016-semologo-hourly-r27';\n"
    manifest = {'schemaVersion': 1, 'workers': ['win-01', 'win-02'], 'containsCredentials': False,
                'files': {name: hashlib.sha256(value).hexdigest() for name, value in files.items()}}
    output = OUT / 'vibers-fleet-workers-r27.zip'
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for name, value in files.items():
            archive.writestr(name, value)
        archive.writestr('bundle-manifest.json', json.dumps(manifest, indent=2) + '\n')
    (OUT / 'semologo-sources.json').write_bytes(files['runtime/semologo-sources.json'])
    (OUT / 'roster-additions.json').write_text(json.dumps(additions, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'preflighted': len(rows), 'ready': len(additions), 'failed': len(rows) - len(additions),
                      'rosterCount': len(roster['sources']), 'rosterSha256': hashlib.sha256(files['runtime/semologo-sources.json']).hexdigest(),
                      'packageSha256': hashlib.sha256(output.read_bytes()).hexdigest()}, ensure_ascii=False))


if __name__ == '__main__':
    main()

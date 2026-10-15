#!/usr/bin/env python3
"""Extend the current credential-free r25 handoff with four preflighted official SVGs."""
import hashlib
import json
import subprocess
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OLD = ROOT / 'marketing/assets/worker-logo-cycle-20261015e/vibers-fleet-workers-r25.zip'
OUT = ROOT / 'marketing/assets/worker-logo-hourly-20261016'
SOURCES = [
    ('us-index-umbf', 'UMB Financial', 'https://www.umb.com/', 'https://umb.com/sites/default/files/UMB-2x-Logo-Digital-BlueCyan-RGB.svg'),
    ('us-index-btsg', 'BrightSpring Health Services', 'https://www.brightspringhealth.com/', 'https://www.brightspringhealth.com/wp-content/uploads/2024/10/logo-brightspring4-h.svg'),
    ('us-index-krys', 'Krystal Biotech', 'https://www.krystalbio.com/', 'https://www.krystalbio.com/wp-content/uploads/2023/10/KRYS-logo-black.svg'),
    ('us-index-gkos', 'Glaukos', 'https://www.glaukos.com/', 'https://www.glaukos.com/wp-content/themes/pint-glaukos/assets/images/glaukos-logo-green.svg'),
]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(OLD) as archive:
        files = {name: archive.read(name) for name in archive.namelist() if name != 'bundle-manifest.json'}
        previous = json.loads(archive.read('bundle-manifest.json'))
    assert all(hashlib.sha256(value).hexdigest() == previous['files'][name] for name, value in files.items())
    assert b'20261016-semologo-cycle-r25' in files['runtime/version.mjs']
    roster = json.loads(files['runtime/semologo-sources.json'])
    assert len(roster['sources']) == 107
    known = {source['id'] for source in roster['sources']}
    additions = []
    for source_id, name, page, asset in SOURCES:
        assert source_id not in known
        fetched = subprocess.run(['curl', '--fail', '--silent', '--show-error', '--location', '--max-redirs', '2',
                                  '--max-time', '20', '--max-filesize', '150000', '--proto', '=https',
                                  '--proto-redir', '=https', '--user-agent', 'Mozilla/5.0 SemoLogo-source-preflight',
                                  asset], capture_output=True, check=True).stdout
        assert 0 < len(fetched) <= 150000 and b'<svg' in fetched[:1000].lower()
        addition = {'id': source_id, 'nameKo': name, 'sourcePage': page, 'assetUrl': asset,
                    'expectedSha256': hashlib.sha256(fetched).hexdigest()}
        additions.append(addition)
    roster['sources'].extend(additions)
    files['runtime/semologo-sources.json'] = (json.dumps(roster, ensure_ascii=False, indent=2) + '\n').encode()
    files['runtime/version.mjs'] = b"export const runtimeVersion='20261016-semologo-hourly-r26';\n"
    manifest = {'schemaVersion': 1, 'workers': ['win-01', 'win-02'], 'containsCredentials': False,
                'files': {name: hashlib.sha256(value).hexdigest() for name, value in files.items()}}
    output = OUT / 'vibers-fleet-workers-r26.zip'
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for name, value in files.items():
            archive.writestr(name, value)
        archive.writestr('bundle-manifest.json', json.dumps(manifest, indent=2) + '\n')
    (OUT / 'semologo-sources.json').write_bytes(files['runtime/semologo-sources.json'])
    (OUT / 'roster-additions.json').write_text(json.dumps(additions, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'package': str(output), 'packageSha256': hashlib.sha256(output.read_bytes()).hexdigest(),
                      'rosterSha256': hashlib.sha256(files['runtime/semologo-sources.json']).hexdigest(),
                      'rosterCount': len(roster['sources'])}, ensure_ascii=False))


if __name__ == '__main__':
    main()

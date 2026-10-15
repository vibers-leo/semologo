#!/usr/bin/env python3
"""Overlay the next SemoLogo source roster on the currently published fleet ZIP.

The base ZIP is retrieved from the live fleet's credential-free package. This
preserves newer, unrelated worker code while changing only the source roster.
"""
import base64
import hashlib
import io
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'marketing/assets/worker-logo-expansion-20261015'
BEFORE = OUT / 'current-before.json'
PLAN = ROOT / 'data/collection/semologo-worker-sources-next-20261015.json'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def main():
    envelope = json.loads(BEFORE.read_text())
    raw_zip = base64.b64decode(envelope['bundleBase64'], validate=True)
    assert sha(raw_zip) == envelope['sha256'] and len(raw_zip) == envelope['size']
    with ZipFile(io.BytesIO(raw_zip)) as z:
        files = {name: z.read(name) for name in z.namelist() if name != 'bundle-manifest.json'}
        old_manifest = json.loads(z.read('bundle-manifest.json'))
    assert set(files) == set(old_manifest['files']) and old_manifest['containsCredentials'] is False
    assert all(sha(value) == old_manifest['files'][name] for name, value in files.items())
    current = json.loads(files['runtime/semologo-sources.json'])
    planned = json.loads(PLAN.read_text())
    additions = []
    known = {row['id'] for row in current['sources']}
    for row in planned['sources']:
        assert row['preflight'] == 'ok' and row['publicationStatus'] == 'PENDING'
        assert row['id'] not in known and row['bytes'] <= planned['maxBytes']
        known.add(row['id'])
        additions.append({key: row[key] for key in ('id', 'nameKo', 'sourcePage', 'assetUrl', 'expectedSha256')})
    current['sources'].extend(additions)
    roster = (json.dumps(current, ensure_ascii=False, indent=2) + '\n').encode()
    files['runtime/semologo-sources.json'] = roster
    assert sha(files['runtime/semologo-collector.mjs']) == '1630367482c16b6ebe37fcea6b845b53b812b57be7666f0152d17bcba7f0c224'
    files['runtime/semologo-collector.mjs'] = Path('/Users/juuuno/Desktop/macminim4/ops/worker-fleet/runtime/semologo-collector.mjs').read_bytes()
    files['runtime/version.mjs'] = b"export const runtimeVersion='20261015-semologo-expanded-r21';\n"
    manifest = dict(old_manifest)
    manifest['files'] = {name: sha(value) for name, value in files.items()}
    destination = OUT / 'vibers-fleet-workers-semologo-expanded.zip'
    with ZipFile(destination, 'w',compression=ZIP_DEFLATED) as z:
        for name, value in files.items():
            z.writestr(name, value)
        z.writestr('bundle-manifest.json', json.dumps(manifest, indent=2) + '\n')
    (OUT / 'semologo-sources.json').write_bytes(roster)
    (OUT / 'build-record.json').write_text(json.dumps({
        'basePackageSha256': envelope['sha256'], 'newPackageSha256': sha(destination.read_bytes()),
        'newRosterSha256': sha(roster), 'oldSources': len(current['sources']) - len(additions),
        'newSources': len(additions), 'totalSources': len(current['sources']),
        'preservedPackageFiles': len(files) - 1,
    }, indent=2) + '\n')
    print((OUT / 'build-record.json').read_text())


if __name__ == '__main__':
    main()

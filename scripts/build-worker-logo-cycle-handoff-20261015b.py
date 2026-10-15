#!/usr/bin/env python3
"""Append a reviewed source roster to the live credential-free fleet package."""
import base64
import hashlib
import io
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'marketing/assets/worker-logo-cycle-20261015b'
PLAN = ROOT / 'data/collection/semologo-worker-sources-cycle-20261015b.json'
VERSION = '20261015-semologo-cycle-r22'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def main():
    envelope = json.loads((OUT / 'current-before.json').read_text())
    raw_zip = base64.b64decode(envelope['bundleBase64'], validate=True)
    assert sha(raw_zip) == envelope['sha256'] and len(raw_zip) == envelope['size']
    with ZipFile(io.BytesIO(raw_zip)) as archive:
        files = {name: archive.read(name) for name in archive.namelist() if name != 'bundle-manifest.json'}
        old_manifest = json.loads(archive.read('bundle-manifest.json'))
    assert set(files) == set(old_manifest['files']) and old_manifest['containsCredentials'] is False
    assert all(sha(raw) == old_manifest['files'][name] for name, raw in files.items())
    old_roster = files['runtime/semologo-sources.json']
    server_roster = (OUT / 'server-roster-before.json').read_bytes()
    assert old_roster == server_roster, 'Windows package and NCP roster diverged'
    roster = json.loads(old_roster)
    planned = json.loads(PLAN.read_text())
    known = {row['id'] for row in roster['sources']}
    urls = {row['assetUrl'] for row in roster['sources']}
    additions = []
    for row in planned['sources']:
        assert row['preflight'] == 'ok' and row['publicationStatus'] == 'PENDING'
        assert row['id'] not in known and row['assetUrl'] not in urls and row['bytes'] <= planned['maxBytes']
        known.add(row['id'])
        urls.add(row['assetUrl'])
        additions.append({key: row[key] for key in ('id', 'nameKo', 'sourcePage', 'assetUrl', 'expectedSha256')})
    assert len(additions) == len(planned['sources']) and 10 <= len(additions) <= 50
    roster['sources'].extend(additions)
    new_roster = (json.dumps(roster, ensure_ascii=False, indent=2) + '\n').encode()
    files['runtime/semologo-sources.json'] = new_roster
    files['runtime/version.mjs'] = f"export const runtimeVersion='{VERSION}';\n".encode()
    manifest = dict(old_manifest)
    manifest['files'] = {name: sha(raw) for name, raw in files.items()}
    destination = OUT / 'vibers-fleet-workers-semologo-cycle-r22.zip'
    with ZipFile(destination, 'w', compression=ZIP_DEFLATED) as archive:
        for name, raw in files.items():
            archive.writestr(name, raw)
        archive.writestr('bundle-manifest.json', json.dumps(manifest, indent=2) + '\n')
    (OUT / 'semologo-sources.json').write_bytes(new_roster)
    record = {'basePackageSha256': envelope['sha256'], 'newPackageSha256': sha(destination.read_bytes()),
              'oldRosterSha256': sha(old_roster), 'newRosterSha256': sha(new_roster),
              'oldSources': len(roster['sources']) - len(additions), 'addedSources': len(additions),
              'totalSources': len(roster['sources']), 'runtimeVersion': VERSION,
              'preservedPackageFiles': len(files) - 2}
    (OUT / 'build-record.json').write_text(json.dumps(record, indent=2) + '\n')
    print(json.dumps(record))


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Hourly bounded asset recheck and first-party enrichment review queue.

This never publishes artwork. Identity and visual approval stay explicit.
"""
import fcntl
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = Path('/Volumes/HDD-1TB/semologo-migration/bulk-staging/enrichment-audit-20261017')
STAGING = Path('/Volumes/HDD-1TB/semologo-migration/bulk-staging')


def run(*args):
    result = subprocess.run([sys.executable, *map(str, args)], cwd=ROOT,
                            text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError('Maintenance step failed: ' + result.stderr.strip()[-500:])
    return result.stdout.strip()


def main():
    if not (PRIVATE / 'catalog-sweep.json').is_file() or not STAGING.is_dir():
        raise RuntimeError('External HDD catalog is not mounted')
    lock = PRIVATE / 'maintenance.lock'
    with lock.open('w') as held:
        try:
            fcntl.flock(held, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print(json.dumps({'status': 'already_running'}))
            return
        sweep = run(ROOT / 'scripts/sweep-logo-asset-paths.py', '--catalog',
                    PRIVATE / 'catalog-sweep.json', '--output', PRIVATE / 'asset-sweep-hourly.jsonl',
                    '--cursor', PRIVATE / 'asset-sweep-hourly.cursor.json', '--limit', '1000',
                    '--workers', '8', '--live-paths')
        sweep_result = json.loads(sweep)
        if sweep_result.get('status') == 'complete':
            refreshed = run(ROOT / 'scripts/snapshot-current-logo-catalog.py',
                            '--catalog', PRIVATE / 'catalog.json',
                            '--sweep', PRIVATE / 'catalog-sweep.json')
            (PRIVATE / 'asset-sweep-hourly.cursor.json').unlink(missing_ok=True)
            sweep_result['nextCatalog'] = json.loads(refreshed)['catalog']
        manifests = sorted(STAGING.glob('korea-fleet*/manifest.json'))
        if not manifests:
            raise RuntimeError('No staged first-party fleet manifest')
        command = [ROOT / 'scripts/build-fleet-enrichment-queue.py', '--catalog',
                   PRIVATE / 'catalog.json', '--output', PRIVATE / 'report-hourly.json',
                   '--asset-sweep', PRIVATE / 'asset-sweep-hourly.jsonl']
        for source in manifests:
            command += ['--manifest', source]
        queue = run(*command)
        print(json.dumps({'at': datetime.now(timezone.utc).isoformat(),
                          'sweep': sweep_result, 'queue': json.loads(queue)}, ensure_ascii=False))


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Queue the compressed official-SVG batch only after win01 has the new package."""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'marketing/assets/worker-logo-cycle-20261015c'
PLAN = ROOT / 'data/collection/semologo-worker-sources-cycle-20261015c.json'
FLEET = Path('/Users/juuuno/Desktop/macminim4/ops/worker-fleet/deployment')
VERSION = '20261015-semologo-gzip-r23'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--limit', type=int, default=0)
    args = parser.parse_args()
    rows = json.loads(subprocess.run(['python3', str(FLEET / 'status-via-ssh.py'), 'all'],
                                    capture_output=True, text=True, check=True).stdout)
    checks = [r for r in rows if r['request_key'].startswith('semologo-gzip-r23-ready-win-01-')
              and r['status'] == 'succeeded' and r['result']['result']['runtimeVersion'] == VERSION]
    assert checks, f'win-01 has not reported {VERSION}'
    submitted = {r['input']['sourceId'] for r in rows if r['project'] == 'semologo'
                 and r['kind'] == 'semologo-logo-collect'
                 and r['request_key'].startswith('semologo-cycle-20261015c-')}
    plan = json.loads(PLAN.read_text())
    sources = [r for r in plan['sources'] if r['preflight'] == 'ok' and r['id'] not in submitted]
    if args.limit > 0:
        sources = sources[:args.limit]
    commit = subprocess.check_output(['git', '-C', str(ROOT), 'rev-parse', 'HEAD'], text=True).strip()
    receipts = []
    for row in sources:
        suffix = hashlib.sha256(row['id'].encode()).hexdigest()[:12]
        request = {'project': 'semologo', 'kind': 'semologo-logo-collect',
                   'requestKey': f'semologo-cycle-20261015c-win01-{suffix}',
                   'commit': commit, 'input': {'sourceId': row['id']}, 'workerId': 'win-01'}
        if args.dry_run:
            receipts.append({'sourceId': row['id'], 'status': 'dry-run'})
            continue
        path = OUT / (request['requestKey'] + '.json')
        path.write_text(json.dumps(request, ensure_ascii=False) + '\n')
        sent = subprocess.run(['python3', str(FLEET / 'submit-via-ssh.py'), str(path)],
                              capture_output=True, text=True, check=True)
        receipt = json.loads(sent.stdout)
        assert receipt['owner'] == 'win-01' and receipt['request_key'] == request['requestKey']
        receipts.append({'sourceId': row['id'], 'jobId': receipt['id'], 'status': receipt['status']})
    (OUT / 'submit-win-01.json').write_text(json.dumps(receipts, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'submitted': len(receipts), 'alreadySubmitted': len(submitted), 'dryRun': args.dry_run}))


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Queue win02's reviewed-source candidates after r24 is proven installed."""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'marketing/assets/worker-logo-cycle-20261015e'
PLAN = ROOT / 'data/collection/semologo-worker-sources-cycle-20261015e.json'
FLEET = Path('/Users/juuuno/Desktop/macminim4/ops/worker-fleet/deployment')
VERSION = '20261016-semologo-cycle-r25'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--limit', type=int, default=0)
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    jobs = json.loads(subprocess.run(['python3', str(FLEET / 'status-via-ssh.py'), 'all'],
                                    capture_output=True, text=True, check=True).stdout)
    checks = [j for j in jobs if j['request_key'].startswith('semologo-cycle-r25-ready-win-02-')
              and j['status'] == 'succeeded' and j['result']['result']['runtimeVersion'] == VERSION]
    assert checks, f'win-02 has not reported {VERSION}'
    submitted = {j['input']['sourceId'] for j in jobs if j['project'] == 'semologo'
                 and j['kind'] == 'semologo-logo-collect'
                 and j['request_key'].startswith('semologo-cycle-20261015e-')}
    plan = json.loads(PLAN.read_text())
    sources = [r for r in plan['sources'] if r['preflight'] == 'ok' and r['id'] not in submitted]
    if args.limit > 0:
        sources = sources[:args.limit]
    commit = subprocess.check_output(['git', '-C', str(ROOT), 'rev-parse', 'HEAD'], text=True).strip()
    receipts = []
    for row in sources:
        suffix = hashlib.sha256(row['id'].encode()).hexdigest()[:12]
        request = {'project': 'semologo', 'kind': 'semologo-logo-collect',
                   'requestKey': f'semologo-cycle-20261015e-win02-{suffix}',
                   'commit': commit, 'input': {'sourceId': row['id']}, 'workerId': 'win-02'}
        if args.dry_run:
            receipts.append({'sourceId': row['id'], 'status': 'dry-run'})
            continue
        path = OUT / (request['requestKey'] + '.json')
        path.write_text(json.dumps(request, ensure_ascii=False) + '\n')
        sent = subprocess.run(['python3', str(FLEET / 'submit-via-ssh.py'), str(path)],
                              capture_output=True, text=True, check=True)
        receipt = json.loads(sent.stdout)
        assert receipt['owner'] == 'win-02' and receipt['request_key'] == request['requestKey']
        receipts.append({'sourceId': row['id'], 'jobId': receipt['id'], 'status': receipt['status']})
    (OUT / 'submit-win-02.json').write_text(json.dumps(receipts, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'submitted': len(receipts), 'alreadySubmitted': len(submitted), 'dryRun': args.dry_run}))


if __name__ == '__main__':
    main()

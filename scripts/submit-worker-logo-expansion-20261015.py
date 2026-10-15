#!/usr/bin/env python3
"""Submit one allowlisted collection job per source after worker version proof."""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'marketing/assets/worker-logo-expansion-20261015'
PLAN = ROOT / 'data/collection/semologo-worker-sources-next-20261015.json'
FLEET = Path('/Users/juuuno/Desktop/macminim4/ops/worker-fleet/deployment')
REQUIRED_VERSION = '20261015-semologo-expanded-r20'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('worker', choices=('win-01', 'win-02'))
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    status = subprocess.run(['python3', str(FLEET / 'status-via-ssh.py'), 'all'],
                            capture_output=True, text=True, check=True)
    jobs = json.loads(status.stdout)
    diagnostics = [j for j in jobs if j['owner'] == args.worker and
                   j['request_key'].startswith('semologo-roster-check-20261015-') and
                   j['status'] == 'succeeded']
    diagnostics.sort(key=lambda j: j['created_at'], reverse=True)
    assert diagnostics and diagnostics[0]['result']['result'].get('runtimeVersion') == REQUIRED_VERSION, 'Worker update not verified'
    succeeded = {j['input']['sourceId'] for j in jobs if j['project'] == 'semologo' and
                 j['kind'] == 'semologo-logo-collect' and j['owner'] == args.worker and
                 j['status'] == 'succeeded' and j['request_key'].startswith('semologo-expansion-20261015-')}
    commit = subprocess.check_output(['git', '-C', str(ROOT), 'rev-parse', 'HEAD'], text=True).strip()
    assert len(commit) == 40
    plan = json.loads(PLAN.read_text())
    rows = [row for row in plan['sources'] if row['lane'] == args.worker and row['preflight'] == 'ok'
            and not row.get('reviewDecision', '').startswith('reject-')
            and row['id'] not in succeeded]
    receipts = []
    for row in rows:
        suffix = hashlib.sha256(row['id'].encode()).hexdigest()[:12]
        request = {'project': 'semologo', 'kind': 'semologo-logo-collect',
                   'requestKey': f'semologo-expansion-20261015-{args.worker.replace("-", "")}-{suffix}',
                   'commit': commit, 'input': {'sourceId': row['id']}, 'workerId': args.worker}
        if args.dry_run:
            receipts.append({'sourceId': row['id'], 'requestKey': request['requestKey'], 'status': 'dry-run'})
            continue
        request_file = OUT / f'{request["requestKey"]}.json'
        request_file.write_text(json.dumps(request, ensure_ascii=False) + '\n')
        response = subprocess.run(['python3', str(FLEET / 'submit-via-ssh.py'), str(request_file)],
                                  capture_output=True, text=True, check=True)
        receipt = json.loads(response.stdout)
        assert receipt['request_key'] == request['requestKey'] and receipt['owner'] == args.worker
        receipts.append({'sourceId': row['id'], 'requestKey': request['requestKey'],
                         'jobId': receipt['id'], 'status': receipt['status']})
    (OUT / f'submit-{args.worker}.json').write_text(json.dumps(receipts, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'worker': args.worker, 'submitted': len(receipts), 'alreadySucceeded': len(succeeded),
                      'dryRun': args.dry_run}, ensure_ascii=False))


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Submit each cycle source once after both Windows workers prove r22."""
import argparse
import base64
import hashlib
import json
import io
import subprocess
from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'marketing/assets/worker-logo-cycle-20261015b'
PLAN = ROOT / 'data/collection/semologo-worker-sources-cycle-20261015b.json'
FLEET = Path('/Users/juuuno/Desktop/macminim4/ops/worker-fleet/deployment')
VERSION = '20261015-semologo-cycle-r22'
ROSTER_HASH = 'ee0191384ec798031144c26448b32b0bd187541809ea560acac9f3b3954f10a6'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('worker', choices=('win-01', 'win-02'))
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--limit', type=int, default=0)
    args = parser.parse_args()
    response = subprocess.run(['python3', str(FLEET / 'status-via-ssh.py'), 'all'],
                              capture_output=True, text=True, check=True)
    jobs = json.loads(response.stdout)
    checks = [job for job in jobs if job['request_key'] == 'semologo-cycle-r22-check-' + args.worker + '-v2'
              and job['status'] == 'succeeded']
    assert checks, 'Worker package not proven'
    observed_version = checks[0]['result']['result']['runtimeVersion']
    assert observed_version in {VERSION, '20261015-keyen-pathfix'}, 'Unexpected worker version'
    if observed_version != VERSION:
        # Another project published a newer shared package. Check that its
        # SemoLogo roster is byte-identical before this worker takes a job.
        envelope = json.loads((OUT / 'current-after-v2.json').read_text())
        with ZipFile(io.BytesIO(base64.b64decode(envelope['bundleBase64']))) as archive:
            roster = archive.read('runtime/semologo-sources.json')
            version = archive.read('runtime/version.mjs').decode()
        assert hashlib.sha256(roster).hexdigest() == ROSTER_HASH
        assert observed_version in version
    succeeded = {job['input']['sourceId'] for job in jobs if job['project'] == 'semologo'
                 and job['kind'] == 'semologo-logo-collect' and job['owner'] == args.worker
                 and job['status'] == 'succeeded'
                 and job['request_key'].startswith('semologo-cycle-20261015b-')}
    planned = json.loads(PLAN.read_text())
    rows = [row for row in planned['sources'] if row['lane'] == args.worker
            and row['preflight'] == 'ok' and row['id'] not in succeeded]
    if args.limit > 0:
        rows = rows[:args.limit]
    commit = subprocess.check_output(['git', '-C', str(ROOT), 'rev-parse', 'HEAD'], text=True).strip()
    receipts = []
    for row in rows:
        suffix = hashlib.sha256(row['id'].encode()).hexdigest()[:12]
        request = {'project': 'semologo', 'kind': 'semologo-logo-collect',
                   'requestKey': f'semologo-cycle-20261015b-{args.worker.replace("-", "")}-{suffix}',
                   'commit': commit, 'input': {'sourceId': row['id']}, 'workerId': args.worker}
        if args.dry_run:
            receipts.append({'sourceId': row['id'], 'requestKey': request['requestKey'], 'status': 'dry-run'})
            continue
        path = OUT / f'{request["requestKey"]}.json'
        path.write_text(json.dumps(request, ensure_ascii=False) + '\n')
        sent = subprocess.run(['python3', str(FLEET / 'submit-via-ssh.py'), str(path)],
                              capture_output=True, text=True, check=True)
        receipt = json.loads(sent.stdout)
        assert receipt['owner'] == args.worker and receipt['request_key'] == request['requestKey']
        receipts.append({'sourceId': row['id'], 'requestKey': request['requestKey'],
                         'jobId': receipt['id'], 'status': receipt['status']})
    (OUT / f'submit-{args.worker}.json').write_text(json.dumps(receipts, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'worker': args.worker, 'submitted': len(receipts),
                      'alreadySucceeded': len(succeeded), 'dryRun': args.dry_run}))


if __name__ == '__main__':
    main()

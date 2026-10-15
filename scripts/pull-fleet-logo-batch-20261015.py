#!/usr/bin/env python3
"""Verify private fleet manifests and recover reviewed SVG originals locally."""
import base64
import argparse
import hashlib
import json
import re
import runpy
import subprocess
from pathlib import Path

import boto3
from botocore.config import Config

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'marketing/assets/worker-logo-batch-20261015'
BUCKET = 'vibers-bucket'
PREFIX = 'automation/v1/tenants/internal/projects/semologo/runs/'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--request-prefix', default='semologo-svg-20261015-')
    parser.add_argument('--output', type=Path, default=OUT)
    args = parser.parse_args()
    output = args.output.resolve()
    assert output.is_relative_to(ROOT / 'marketing/assets')
    status = subprocess.run(['python3', '/Users/juuuno/Desktop/macminim4/ops/worker-fleet/deployment/status-via-ssh.py', 'all'],
                            check=True, capture_output=True, text=True)
    jobs = [j for j in json.loads(status.stdout) if j['project'] == 'semologo'
            and j['kind'] == 'semologo-logo-collect' and j['request_key'].startswith(args.request_prefix)]
    jobs.sort(key=lambda j: j['request_key'])
    secrets = runpy.run_path(str(ROOT / 'scripts/publish-svg-background-audit-20261014.py'))['secrets']()
    s3 = boto3.client('s3', endpoint_url='https://kr.object.ncloudstorage.com', region_name='kr-standard',
        aws_access_key_id=secrets['NCP_ACCESS_KEY'], aws_secret_access_key=secrets['NCP_SECRET_KEY'],
        config=Config(signature_version='s3v4', request_checksum_calculation='when_required',
                      response_checksum_validation='when_required'))
    output.mkdir(parents=True, exist_ok=True)
    report = {'schemaVersion': 1, 'batch': args.request_prefix.rstrip('-'), 'total': len(jobs), 'results': []}
    for job in jobs:
        row = {'jobId': job['id'], 'requestKey': job['request_key'], 'workerId': job['owner'],
               'status': job['status'], 'attempt': job['attempt'], 'sourceId': job['input']['sourceId']}
        if job['status'] != 'succeeded':
            report['results'].append(row)
            continue
        evidence = job['result']
        key, digest = evidence['manifestKey'], evidence['manifestHash']
        assert key.startswith(PREFIX + job['id'] + '/' + str(job['attempt']) + '/')
        assert key.endswith(digest + '.manifest.json') and re.fullmatch(r'[a-f0-9]{64}', digest)
        manifest_raw = s3.get_object(Bucket=BUCKET, Key=key)['Body'].read()
        assert sha(manifest_raw) == digest
        manifest = json.loads(manifest_raw)
        assert manifest['jobId'] == job['id'] and manifest['workerId'] == job['owner']
        result_key = manifest['resultKey']
        assert result_key.startswith(PREFIX + job['id'] + '/' + str(job['attempt']) + '/')
        raw = s3.get_object(Bucket=BUCKET, Key=result_key)['Body'].read()
        assert len(raw) == manifest['size'] and sha(raw) == manifest['sha256']
        result = json.loads(raw)
        assert result['jobId'] == job['id'] and result['sourceId'] == job['input']['sourceId']
        original = base64.b64decode(result['originalBase64'], validate=True)
        assert sha(original) == result['sha256'] and b'<svg' in original[:1000].lower()
        target = output / (job['request_key'] + '.svg')
        if target.exists():
            assert target.read_bytes() == original
        else:
            target.write_bytes(original)
        row.update({'file': target.name, 'sha256': result['sha256'], 'bytes': len(original),
                    'sourcePage': result['sourcePage'], 'assetUrl': result['assetUrl'],
                    'sourceChanged': result['sourceChanged'], 'reviewStatus': result['reviewStatus'],
                    'manifestKey': key, 'manifestHash': digest})
        report['results'].append(row)
    (output / 'manifest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'total': report['total'], 'verified': sum('file' in r for r in report['results']),
                      'pending': sum(r['status'] != 'succeeded' for r in report['results'])}, ensure_ascii=False))


if __name__ == '__main__':
    main()

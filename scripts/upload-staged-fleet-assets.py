#!/usr/bin/env python3
"""Preserve every downloaded fleet logo candidate in a private NCP bucket.

This is archival staging, not public CMS publication. The source manifest and
every original byte are content-addressed so later reviews can reuse them.
"""
import argparse
import base64
import concurrent.futures
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path

import boto3
from botocore.config import Config

BUCKET = 'vibers-bucket'
PREFIX = 'automation/v1/tenants/internal/projects/semologo/staging/fleet-domain-20261017'
MIMES = {'.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp'}


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def client():
    if not os.environ.get('NCP_ACCESS_KEY') or not os.environ.get('NCP_SECRET_KEY'):
        raise RuntimeError('Central NCP credential environment is required')
    return boto3.client('s3', endpoint_url='https://kr.object.ncloudstorage.com', region_name='kr-standard',
        aws_access_key_id=os.environ['NCP_ACCESS_KEY'], aws_secret_access_key=os.environ['NCP_SECRET_KEY'],
        config=Config(signature_version='s3v4', max_pool_connections=32,
                      request_checksum_calculation='when_required', response_checksum_validation='when_required'))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--stage', type=Path, required=True)
    parser.add_argument('--workers', type=int, default=24)
    args = parser.parse_args()
    if not 1 <= args.workers <= 32:
        parser.error('workers must be 1–32')
    stage = args.stage.resolve()
    manifest = json.loads((stage / 'manifest.json').read_text())
    names = sorted({r['file'] for r in manifest['results'] if r.get('file')})
    s3 = client()

    def upload(name):
        path = stage / name
        suffix = path.suffix.lower()
        expected = path.stem
        if suffix not in MIMES or len(expected) != 64 or any(c not in '0123456789abcdef' for c in expected):
            raise ValueError('Unexpected staged file name: ' + name)
        raw = path.read_bytes()
        if digest(raw) != expected:
            raise ValueError('Staged hash mismatch: ' + name)
        key = PREFIX + '/originals/' + name
        s3.put_object(Bucket=BUCKET, Key=key, Body=raw, ContentType=MIMES[suffix],
                      ContentMD5=base64.b64encode(hashlib.md5(raw).digest()).decode(),
                      Metadata={'sha256': expected, 'review-status': 'pending'})
        head = s3.head_object(Bucket=BUCKET, Key=key)
        if head['ContentLength'] != len(raw) or head['Metadata'].get('sha256') != expected:
            raise ValueError('Bucket receipt mismatch: ' + name)
        return name

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        uploaded = list(pool.map(upload, names))
    if len(uploaded) != len(names):
        raise ValueError('Incomplete object upload')
    manifest_raw = (stage / 'manifest.json').read_bytes()
    manifest_key = PREFIX + '/manifests/' + digest(manifest_raw) + '.json'
    s3.put_object(Bucket=BUCKET, Key=manifest_key, Body=manifest_raw,
                  ContentType='application/json', Metadata={'sha256': digest(manifest_raw),
                                                             'review-status': 'pending'})
    readback = s3.get_object(Bucket=BUCKET, Key=manifest_key)['Body'].read()
    if readback != manifest_raw:
        raise ValueError('Manifest readback mismatch')
    receipt = {'schemaVersion': 1, 'uploadedAt': datetime.now(timezone.utc).isoformat(),
               'bucket': BUCKET, 'prefix': PREFIX, 'private': True,
               'uniqueOriginals': len(uploaded), 'manifestKey': manifest_key,
               'manifestSha256': digest(manifest_raw), 'publication': 'none; review required'}
    (stage / 'bucket-receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(receipt, ensure_ascii=False))


if __name__ == '__main__':
    main()

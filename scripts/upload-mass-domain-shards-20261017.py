#!/usr/bin/env python3
"""Place immutable, pre-hashed domain candidate shards in the private NCP bucket.

Mac publishes with its approved NCP key. The central fleet scheduler reads
these immutable shards and assigns bounded domain batches to Windows workers.
No domain discovery job is scheduled by this command.
"""
import argparse
import hashlib
import json
import shlex
from pathlib import Path

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'data/collection/mass-domain-shards-20261016.json'
BASE = Path('/Volumes/HDD-1TB/semologo-migration/bulk-seeds')
SECRET = Path('/Users/juuuno/Desktop/macminim4/.secrets/보안.env')
BUCKET = 'vibers-bucket'


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def credentials():
    found = {}
    for line in SECRET.read_text().splitlines():
        key, sep, value = line.removeprefix('export ').partition('=')
        if sep and key in {'NCP_ACCESS_KEY', 'NCP_SECRET_KEY'}:
            parts = shlex.split(value, comments=True)
            found[key] = parts[0] if parts else ''
    if not all(found.get(key) for key in ('NCP_ACCESS_KEY', 'NCP_SECRET_KEY')):
        raise RuntimeError('NCP object credentials unavailable')
    return found


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    plan = json.loads(MANIFEST.read_text())
    rows = []
    for batch in plan['batches']:
        folder = 'windows-shards-20261016' + (f'-batch{batch["batch"]}' if batch['batch'] > 1 else '')
        for source in batch['files']:
            filename = source['worker'] + '-cc-only-candidates.csv.gz'
            path = BASE / folder / filename
            raw = path.read_bytes()
            if digest(raw) != source['sha256']:
                raise RuntimeError('Local shard hash changed: ' + filename)
            key = (f'automation/v1/tenants/internal/projects/semologo/seeds/'
                   f'cc-20261016/batch{batch["batch"]}/{source["worker"]}-{source["sha256"][:16]}.csv.gz')
            rows.append({'batch': batch['batch'], 'worker': source['worker'], 'domains': source['count'],
                         'key': key, 'sha256': source['sha256'], 'bytes': len(raw), 'path': str(path)})
    if not args.apply:
        print(json.dumps({'status': 'ready', 'files': len(rows),
                          'domains': sum(row['domains'] for row in rows),
                          'bytes': sum(row['bytes'] for row in rows)}))
        return
    secret = credentials()
    s3 = boto3.client('s3', endpoint_url='https://kr.object.ncloudstorage.com',
        region_name='kr-standard', aws_access_key_id=secret['NCP_ACCESS_KEY'],
        aws_secret_access_key=secret['NCP_SECRET_KEY'],
        config=Config(signature_version='s3v4'))
    for row in rows:
        raw = Path(row['path']).read_bytes()
        try:
            existing = s3.get_object(Bucket=BUCKET, Key=row['key'])['Body'].read()
        except ClientError as error:
            if error.response.get('Error', {}).get('Code') not in ('404', 'NoSuchKey', 'NotFound'):
                raise
            existing = None
        if existing is None:
            s3.put_object(Bucket=BUCKET, Key=row['key'], Body=raw,
                ContentType='application/gzip', CacheControl='no-store',
                Metadata={'sha256': row['sha256'], 'rows': str(row['domains'])})
        elif existing != raw:
            raise RuntimeError('Different object already exists: ' + row['key'])
        response = s3.get_object(Bucket=BUCKET, Key=row['key'])
        check = hashlib.sha256()
        for chunk in response['Body'].iter_chunks(chunk_size=1024*1024):
            check.update(chunk)
        if check.hexdigest() != row['sha256']:
            raise RuntimeError('Bucket readback mismatch: ' + row['key'])
        print(json.dumps({'uploadedAndVerified': row['key'], 'domains': row['domains']}), flush=True)
    receipt = {'status': 'private-bucket-uploaded-and-hash-verified',
        'files': [{key: value for key, value in row.items() if key != 'path'} for row in rows]}
    destination = ROOT / 'data/collection/mass-domain-shards-bucket-20261017.json'
    destination.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'status': receipt['status'], 'files': len(rows), 'receipt': str(destination)}))


if __name__ == '__main__':
    main()

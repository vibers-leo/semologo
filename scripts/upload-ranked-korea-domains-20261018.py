#!/usr/bin/env python3
"""Upload immutable ranked Korean website candidates to the private bucket."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

from botocore.exceptions import ClientError

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'data/collection/korea-ranked-domains-20261018/manifest.json'
BUCKET = 'vibers-bucket'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    manifest = json.loads(MANIFEST.read_text())
    assert 4000 <= manifest['candidateDomains'] <= 6000 and len(manifest['files']) == 2
    spec = importlib.util.spec_from_file_location('publisher', ROOT / 'scripts/repair-busan-cultural-foundation-20261017.py')
    publisher = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(publisher)
    s3 = publisher.storage() if args.apply else None
    for item in manifest['files']:
        raw = (ROOT / item['file']).read_bytes()
        assert hashlib.sha256(raw).hexdigest() == item['sha256'] and len(raw) == item['bytes']
        if args.apply:
            try:
                existing = s3.get_object(Bucket=BUCKET, Key=item['key'])['Body'].read()
            except ClientError as error:
                if error.response.get('Error', {}).get('Code') not in ('404', 'NoSuchKey', 'NotFound'):
                    raise
                existing = None
            if existing is None:
                s3.put_object(Bucket=BUCKET, Key=item['key'], Body=raw,
                              ContentType='application/gzip', CacheControl='no-store',
                              Metadata={'sha256': item['sha256'], 'rows': str(item['count'])})
            elif existing != raw:
                raise RuntimeError('Immutable key conflict: ' + item['key'])
            readback = s3.get_object(Bucket=BUCKET, Key=item['key'])['Body'].read()
            assert hashlib.sha256(readback).hexdigest() == item['sha256']
        print(json.dumps({'worker': item['worker'], 'domains': item['count'],
                          'sha256': item['sha256'], 'uploaded': args.apply}))


if __name__ == '__main__':
    main()

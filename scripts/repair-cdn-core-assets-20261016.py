#!/usr/bin/env python3
"""Restore missing/private OG assets from the existing brand-logos source.

Never replace differing bucket bytes: a mismatch requires human source review.
"""
import shlex
import subprocess
from pathlib import Path
from urllib.request import Request, urlopen

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

BRANDS = ('kakao', 'starbucks', 'youtube', 'duolingo', 'line', 'spotify',
          'instagram', 'airbnb', 'daangn', 'toss', 'nintendo', 'mcdonalds',
          'figma', 'slack', 'netflix', 'discord')
BUCKET = 'vibers-bucket'
SECRETS = Path('/Users/juuuno/Desktop/macminim4/.secrets/보안.env')


def credentials():
    values = {}
    for line in SECRETS.read_text().splitlines():
        if line.startswith('export '):
            line = line[7:]
        if '=' not in line:
            continue
        key, value = line.split('=', 1)
        if key in ('NCP_ACCESS_KEY', 'NCP_SECRET_KEY'):
            values[key] = shlex.split(value, comments=True)[0]
    return values


def main():
    secret = credentials()
    s3 = boto3.client('s3', endpoint_url='https://kr.object.ncloudstorage.com',
                      region_name='kr-standard', aws_access_key_id=secret['NCP_ACCESS_KEY'],
                      aws_secret_access_key=secret['NCP_SECRET_KEY'],
                      config=Config(signature_version='s3v4',
                                    request_checksum_calculation='when_required',
                                    response_checksum_validation='when_required'))
    repaired = []
    for brand in BRANDS:
        for filename, content_type in (('logo.svg', 'image/svg+xml'), ('logo.png', 'image/png')):
            key = f'_clients/{brand}/{filename}'
            public_url = 'https://logo.vibers.co.kr/' + key
            status = subprocess.run(['curl', '-sS', '-L', '-o', '/dev/null', '-w', '%{http_code}',
                                     '--max-time', '10', public_url], capture_output=True, text=True,
                                    check=True).stdout
            if status == '200':
                continue
            if status not in ('403', '404'):
                raise RuntimeError(f'Unexpected public status {status}: {key}')
            source = f'https://raw.githubusercontent.com/vibers-leo/brand-logos/main/{key}'
            with urlopen(Request(source, headers={'User-Agent': 'SemoLogo-asset-repair'}), timeout=15) as response:
                data = response.read(5_000_001)
            if not data or len(data) > 5_000_000:
                raise RuntimeError(f'Invalid source size: {key}')
            if filename.endswith('.svg') and (b'<svg' not in data[:1000].lower() or b'<image' in data.lower()):
                raise RuntimeError(f'Invalid SVG source: {key}')
            if filename.endswith('.png') and not data.startswith(b'\x89PNG\r\n\x1a\n'):
                raise RuntimeError(f'Invalid PNG source: {key}')
            try:
                existing = s3.get_object(Bucket=BUCKET, Key=key)['Body'].read()
                if existing != data:
                    raise RuntimeError(f'Bucket differs from source; review needed: {key}')
            except ClientError as error:
                if error.response['Error']['Code'] not in ('NoSuchKey', '404'):
                    raise
            s3.put_object(Bucket=BUCKET, Key=key, Body=data, ACL='public-read',
                          ContentType=content_type, CacheControl='public,max-age=31536000,immutable')
            if s3.get_object(Bucket=BUCKET, Key=key)['Body'].read() != data:
                raise RuntimeError(f'Bucket readback mismatch: {key}')
            repaired.append(key)
            print('REPAIRED', key)
    print('checked', len(BRANDS) * 2, 'repaired', len(repaired))


if __name__ == '__main__':
    main()

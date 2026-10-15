#!/usr/bin/env python3
"""Replace three wrongly typed logo.png objects with their served PNG fallback.

Original bytes are preserved under a private source key. All writes are guarded
by exact source hashes, so a newer editorial asset is never overwritten.
"""
import argparse
import hashlib
import json
import shlex
from pathlib import Path
from urllib.request import Request, urlopen

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

EXPECTED = {
    'xn24mu0j': ('d192b483007dfd3deda6ab2aca37aa473cca8f528c65cf2765fcd95f4be97aff', 'webp'),
    'lotteshoppingir': ('309b42712201eb7bbf979603283f8a5e96e35efa194fd5c7c1485b8cee562f2b', 'gif'),
    'theborn-korea': ('23870c77a34e351eaaa54a2f181a753558575fc27a7bc40de2b172067c2326ed', 'jpg'),
}
BUCKET = 'vibers-bucket'
PNG_MAGIC = b'\x89PNG\r\n\x1a\n'


def credentials():
    values = {}
    for line in Path('/Users/juuuno/Desktop/macminim4/.secrets/보안.env').read_text().splitlines():
        if line.startswith('export '): line = line[7:]
        if '=' not in line: continue
        key, value = line.split('=', 1)
        if key in ('NCP_ACCESS_KEY', 'NCP_SECRET_KEY', 'CLOUDFLARE_GLOBAL_API_KEY', 'CLOUDFLARE_ACCOUNT_EMAIL'):
            values[key] = shlex.split(value, comments=True)[0]
    return values


def sha(raw): return hashlib.sha256(raw).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    secret = credentials()
    s3 = boto3.client('s3', endpoint_url='https://kr.object.ncloudstorage.com', region_name='kr-standard',
                      aws_access_key_id=secret['NCP_ACCESS_KEY'], aws_secret_access_key=secret['NCP_SECRET_KEY'],
                      config=Config(signature_version='s3v4', request_checksum_calculation='when_required',
                                    response_checksum_validation='when_required'))
    changes = []
    for ident, (digest, extension) in EXPECTED.items():
        original_key = f'_clients/{ident}/logo.png'
        fallback_key = f'_clients/{ident}/logo-transparent.png'
        backup_key = f'_clients/{ident}/sources/format-repair-20261016/logo-original.{extension}'
        original = s3.get_object(Bucket=BUCKET, Key=original_key)['Body'].read()
        fallback = s3.get_object(Bucket=BUCKET, Key=fallback_key)['Body'].read()
        if sha(original) != digest:
            if original == fallback:
                changes.append({'id': ident, 'status': 'already-repaired'})
                continue
            raise RuntimeError(f'{ident}: logo.png changed; review new content')
        if not fallback.startswith(PNG_MAGIC): raise RuntimeError(f'{ident}: fallback is not PNG')
        row = {'id': ident, 'status': 'ready', 'old_sha256': digest,
               'new_sha256': sha(fallback), 'backup_key': backup_key}
        if args.apply:
            try:
                backup = s3.get_object(Bucket=BUCKET, Key=backup_key)['Body'].read()
                if backup != original: raise RuntimeError(f'{ident}: differing backup exists')
            except ClientError as error:
                if error.response['Error']['Code'] not in ('NoSuchKey', '404'): raise
                s3.put_object(Bucket=BUCKET, Key=backup_key, Body=original,
                              ContentType={'webp': 'image/webp', 'gif': 'image/gif', 'jpg': 'image/jpeg'}[extension])
            if sha(s3.get_object(Bucket=BUCKET, Key=backup_key)['Body'].read()) != digest:
                raise RuntimeError(f'{ident}: backup readback failed')
            s3.put_object(Bucket=BUCKET, Key=original_key, Body=fallback, ACL='public-read',
                          ContentType='image/png', CacheControl='public,max-age=31536000,immutable')
            if s3.get_object(Bucket=BUCKET, Key=original_key)['Body'].read() != fallback:
                raise RuntimeError(f'{ident}: new PNG readback failed')
            row['status'] = 'repaired'
        changes.append(row)
    if args.apply and any(row['status'] == 'repaired' for row in changes):
        # Purge both URL forms used by the card code. Existing immutable edge
        # responses would otherwise keep serving the old format after the swap.
        files = []
        for row in changes:
            if row['status'] != 'repaired': continue
            url = f"https://logo.vibers.co.kr/_clients/{row['id']}/logo.png"
            files.extend((url, url + '?v=1790381000'))
        headers = {'X-Auth-Key': secret['CLOUDFLARE_GLOBAL_API_KEY'],
                   'X-Auth-Email': secret['CLOUDFLARE_ACCOUNT_EMAIL'], 'Content-Type': 'application/json'}
        zone_request = Request('https://api.cloudflare.com/client/v4/zones?name=vibers.co.kr', headers=headers)
        with urlopen(zone_request, timeout=15) as response:
            zone = json.load(response)['result'][0]['id']
        purge = Request(f'https://api.cloudflare.com/client/v4/zones/{zone}/purge_cache',
                        headers=headers, data=json.dumps({'files': files}).encode(), method='POST')
        with urlopen(purge, timeout=15) as response:
            if not json.load(response).get('success'): raise RuntimeError('CDN purge failed')
    print(json.dumps(changes, ensure_ascii=False))


if __name__ == '__main__': main()

#!/usr/bin/env python3
"""Audit recent public logo references against the bucket without CDN rate bursts."""
import concurrent.futures
import json
import shlex
import subprocess
from pathlib import Path
from urllib.parse import urlparse

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'marketing/assets/logo-image-path-audit-20261016.json'
CDN_PREFIX = 'https://logo.vibers.co.kr/_clients/'


def credentials():
    values = {}
    for line in Path('/Users/juuuno/Desktop/macminim4/.secrets/보안.env').read_text().splitlines():
        if line.startswith('export '):
            line = line[7:]
        if '=' in line:
            key, value = line.split('=', 1)
            if key in ('NCP_ACCESS_KEY', 'NCP_SECRET_KEY'):
                values[key] = shlex.split(value, comments=True)[0]
    return values


def catalog():
    rows = []
    for mode in ('recent', 'fame'):
        for offset in range(0, 600, 120):
            url = f'https://semologo.com/api/catalog/?sort={mode}&limit=120&offset={offset}'
            raw = subprocess.run(['curl', '-fsSL', '--max-time', '20', url], check=True,
                                 capture_output=True).stdout
            rows.extend(json.loads(raw)['brands'])
    return list({brand['id']: brand for brand in rows}.values())


def key_for(brand):
    url = brand.get('preview_png')
    if isinstance(url, str) and url.startswith(CDN_PREFIX):
        return urlparse(url).path.lstrip('/')
    png = brand.get('logo_png')
    if isinstance(png, str) and png.startswith('/submissions/'):
        return None
    if isinstance(png, str) and png.startswith(CDN_PREFIX):
        return urlparse(png).path.lstrip('/')
    if brand.get('has_png') or png:
        return f"_clients/{brand['id']}/{png if isinstance(png, str) and png.endswith('.png') else 'logo.png'}"
    svg = brand.get('logo_svg')
    if isinstance(svg, str) and svg.startswith('/submissions/'):
        return None
    if brand.get('has_svg') or svg:
        return f"_clients/{brand['id']}/{svg if isinstance(svg, str) and svg.endswith('.svg') else 'logo.svg'}"
    return None


def main():
    secret = credentials()
    s3 = boto3.client('s3', endpoint_url='https://kr.object.ncloudstorage.com',
                      region_name='kr-standard', aws_access_key_id=secret['NCP_ACCESS_KEY'],
                      aws_secret_access_key=secret['NCP_SECRET_KEY'],
                      config=Config(signature_version='s3v4',
                                    request_checksum_calculation='when_required',
                                    response_checksum_validation='when_required'))
    rows = catalog()

    def inspect(brand):
        key = key_for(brand)
        if not key:
            return {'id': brand['id'], 'key': None, 'status': 'local-or-unavailable'}
        try:
            s3.head_object(Bucket='vibers-bucket', Key=key)
            status = 'present'
        except ClientError as error:
            status = 'missing' if error.response['Error']['Code'] in ('404', 'NoSuchKey') else 'error'
        return {'id': brand['id'], 'key': key, 'status': status}

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        checked = list(pool.map(inspect, rows))
    summary = {status: sum(row['status'] == status for row in checked)
               for status in ('present', 'missing', 'error', 'local-or-unavailable')}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({'sample': len(rows), 'summary': summary, 'rows': checked},
                              ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'sample': len(rows), **summary,
                      'missing_ids': [row['id'] for row in checked if row['status'] == 'missing']},
                     ensure_ascii=False))


if __name__ == '__main__':
    main()

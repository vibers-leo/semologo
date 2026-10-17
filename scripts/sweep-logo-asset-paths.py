#!/usr/bin/env python3
"""Resumable, bounded public-byte audit of advertised CMS logo files.

The catalog snapshot is immutable for one sweep. Each run checks only a small
window, records failures, and advances its cursor after the window is durable.
It does not alter public content or treat unadvertised formats as broken.
"""
import argparse
import concurrent.futures
import hashlib
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath

CDN = 'https://logo.vibers.co.kr/_clients/'
SITE = 'https://semologo.com'


def claimed(value):
    return value is True or value == 'true'


def asset_url(row, kind):
    filename = 'logo.' + kind
    value = row.get('logo_' + kind) or filename
    if not isinstance(value, str):
        raise ValueError('Invalid asset path')
    if value in {'true', 'false'}:
        raise ValueError('Boolean asset path')
    if value.startswith('/'):
        return SITE + value
    if value.startswith('https://'):
        host = urllib.parse.urlsplit(value).hostname
        if host not in {'semologo.com', 'logo.vibers.co.kr'}:
            raise ValueError('Unexpected asset host')
        return value
    parts = PurePosixPath(value).parts
    if not parts or any(part in ('', '.', '..') for part in parts) or '://' in value or '?' in value or '#' in value:
        raise ValueError('Unexpected relative asset path')
    return CDN + urllib.parse.quote(row['id'], safe='') + '/' + urllib.parse.quote(value, safe='/')


def check_url(url, kind):
    request = urllib.request.Request(url, headers={
        'User-Agent': 'SemoLogo-asset-audit/1.0 (+https://semologo.com/)',
        'Range': 'bytes=0-4095'})
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            body = response.read(4096)
            status = response.status
    except urllib.error.HTTPError as error:
        return {'status': error.code, 'valid': False}
    except Exception as error:
        return {'status': 0, 'valid': False, 'error': type(error).__name__}
    valid = (body.startswith(b'\x89PNG\r\n\x1a\n') if kind == 'png'
             else b'<svg' in body[:4096].lower())
    return {'status': status, 'valid': valid}


def check_row(row):
    result = {'id': row['id'], 'checkedAt': datetime.now(timezone.utc).isoformat()}
    for kind in ('png', 'svg'):
        if not claimed(row.get('has_' + kind)):
            continue
        try:
            url = asset_url(row, kind)
            result[kind] = {'url': url, **check_url(url, kind)}
        except ValueError as error:
            result[kind] = {'status': 0, 'valid': False, 'error': str(error)}
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--catalog', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--cursor', type=Path, required=True)
    parser.add_argument('--limit', type=int, default=300)
    parser.add_argument('--workers', type=int, default=4)
    args = parser.parse_args()
    if not 1 <= args.limit <= 1000 or not 1 <= args.workers <= 8:
        parser.error('limit 1–1000 and workers 1–8 are required')
    raw = args.catalog.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    catalog = json.loads(raw)
    if not isinstance(catalog, list):
        parser.error('catalog must be a JSON array')
    state = json.loads(args.cursor.read_text()) if args.cursor.exists() else {'digest': digest, 'offset': 0}
    if state['digest'] != digest:
        parser.error('catalog snapshot changed; start a new sweep cursor')
    start = state['offset']
    window = catalog[start:start + args.limit]
    if not window:
        print(json.dumps({'status': 'complete', 'checked': start, 'total': len(catalog)}))
        return
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        results = list(pool.map(check_row, window))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open('a') as file:
        for row in results:
            file.write(json.dumps(row, ensure_ascii=False) + '\n')
        file.flush()
        os.fsync(file.fileno())
    next_state = {'digest': digest, 'offset': start + len(results), 'total': len(catalog),
                  'updatedAt': datetime.now(timezone.utc).isoformat()}
    args.cursor.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.cursor.with_suffix(args.cursor.suffix + '.tmp')
    temporary.write_text(json.dumps(next_state) + '\n')
    temporary.replace(args.cursor)
    broken = sum(any(not detail.get('valid') for kind, detail in row.items() if kind in ('png', 'svg'))
                 for row in results)
    print(json.dumps({'checkedThisRun': len(results), 'nextOffset': next_state['offset'],
                      'total': len(catalog), 'brokenOrUnreachable': broken}))


if __name__ == '__main__':
    main()

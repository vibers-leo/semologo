#!/usr/bin/env python3
"""Resumable, conservative publication of transparent SVG/PNG derivatives.

Only one full-viewBox background, retained artwork, verified alpha, and SVG-only
catalog identities qualify. Originals and administrator-selected presentations
remain untouched. Uploads are immutable; the compact override table is updated
only after both objects are verified.
"""
import argparse
import hashlib
import json
import shlex
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from PIL import Image
import psycopg2

ROOT = Path(__file__).resolve().parents[1]
AUDIT = ROOT / 'marketing/assets/svg-full-audit-20261013'
OUT = ROOT / 'marketing/assets/svg-background-publish-20261014'
SECRET = Path('/Users/juuuno/Desktop/macminim4/.secrets/보안.env')

def secrets():
    values = {}
    for line in SECRET.read_text().splitlines():
        line = line.removeprefix('export ')
        key, sep, raw = line.partition('=')
        if sep and key in {'DB_VIBERS_MAIN_URL', 'NCP_ACCESS_KEY', 'NCP_SECRET_KEY'}:
            parts = shlex.split(raw, comments=True)
            values[key] = parts[0] if parts else ''
    assert all(values.get(key) for key in ('DB_VIBERS_MAIN_URL', 'NCP_ACCESS_KEY', 'NCP_SECRET_KEY'))
    return values

def database(url):
    parsed = urllib.parse.urlsplit(url)
    return psycopg2.connect(host='127.0.0.1', port=63357, dbname=parsed.path.lstrip('/'),
        user=urllib.parse.unquote(parsed.username or ''), password=urllib.parse.unquote(parsed.password or ''),
        connect_timeout=8, sslmode='prefer')

def eligible():
    scope = {item['id']: item for item in json.loads((AUDIT / 'scope.json').read_text())['items']}
    latest = {}
    for line in (AUDIT / 'progress.jsonl').open():
        try:
            item = json.loads(line)
            latest[item['id']] = item
        except (ValueError, KeyError):
            continue
    assert len(latest) == len(scope), 'Audit is incomplete'
    return [item for item in latest.values() if item['status'] == 'background-removal-awaiting-review'
        and not scope[item['id']].get('has_png')
        and item.get('candidate_has_transparency') is True
        and item.get('background_elements') == 1]

def verify_candidate(item):
    ident = item['id']
    assert '/' not in ident and ident not in {'.', '..'}
    candidate = item.get('candidate_file', '')
    folder = ROOT / candidate
    assert candidate.startswith('marketing/assets/') and folder.name == 'candidate-transparent.png'
    folder = folder.parent
    assert folder.name == ident
    original = (folder / 'original.svg').read_bytes()
    png = (folder / 'candidate-transparent.png').read_bytes()
    svg = (folder / 'candidate-transparent.svg').read_bytes()
    assert hashlib.sha256(original).hexdigest() == item['source_sha256'], ident
    assert hashlib.sha256(png).hexdigest() == item['candidate_sha256'], ident
    assert len(png) < 8_000_000 and len(svg) < 5_000_000, ident
    with Image.open(folder / 'candidate-transparent.png') as image:
        rgba = image.convert('RGBA')
        alpha = rgba.getchannel('A')
        assert alpha.getextrema()[0] < 255 and alpha.getbbox(), ident
    return png, svg

def publish(item, client):
    ident = item['id']
    png, svg = verify_candidate(item)
    stem = 'sources/svg-bg-20261014/' + item['candidate_sha256'][:20]
    files = [(stem + '.png', png, 'image/png'), (stem + '.svg', svg, 'image/svg+xml')]
    for file, raw, content_type in files:
        key = f'_clients/{ident}/{file}'
        sha = hashlib.sha256(raw).hexdigest()
        try:
            old = client.head_object(Bucket='vibers-bucket', Key=key)
            if old['ContentLength'] != len(raw) or old.get('Metadata', {}).get('sha256') != sha:
                raise RuntimeError('Immutable object conflict: ' + ident)
        except ClientError as error:
            if error.response.get('Error', {}).get('Code') not in ('404', 'NoSuchKey', 'NotFound'):
                raise
            client.put_object(Bucket='vibers-bucket', Key=key, Body=raw, ACL='public-read',
                ContentType=content_type, CacheControl='public, max-age=31536000, immutable',
                Metadata={'sha256': sha})
            saved = client.head_object(Bucket='vibers-bucket', Key=key)
            if saved['ContentLength'] != len(raw) or saved.get('Metadata', {}).get('sha256') != sha:
                raise RuntimeError('Upload verification failed: ' + ident)
    return ident, stem + '.png', stem + '.svg', item['source_sha256'], item['candidate_sha256']

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--limit', type=int, default=0, help='0 processes the entire eligible queue')
    parser.add_argument('--workers', type=int, default=2)
    args = parser.parse_args()
    assert 1 <= args.workers <= 4
    OUT.mkdir(parents=True, exist_ok=True)
    values = secrets()
    db = database(values['DB_VIBERS_MAIN_URL'])
    with db, db.cursor() as cursor:
        cursor.execute('''CREATE TABLE IF NOT EXISTS semologo.logo_background_previews (
          id text PRIMARY KEY, png_file text NOT NULL, svg_file text NOT NULL,
          source_sha256 text NOT NULL, candidate_sha256 text NOT NULL,
          published_at timestamptz NOT NULL DEFAULT now())''')
        cursor.execute('SELECT id,source_sha256 FROM semologo.logo_background_previews')
        prior = dict(cursor.fetchall())
        # Ordinary catalog rows also carry logo_png/preview_png keys, even when
        # they have no PNG file. Only explicit administrator selections win.
        cursor.execute("SELECT id FROM semologo.logo_posts WHERE status='published' AND payload ? 'presentation'")
        protected = {row[0] for row in cursor.fetchall()}
    items = eligible()
    conflicts = [item['id'] for item in items if item['id'] in prior and prior[item['id']] != item['source_sha256']]
    todo = [item for item in items if item['id'] not in prior and item['id'] not in protected]
    if args.limit > 0: todo = todo[:args.limit]
    print(json.dumps({'eligible': len(items), 'already_published': len(prior), 'protected': len(protected),
        'source_conflicts': len(conflicts), 'queued': len(todo)}, ensure_ascii=False), flush=True)
    (OUT / 'conflicts.json').write_text(json.dumps(conflicts, ensure_ascii=False) + '\n')
    s3 = boto3.client('s3', endpoint_url='https://kr.object.ncloudstorage.com', region_name='kr-standard',
        aws_access_key_id=values['NCP_ACCESS_KEY'], aws_secret_access_key=values['NCP_SECRET_KEY'],
        config=Config(signature_version='s3v4', max_pool_connections=args.workers + 2,
          retries={'max_attempts': 5}, request_checksum_calculation='when_required',
          response_checksum_validation='when_required'))
    done = failed = 0
    with (OUT / 'progress.jsonl').open('a') as progress, ThreadPoolExecutor(max_workers=args.workers) as pool:
      for start in range(0, len(todo), 100):
        batch = todo[start:start + 100]
        for item, result in zip(batch, pool.map(lambda item: safe_publish(item, s3), batch)):
            if isinstance(result, Exception):
                failed += 1
                progress.write(json.dumps({'id': item['id'], 'status': 'failed', 'reason': str(result)[:180]}) + '\n')
                progress.flush()
                continue
            try:
                with db, db.cursor() as cursor:
                    cursor.execute('''INSERT INTO semologo.logo_background_previews
                      (id,png_file,svg_file,source_sha256,candidate_sha256)
                      VALUES (%s,%s,%s,%s,%s) ON CONFLICT (id) DO NOTHING''', result)
                done += 1
                progress.write(json.dumps({'id': result[0], 'status': 'published', 'png_file': result[1]}) + '\n')
                progress.flush()
            except Exception as error:
                db.rollback(); failed += 1
                progress.write(json.dumps({'id': item['id'], 'status': 'db-failed', 'reason': str(error)[:180]}) + '\n')
                progress.flush()
            if (done + failed) % 100 == 0:
                print(json.dumps({'processed': done + failed, 'published': done, 'failed': failed}), flush=True)
            time.sleep(0.05)
    db.close()
    print(json.dumps({'complete': True, 'published': done, 'failed': failed}), flush=True)
    if failed or conflicts:
        raise SystemExit(1)
    (OUT / 'complete.json').write_text(json.dumps({'eligible': len(items),
        'already_published': len(prior), 'published_this_run': done,
        'protected': len(protected), 'completed_at': time.time()}) + '\n')

def safe_publish(item, client):
    try: return publish(item, client)
    except Exception as error: return error

if __name__ == '__main__':
    main()

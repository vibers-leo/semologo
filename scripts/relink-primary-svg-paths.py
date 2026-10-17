#!/usr/bin/env python3
"""Relink literal-boolean SVG paths to an existing primary variant, if verified."""
import argparse
import concurrent.futures
import json
import subprocess
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import PurePosixPath, Path


def remote(source):
    result = subprocess.run(['ssh', 'vibers', 'docker exec -i semologo node -'],
                            input=source, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr.strip()[:500])
    return json.loads(result.stdout)


def candidates():
    return remote(r'''const {Pool}=require('pg');(async()=>{const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});const q=await p.query("select p.id,p.payload->>'svg_transparent' fallback,v.asset_manifest->'variants' manifest from semologo.logo_posts p join semologo.logo_versions v on v.brand_id=p.id and v.is_current where p.status='published' and p.payload->>'logo_svg'='true'");console.log(JSON.stringify(q.rows));await p.end()})().catch(e=>{console.error(e.message);process.exit(1)})''')


def primary_path(row):
    manifest = row.get('manifest') or {}
    primary = next((v for v in manifest.get('variants', [])
                    if v.get('key') == manifest.get('primary')), None) if isinstance(manifest, dict) else None
    path = (primary or {}).get('files', {}).get('svg') or row.get('fallback')
    if not isinstance(path, str) or not path.endswith('.svg') or not path.startswith('sources/'):
        return None
    parts = PurePosixPath(path).parts
    if any(part in ('', '.', '..') for part in parts) or '?' in path or '#' in path:
        return None
    return path


def verify(row):
    ident, path = row['id'], primary_path(row)
    if not path:
        return {'id': ident, 'status': 'no-primary-svg'}
    url = ('https://logo.vibers.co.kr/_clients/' + urllib.parse.quote(ident, safe='') + '/' +
           urllib.parse.quote(path, safe='/'))
    request = urllib.request.Request(url, headers={
        'User-Agent': 'SemoLogo-asset-audit/1.0 (+https://semologo.com/)',
        'Range': 'bytes=0-4095'})
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            head = response.read(4096)
        return {'id': ident, 'path': path, 'status': 'verified' if b'<svg' in head.lower() else 'not-svg'}
    except urllib.error.HTTPError as error:
        return {'id': ident, 'path': path, 'status': 'http-' + str(error.code)}
    except Exception as error:
        return {'id': ident, 'path': path, 'status': type(error).__name__}


def apply(rows):
    script = 'const rows=' + json.dumps(rows) + ';' + r'''const {Pool}=require('pg');(async()=>{const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});const c=await p.connect();let updated=0;try{await c.query('BEGIN');for(const item of rows){const q=await c.query("update semologo.logo_posts set payload=jsonb_set(payload,'{logo_svg}',to_jsonb($2::text),true) where id=$1 and status='published' and payload->>'logo_svg'='true' returning id",[item.id,item.path]);updated+=q.rowCount}await c.query('COMMIT');console.log(JSON.stringify({updated}));}catch(e){await c.query('ROLLBACK');throw e}finally{c.release();await p.end()}})().catch(e=>{console.error(e.message);process.exit(1)})'''
    return remote(script)['updated']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--workers', type=int, default=2)
    args = parser.parse_args()
    if not 1 <= args.workers <= 6:
        parser.error('workers must be 1–6')
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        results = list(pool.map(verify, candidates()))
    ready = [row for row in results if row['status'] == 'verified']
    updated = apply(ready) if args.apply and ready else 0
    report = {'createdAt': datetime.now(timezone.utc).isoformat(), 'mode': 'apply' if args.apply else 'dry-run',
              'checked': len(results), 'verified': len(ready), 'updated': updated, 'results': results}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({key: value for key, value in report.items() if key != 'results'}))


if __name__ == '__main__':
    main()

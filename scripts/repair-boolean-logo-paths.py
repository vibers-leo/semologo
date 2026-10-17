#!/usr/bin/env python3
"""Repair CMS asset paths literally stored as 'true' after byte verification.

Dry-run by default. Only a public, correctly typed default file qualifies, and
the database update compares the old value so concurrent edits are preserved.
"""
import argparse
import concurrent.futures
import json
import subprocess
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

CDN = 'https://logo.vibers.co.kr/_clients/'


def remote_node(source):
    result = subprocess.run(['ssh', 'vibers', 'docker exec -i semologo node -'],
                            input=source, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError('CMS query failed: ' + result.stderr.strip()[:500])
    return json.loads(result.stdout)


def candidates():
    return remote_node(r'''const {Pool}=require('pg');(async()=>{const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});const q=await p.query("select id,payload->>'logo_png' logo_png,payload->>'logo_svg' logo_svg from semologo.logo_posts where status='published' and (payload->>'logo_png'='true' or payload->>'logo_svg'='true')");console.log(JSON.stringify(q.rows));await p.end()})().catch(e=>{console.error(e.message);process.exit(1)})''')


def verify(row):
    ident, kind = row
    url = CDN + urllib.parse.quote(ident, safe='') + '/logo.' + kind
    request = urllib.request.Request(url, headers={
        'User-Agent': 'SemoLogo-asset-audit/1.0 (+https://semologo.com/)',
        'Range': 'bytes=0-4095'})
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            body = response.read(4096)
            status = response.status
    except urllib.error.HTTPError as error:
        return {'id': ident, 'kind': kind, 'status': error.code, 'verified': False}
    except Exception as error:
        return {'id': ident, 'kind': kind, 'status': 0, 'verified': False,
                'error': type(error).__name__}
    good = body.startswith(b'\x89PNG\r\n\x1a\n') if kind == 'png' else b'<svg' in body.lower()
    return {'id': ident, 'kind': kind, 'status': status, 'verified': good}


def apply(rows):
    script = 'const items=' + json.dumps(rows) + ';' + r'''const {Pool}=require('pg');(async()=>{const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});const c=await p.connect();let updated=0;try{await c.query('BEGIN');for(const item of items){const key='logo_'+item.kind;const q=await c.query("update semologo.logo_posts set payload=jsonb_set(payload,ARRAY[$2]::text[],to_jsonb($3::text),true) where id=$1 and status='published' and payload->>$2='true' returning id",[item.id,key,'logo.'+item.kind]);updated+=q.rowCount;}await c.query('COMMIT');console.log(JSON.stringify({updated}));}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();await p.end()}})().catch(e=>{console.error(e.message);process.exit(1)})'''
    return remote_node(script)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--workers', type=int, default=6)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if not 1 <= args.workers <= 8:
        parser.error('workers must be 1–8')
    raw = candidates()
    rows = [(item['id'], kind) for item in raw for kind in ('png', 'svg')
            if item['logo_' + kind] == 'true']
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        results = list(pool.map(verify, rows))
    ready = [item for item in results if item['verified']]
    changed = apply(ready)['updated'] if args.apply and ready else 0
    report = {'createdAt': datetime.now(timezone.utc).isoformat(), 'mode': 'apply' if args.apply else 'dry-run',
              'literalBooleanPaths': len(rows), 'verifiedDefaultFiles': len(ready),
              'unverified': len(rows) - len(ready), 'updated': changed, 'results': results}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({key: value for key, value in report.items() if key != 'results'}))


if __name__ == '__main__':
    main()

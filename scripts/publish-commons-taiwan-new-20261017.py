#!/usr/bin/env python3
"""Publish six visually reviewed Commons vectors as distinct CMS brands.

Dry-run by default.  The exact source bytes and names are pinned in the manifest.
"""
import argparse
import hashlib
import io
import json
import re
import shlex
import subprocess
from datetime import datetime, timezone
from pathlib import Path

import boto3
import cairosvg
from botocore.config import Config
from botocore.exceptions import ClientError
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'data/collection/commons-taiwan-new-20261017.json'
ASSETS = ROOT / 'data/collection/commons-taiwan-new-20261017-assets'
SECRET = Path('/Users/juuuno/Desktop/macminim4/.secrets/보안.env')
BUCKET = 'vibers-bucket'
CDN = 'https://logo.vibers.co.kr/_clients'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def credentials():
    found = {}
    for line in SECRET.read_text().splitlines():
        key, sep, value = line.removeprefix('export ').partition('=')
        if sep and key in {'NCP_ACCESS_KEY', 'NCP_SECRET_KEY'}:
            words = shlex.split(value, comments=True)
            found[key] = words[0] if words else ''
    if not all(found.get(key) for key in ('NCP_ACCESS_KEY', 'NCP_SECRET_KEY')):
        raise RuntimeError('NCP object credentials unavailable')
    return found


def remote_node(source):
    result = subprocess.run(['ssh', 'vibers', 'docker exec -i semologo node -'],
        input=source, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError('CMS query failed: ' + result.stderr.strip()[:500])
    return json.loads(result.stdout)


def db_check(items):
    names = [{'id': row['id'], 'name': row['name']} for row in items]
    js = 'const items=' + json.dumps(names) + ';' + r'''
const {Pool}=require('pg');
(async()=>{const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});try{
for(const x of items){const q=await p.query("SELECT id FROM semologo.logo_posts WHERE id=$1 OR (status='published' AND (lower(payload->>'name_en')=lower($2) OR lower(payload->>'name_ko')=lower($2))) LIMIT 3",[x.id,x.name]);
if(q.rowCount)throw Error('Existing CMS identity '+x.id+': '+q.rows.map(r=>r.id));}
console.log(JSON.stringify({ready:items.map(x=>x.id)}));}finally{await p.end();}})().catch(e=>{console.error(e.message);process.exitCode=1});'''
    return remote_node(js)


def db_publish(items):
    js = 'const items=' + json.dumps(items, ensure_ascii=False) + ';' + r'''
const {Pool}=require('pg');
(async()=>{const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});const c=await p.connect();
try{await c.query('BEGIN');for(const x of items){
 const duplicate=await c.query("SELECT id FROM semologo.logo_posts WHERE id=$1 OR (status='published' AND (lower(payload->>'name_en')=lower($2) OR lower(payload->>'name_ko')=lower($2))) LIMIT 3 FOR UPDATE",[x.id,x.name]);
 if(duplicate.rowCount)throw Error('Concurrent CMS duplicate '+x.id);
 const q=await c.query("INSERT INTO semologo.logo_posts(id,payload,status) VALUES($1,$2::jsonb,'published') RETURNING id",[x.id,JSON.stringify(x.brand)]);
 if(q.rowCount!==1)throw Error('CMS insert failed '+x.id);
 const v=await c.query('SELECT id FROM semologo.logo_versions WHERE brand_id=$1 AND is_current FOR UPDATE',[x.id]);
 if(v.rowCount!==1)throw Error('Version trigger missing '+x.id);
 await c.query('UPDATE semologo.logo_versions SET asset_manifest=$2::jsonb,review_status=$3,verified_at=now() WHERE id=$1',[v.rows[0].id,JSON.stringify({variants:x.variants}),'verified']);
}await c.query('COMMIT');console.log(JSON.stringify({published:items.map(x=>x.id)}));
}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();await p.end();}})().catch(e=>{console.error(e.message);process.exitCode=1});'''
    return remote_node(js)


def existing(s3, key):
    try:
        return s3.get_object(Bucket=BUCKET, Key=key)['Body'].read()
    except ClientError as error:
        if error.response.get('Error', {}).get('Code') in ('404', 'NoSuchKey', 'NotFound'):
            return None
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--manifest', type=Path, default=MANIFEST)
    parser.add_argument('--assets', type=Path, default=ASSETS)
    parser.add_argument('--expected-count', type=int, default=6)
    parser.add_argument('--provider', default='wikimedia-commons')
    parser.add_argument('--source-note', default='Wikimedia Commons original SVG; company identity independently checked')
    args = parser.parse_args()
    rows = json.loads(args.manifest.read_text())['items']
    assert len(rows) == args.expected_count and len({x['id'] for x in rows}) == len(rows)
    timestamp = datetime.now(timezone.utc).isoformat()
    prepared, objects = [], []
    for row in rows:
        ident = row['id']
        assert re.fullmatch(r'[a-z0-9-]+', ident)
        svg = (args.assets / row['sourceFile']).read_bytes()
        assert sha(svg) == row['sha256'] and len(svg) < 150_000
        assert re.search(br'<svg(?:\s|>)', svg[:1000], re.I)
        assert not re.search(br'<(?:image|script|foreignObject)\b|data:image/|javascript:|\bonload\s*=', svg, re.I)
        png = cairosvg.svg2png(bytestring=svg, output_width=1200)
        with Image.open(io.BytesIO(png)) as image:
            assert image.width == 1200 and image.height >= 100
            assert image.convert('RGBA').getchannel('A').getextrema() == (0, 255)
        brand = {'id': ident, 'name_ko': row['name'], 'name_en': row['name'],
            'category': row['category'], 'origin': 'GLOBAL', 'has_svg': True,
            'has_png': True, 'logo_svg': 'logo.svg', 'logo_png': 'logo.png',
            'preview_png': f'{CDN}/{ident}/logo.png',
            'website': row.get('website', f'https://www.{row["domain"]}/'), 'domain': row['domain'],
            'source_url': row['sourcePage'], 'asset_origin': args.source_note,
            'asset_review_status': ('reviewed-first-party-vector' if args.provider == 'first-party-web'
                                    else 'reviewed-third-party-vector'),
            'added_at': timestamp[:10], 'logo_published_at': timestamp}
        variant = {'schema': 1, 'algo_v': 1, 'id': ident, 'primary': 'source-reviewed',
            'variants': [{'key': 'source-reviewed', 'form': row.get('form', 'horizontal'),
                'lockup': row.get('form', 'horizontal'), 'lang': 'mixed', 'color': 'original',
                'label': '원본 벡터', 'files': {'svg': 'logo.svg', 'png': 'logo.png'},
                'preview_png': 'logo.png', 'origin': args.provider,
                'provider': args.provider, 'source_url': row['sourcePage'],
                'source_sha256': sha(svg), 'visual_sha256': sha(png),
                'review_status': 'verified', 'order': 0}]}
        prepared.append({'id': ident, 'name': row['name'], 'brand': brand, 'variants': variant})
        for name, raw, mime in [('logo.svg', svg, 'image/svg+xml'),
                ('logo.png', png, 'image/png'), ('logo-transparent.png', png, 'image/png'),
                ('brand.json', (json.dumps(brand, ensure_ascii=False, separators=(',', ':'))+'\n').encode(), 'application/json'),
                ('variants.json', (json.dumps(variant, ensure_ascii=False, separators=(',', ':'))+'\n').encode(), 'application/json')]:
            objects.append((f'_clients/{ident}/{name}', raw, mime))
    db_check(rows)
    base = json.loads((ROOT/'marketing/assets/bulk-source-pilot-20261017/brands-slim.json').read_text())
    base = base.get('brands', base) if isinstance(base, dict) else base
    assert not {x['id'] for x in prepared}.intersection(x['id'] for x in base)
    if not args.apply:
        print(json.dumps({'status': 'ready', 'newBrands': len(prepared), 'objects': len(objects)}))
        return
    secret = credentials()
    s3 = boto3.client('s3', endpoint_url='https://kr.object.ncloudstorage.com',
        region_name='kr-standard', aws_access_key_id=secret['NCP_ACCESS_KEY'],
        aws_secret_access_key=secret['NCP_SECRET_KEY'], config=Config(signature_version='s3v4'))
    for key, raw, mime in objects:
        prior = existing(s3, key)
        if prior is None:
            s3.put_object(Bucket=BUCKET, Key=key, Body=raw, ACL='public-read',
                ContentType=mime, CacheControl='public,max-age=300', Metadata={'sha256': sha(raw)})
        elif prior != raw:
            raise RuntimeError('Existing asset conflict: '+key)
        if existing(s3, key) != raw:
            raise RuntimeError('Bucket readback mismatch: '+key)
    for row in prepared:
        for name in ('logo.svg', 'logo.png', 'brand.json'):
            url = f'{CDN}/{row["id"]}/{name}?v=20261017-commons'
            result = subprocess.run(['curl', '-fsSL', '--max-time', '30', '-A', 'Mozilla/5.0',
                '-e', 'https://semologo.com/', url], capture_output=True, check=True)
            expected = next(raw for key, raw, _ in objects if key == f'_clients/{row["id"]}/{name}')
            if result.stdout != expected:
                raise RuntimeError('CDN readback mismatch: '+row['id']+'/'+name)
    result = db_publish(prepared)
    print(json.dumps({'status': 'published', 'ids': result['published'], 'verifiedObjects': len(objects)}))


if __name__ == '__main__':
    main()

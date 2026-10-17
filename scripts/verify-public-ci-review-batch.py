#!/usr/bin/env python3
"""Verify visually reviewed public-institution memberships against live assets.

Dry-run by default. The reviewed manifest is an explicit human selection from
paired CMS/official images; this script rechecks both files before DB mutation.
"""
import argparse
import concurrent.futures
import hashlib
import json
import re
import runpy
from pathlib import Path

import boto3
import requests
from botocore.config import Config

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'data/collection/public-ci-roster-reviewed-20261017.json'
HELP = runpy.run_path(str(ROOT / 'scripts/publish-commons-taiwan-new-20261017.py'))
REVIEW = runpy.run_path(str(ROOT / 'scripts/prepare-public-ci-roster-review.py'))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=Path, default=MANIFEST)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--workers', type=int, default=10)
    args = parser.parse_args()
    if not 1 <= args.workers <= 12:
        parser.error('workers must be 1..12')
    review = json.loads(args.manifest.read_text())
    allow_legal_alias = review.get('method') == 'legal-prefix-alias'
    items = review['items']
    if len({x['member_key'] for x in items}) != len(items):
        raise ValueError('Duplicate member in reviewed manifest')
    keys = HELP['credentials']()
    s3 = boto3.client('s3', endpoint_url='https://kr.object.ncloudstorage.com',
                      region_name='kr-standard', aws_access_key_id=keys['NCP_ACCESS_KEY'],
                      aws_secret_access_key=keys['NCP_SECRET_KEY'],
                      config=Config(signature_version='s3v4',
                                    request_checksum_calculation='when_required'))

    def check(row):
        ident = row['exact_candidates'][0]
        try:
            asset = s3.head_object(Bucket='vibers-bucket', Key=f'_clients/{ident}/logo.png')
            if asset['ContentType'] != 'image/png' or asset['ContentLength'] < 100:
                raise ValueError('published-png-missing')
            source = requests.get(row['asset_url'], timeout=16,
                                  headers={'User-Agent': 'Mozilla/5.0 SemoLogo-official-ci-review/1.0',
                                           'Referer': row['source_page']})
            source.raise_for_status()
            if len(source.content) != row['source_bytes'] or len(source.content) > 4_000_000:
                raise ValueError('official-asset-changed')
            REVIEW['decode'](source.content, row['asset_url'])
            digest = hashlib.sha256(source.content).hexdigest()
            if row.get('official_sha256') and digest != row['official_sha256']:
                raise ValueError('official-asset-hash-changed')
            return {'id': ident, 'member_key': row['member_key'], 'name': row['name'],
                    'pair_index': row['pair_index'], 'source_page': row['source_page'],
                    'asset_url': row['asset_url'],
                    'official_sha256': digest,
                    'published_png_bytes': asset['ContentLength']}
        except Exception as error:
            return {'id': ident, 'member_key': row['member_key'],
                    'error': type(error).__name__ + ': ' + str(error)[:120]}

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        checked = list(pool.map(check, items))
    ready = [x for x in checked if 'error' not in x]
    failed = [x for x in checked if 'error' in x]
    print(json.dumps({'selected': len(items), 'ready': len(ready), 'failed': failed},
                     ensure_ascii=False))
    if not ready:
        return
    js = ('const rows=' + json.dumps(ready, ensure_ascii=False) + ';const APPLY=' +
          ('true' if args.apply else 'false') + ';const EVIDENCE=' +
          json.dumps(str(args.manifest.resolve().relative_to(ROOT))) + ';const ALLOW_LEGAL_ALIAS=' +
          ('true' if allow_legal_alias else 'false') + ';') + r'''
const {Pool}=require('pg');
(async()=>{const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});const d=await p.connect();
try{await d.query('BEGIN');const sid=await d.query("select id from semologo.collection_snapshots where collection_id='kr-local-invested-institutions' order by as_of desc,id desc limit 1");if(sid.rowCount!==1)throw Error('Roster unavailable');
const before=await d.query("select count(*)::int verified from semologo.collection_members m join semologo.logo_posts p on p.id=m.brand_id where m.snapshot_id=$1 and m.review_status='verified' and m.metadata->>'png_verified'='true' and p.status='published'",[sid.rows[0].id]);
for(const x of rows){
const q=await d.query("select m.name,m.brand_id,m.review_status,m.metadata,p.status,p.payload from semologo.collection_members m join semologo.logo_posts p on p.id=$3 where m.snapshot_id=$1 and m.member_key=$2 for update of m",[sid.rows[0].id,x.member_key,x.id]);if(q.rowCount!==1)throw Error('Missing roster/post: '+x.id);
const r=q.rows[0];const norm=v=>String(v||'').toLowerCase().replace(/[^가-힣a-z0-9]/g,'');
const legalNorm=v=>norm(v).replace(/^(재단법인|사단법인|주식회사|유한회사|사회복지법인|공익재단법인)/,'');
const equal=ALLOW_LEGAL_ALIAS?legalNorm(r.payload.name_ko)===legalNorm(x.name):norm(r.payload.name_ko)===norm(x.name);
if(r.status!=='published'||norm(r.name)!==norm(x.name)||!equal||r.payload.metadata?.has_png!==true||r.brand_id)throw Error('Identity or membership changed: '+x.id);
if(APPLY){const metadata={...(r.metadata||{}),brand_id:x.id,identity_reviewed:true,png_verified:true,official_source_page:x.source_page,official_asset_url:x.asset_url,official_asset_sha256:x.official_sha256,published_png_bytes:x.published_png_bytes,review_evidence:EVIDENCE+'#pair-'+x.pair_index,reviewed_at:'2026-10-17'};
const u=await d.query("update semologo.collection_members set brand_id=$3,review_status='verified',metadata=$4::jsonb where snapshot_id=$1 and member_key=$2 and brand_id is null returning member_key",[sid.rows[0].id,x.member_key,x.id,JSON.stringify(metadata)]);if(u.rowCount!==1)throw Error('Concurrent member edit: '+x.id);}}
const after=await d.query("select count(*)::int verified from semologo.collection_members m join semologo.logo_posts p on p.id=m.brand_id where m.snapshot_id=$1 and m.review_status='verified' and m.metadata->>'png_verified'='true' and p.status='published'",[sid.rows[0].id]);
if(APPLY)await d.query('COMMIT');else await d.query('ROLLBACK');console.log(JSON.stringify({ready:rows.length,applied:APPLY,before:before.rows[0].verified,after:after.rows[0].verified}));
}catch(e){await d.query('ROLLBACK');throw e;}finally{d.release();await p.end()}})().catch(e=>{console.error(e.message);process.exit(1)});
'''
    print(json.dumps(HELP['remote_node'](js), ensure_ascii=False))


if __name__ == '__main__':
    main()

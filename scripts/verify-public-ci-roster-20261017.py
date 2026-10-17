#!/usr/bin/env python3
"""Link visually confirmed existing PNGs to the latest official institution roster.

The allowlist is intentionally manual: an exact institution name alone does not
prove that the catalog image belongs to it. Run without --apply to preview.
"""
import argparse
import json
import runpy
from pathlib import Path

import boto3
from botocore.config import Config

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'marketing/assets/public-ci-roster-verify-20261017/candidates.json'
HELP = runpy.run_path(str(ROOT / 'scripts/publish-commons-taiwan-new-20261017.py'))

# Compared in paired contact sheets against the current official-site image.
# Parent-city marks, changed logos, and ambiguous identities are omitted.
REVIEWED = '''0388 0279 0236 0446 0537 0144 0264 1209 0250 1106 1234
1102 0255 0278 1222 0289 1167 0282 0310 0218 1092 1337
0231 0856 1595 0857 0866 0494 0493 0495 1253 1227 1323
0476 0449 0461 0450 0451 0464 0489 0522 0520 0485 0466
0467 0487 0488 0459 0460 1291 0589 0588 0569 0572 1502
0557 0594 0575 0566 0558 0563 0564 0551 0013 1521 0006
0023 1513 0004 0091 0056 0059 0073 0062 0055'''.split()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    candidates = {row['id']: row for row in json.loads(SOURCE.read_text())}
    ids = ['gongu-ci-' + suffix for suffix in REVIEWED]
    if len(set(ids)) != len(ids) or not set(ids) <= set(candidates):
        raise ValueError('Reviewed IDs are duplicated or absent from visual evidence')
    rows = []
    for ident in ids:
        candidate = candidates[ident]
        if not candidate.get('assetUrl') or not candidate.get('sourcePage') or not candidate.get('sourceBytes'):
            raise ValueError('Incomplete official-site evidence: ' + ident)
        for collection_id, member_key in candidate['members']:
            rows.append({'id': ident, 'name': candidate['name'],
                         'collection_id': collection_id, 'member_key': member_key,
                         'asset_url': candidate['assetUrl'],
                         'source_page': candidate['sourcePage'],
                         'source_bytes': candidate['sourceBytes']})
    keys = HELP['credentials']()
    s3 = boto3.client('s3', endpoint_url='https://kr.object.ncloudstorage.com',
                      region_name='kr-standard', aws_access_key_id=keys['NCP_ACCESS_KEY'],
                      aws_secret_access_key=keys['NCP_SECRET_KEY'],
                      config=Config(signature_version='s3v4',
                                    request_checksum_calculation='when_required'))
    for ident in ids:
        obj = s3.head_object(Bucket='vibers-bucket', Key=f'_clients/{ident}/logo.png')
        if obj['ContentLength'] <= 0 or obj['ContentType'] != 'image/png':
            raise ValueError('Published PNG missing: ' + ident)
    js = ('const rows=' + json.dumps(rows, ensure_ascii=False) + ';const APPLY=' +
          ('true' if args.apply else 'false') + ';') + r'''
const {Pool}=require('pg');
(async()=>{const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});const d=await p.connect();
try{await d.query('BEGIN');
const before=await d.query("select s.collection_id,count(*)::int total,count(*) filter(where m.review_status='verified' and m.metadata->>'png_verified'='true' and p.status='published')::int verified from semologo.collection_snapshots s join semologo.collection_members m on m.snapshot_id=s.id left join semologo.logo_posts p on p.id=m.brand_id where s.id in(select distinct on(collection_id) id from semologo.collection_snapshots order by collection_id,as_of desc,id desc) and s.collection_id=any($1) group by s.collection_id",[[...new Set(rows.map(x=>x.collection_id))]]);
for(const x of rows){
const q=await d.query("select m.snapshot_id,m.member_key,m.name,m.brand_id,m.review_status,m.metadata,p.status,p.payload from semologo.collection_snapshots s join semologo.collection_members m on m.snapshot_id=s.id join semologo.logo_posts p on p.id=$3 where s.collection_id=$1 and m.member_key=$2 and s.id=(select id from semologo.collection_snapshots where collection_id=$1 order by as_of desc,id desc limit 1) for update of m",[x.collection_id,x.member_key,x.id]);
if(q.rowCount!==1)throw Error('Latest member or published brand missing: '+x.id);
const r=q.rows[0];
const norm=v=>String(v||'').toLowerCase().replace(/[^가-힣a-z0-9]/g,'');
if(r.status!=='published'||norm(r.name)!==norm(x.name)||norm(r.payload.name_ko)!==norm(x.name)||r.payload.metadata?.has_png!==true)throw Error('Identity/PNG precondition: '+x.id);
if(r.brand_id && r.brand_id!==x.id)throw Error('Conflicting membership: '+x.id);
if(r.review_status==='verified' && r.metadata?.png_verified===true)throw Error('Already verified: '+x.id);
if(APPLY){
const metadata={...(r.metadata||{}),brand_id:x.id,identity_reviewed:true,png_verified:true,official_source_page:x.source_page,official_asset_url:x.asset_url,official_asset_bytes:x.source_bytes,review_evidence:'scripts/verify-public-ci-roster-20261017.py',reviewed_at:'2026-10-17'};
const u=await d.query("update semologo.collection_members set brand_id=$3,review_status='verified',metadata=$4::jsonb where snapshot_id=$1 and member_key=$2 and (brand_id is null or brand_id=$3) returning member_key",[r.snapshot_id,r.member_key,x.id,JSON.stringify(metadata)]);
if(u.rowCount!==1)throw Error('Concurrent membership edit: '+x.id);
}}
const after=await d.query("select s.collection_id,count(*)::int total,count(*) filter(where m.review_status='verified' and m.metadata->>'png_verified'='true' and p.status='published')::int verified from semologo.collection_snapshots s join semologo.collection_members m on m.snapshot_id=s.id left join semologo.logo_posts p on p.id=m.brand_id where s.id in(select distinct on(collection_id) id from semologo.collection_snapshots order by collection_id,as_of desc,id desc) and s.collection_id=any($1) group by s.collection_id",[[...new Set(rows.map(x=>x.collection_id))]]);
if(APPLY)await d.query('COMMIT');else await d.query('ROLLBACK');
console.log(JSON.stringify({ready:rows.length,applied:APPLY,before:before.rows,after:after.rows}));
}catch(e){await d.query('ROLLBACK');throw e;}finally{d.release();await p.end()}})().catch(e=>{console.error(e.message);process.exit(1)});
'''
    print(json.dumps(HELP['remote_node'](js), ensure_ascii=False))


if __name__ == '__main__':
    main()

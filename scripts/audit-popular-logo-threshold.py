#!/usr/bin/env python3
"""Review every published logo with at least N recorded detail opens.

The site's popular order uses weighted first-party logo_hits, not GA4's Data API.
This script reads that same table, then checks the currently served assets.
It queues missing forms as review candidates; it never invents a logo variant.
"""
import argparse
import datetime as dt
import io
import json
import re
import subprocess
from pathlib import Path
from urllib.request import Request, urlopen

from PIL import Image

from logo_variant_enrichment import SLOTS, coverage

ROOT = Path(__file__).resolve().parents[1]
CDN = 'https://logo.vibers.co.kr/_clients'


def remote_rows(min_views):
    js = r'''
const {Client}=require('pg');(async()=>{const db=new Client({connectionString:process.env.DB_VIBERS_MAIN_URL});
await db.connect();try{const q=await db.query(`SELECT h.brand_id id,h.hit_count::int views,
SUM(x.hit_count*CASE x.hit_type WHEN 'download' THEN 10 WHEN 'ad' THEN 5
WHEN 'view' THEN 3 WHEN 'search' THEN 2 WHEN 'dwell' THEN 2 ELSE 0 END)::int score,
p.payload->>'name_ko' name,p.payload->>'asset_review_status' asset_review_status,
p.payload->>'official_source_page' official_source_page,p.payload->>'logo_svg' logo_svg,
p.payload->>'asset_origin' asset_origin,
p.payload->>'logo_published_at' logo_published_at,
p.payload->>'logo_png' logo_png,p.payload->'presentation' presentation,
v.review_status version_review_status,v.asset_manifest->'variants' manifest
FROM semologo.logo_hits h JOIN semologo.logo_hits x ON x.brand_id=h.brand_id
JOIN semologo.logo_posts p ON p.id=h.brand_id AND p.status='published'
LEFT JOIN semologo.logo_versions v ON v.brand_id=h.brand_id AND v.is_current
WHERE h.hit_type='view' AND h.hit_count>=$1
GROUP BY h.brand_id,h.hit_count,p.payload,v.review_status,v.asset_manifest
ORDER BY score DESC,h.brand_id`,[Number(process.argv[2])]);console.log(JSON.stringify(q.rows));}
finally{await db.end()}})().catch(e=>{console.error(e.message);process.exitCode=1});'''
    result = subprocess.run(['ssh', 'vibers', 'docker', 'exec', '-i', 'semologo', 'node', '-', str(min_views)],
                            input=js, text=True, capture_output=True, check=True)
    return json.loads(result.stdout)


def fetch(url):
    request = Request(url, headers={'User-Agent': 'SemoLogoQualityAudit/1.0'})
    with urlopen(request, timeout=15) as response:
        return response.read(10_000_001)


def check_file(brand_id, path):
    if path is True:
        path = 'logo.png'
    if not isinstance(path, str) or not path:
        return {'path': path, 'ok': False, 'reason': 'missing-path'}
    url = path if path.startswith('https://') else f'{CDN}/{brand_id}/{path}'
    try:
        data = fetch(url)
        if len(data) > 10_000_000:
            return {'path': path, 'ok': False, 'reason': 'too-large'}
        if path.lower().split('?')[0].endswith('.svg'):
            good = bool(re.search(rb'<svg\b', data)) and not re.search(rb'<(?:script|foreignObject)\b|javascript:', data, re.I)
            return {'path': path, 'ok': good, 'bytes': len(data), 'format': 'svg'}
        with Image.open(io.BytesIO(data)) as image:
            image.load()
            alpha = image.convert('RGBA').getchannel('A')
            bbox = alpha.getbbox()
            return {'path': path, 'ok': True, 'format': image.format,
                    'size': [image.width, image.height], 'transparent': alpha.getextrema()[0] < 255,
                    'alpha_bbox_ratio': round(((bbox[2]-bbox[0])*(bbox[3]-bbox[1]))/(image.width*image.height), 3) if bbox else 0}
    except Exception as error:
        return {'path': path, 'ok': False, 'reason': type(error).__name__}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--min-views', type=int, default=10)
    parser.add_argument('--out', type=Path, default=Path('/Volumes/HDD-1TB/semologo-migration/popular-over10-20261019/audit.json'))
    args = parser.parse_args()
    if not 1 <= args.min_views <= 10000:
        parser.error('min-views must be between 1 and 10000')
    ledger_path = ROOT / 'ops/evidence/popular-logo-review-ledger-20261019.json'
    ledger_data = json.loads(ledger_path.read_text()) if ledger_path.exists() else {}
    ledger = ledger_data.get('items', {})
    items = []
    for row in remote_rows(args.min_views):
        brand_id = row['id']
        manifest = row.pop('manifest')
        if not isinstance(manifest, dict) or not isinstance(manifest.get('variants'), list):
            try:
                manifest = json.loads(fetch(f'{CDN}/{brand_id}/variants.json'))
            except Exception:
                manifest = None
        forms = coverage(manifest) if manifest else None
        path = (row.get('presentation') or {}).get('file') or row.get('logo_png') or 'logo.png'
        primary = check_file(brand_id, path)
        svg = check_file(brand_id, row['logo_svg']) if isinstance(row['logo_svg'], str) and row['logo_svg'] else None
        issues = []
        if not primary['ok']:
            issues.append('broken-primary')
        if svg and not svg['ok']:
            issues.append('broken-svg')
        supplied_original = (row.get('asset_origin') or '').startswith('사용자 제공')
        if not row['official_source_page'] and not (supplied_original and row['asset_review_status'] == 'verified'):
            issues.append('official-source-unconfirmed')
        if row['asset_review_status'] != 'verified' or row['version_review_status'] != 'verified':
            issues.append('review-pending')
        if not forms:
            issues.append('manifest-missing')
        reviewed_once = brand_id in ledger
        if reviewed_once and row.get('logo_published_at'):
            reviewed_once = row['logo_published_at'][:10] <= ledger_data.get('reviewed_at', '')
        items.append({**row, 'primary_asset': primary, 'svg_asset': svg,
                      'present_forms': {slot: forms['present'][slot] for slot in SLOTS} if forms else None,
                      'missing_forms': forms['missing'] if forms else list(SLOTS), 'issues': issues,
                      'reviewed_once': reviewed_once,
                      'review_result': ledger.get(brand_id, {}).get('result')})
    report = {'generated_at': dt.datetime.now(dt.timezone.utc).isoformat(),
              'threshold': {'source': 'semologo.logo_hits', 'hit_type': 'view', 'minimum': args.min_views,
                            'order': 'same weighted score as /api/popularity',
                            'note': 'Lifetime first-party hit counter; not unique users or GA4 sessions.'},
              'count': len(items), 'unreviewed_count': sum(not item['reviewed_once'] for item in items),
              'items': items}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    with (args.out.parent / 'audit-history.jsonl').open('a') as history:
        history.write(json.dumps({'at': report['generated_at'], 'count': report['count'],
                                  'unreviewed_count': report['unreviewed_count']}) + '\n')
    print(json.dumps({'count': len(items), 'unreviewed_count': report['unreviewed_count'],
                      'items': [(r['id'], r['views'], r['issues'], r['missing_forms']) for r in items]}, ensure_ascii=False))


if __name__ == '__main__':
    main()

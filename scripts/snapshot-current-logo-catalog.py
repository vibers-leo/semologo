#!/usr/bin/env python3
"""Refresh private CMS catalog for the next full enrichment/sweep cycle."""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--catalog', required=True, type=Path)
    parser.add_argument('--sweep', required=True, type=Path)
    args = parser.parse_args()
    source = r'''const {Pool}=require('pg');(async()=>{const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});try{const q=await p.query("select p.id,p.payload->>'name_ko' name_ko,p.payload->>'name_en' name_en,p.payload->>'domain' domain,p.payload->>'website' website,coalesce(p.payload->>'has_png',p.payload->'metadata'->>'has_png') has_png,coalesce(p.payload->>'has_svg',p.payload->'metadata'->>'has_svg') has_svg,p.payload->>'logo_png' logo_png,p.payload->>'logo_svg' logo_svg,v.asset_manifest->'variants' variant_manifest from semologo.logo_posts p left join semologo.logo_versions v on v.brand_id=p.id and v.is_current where p.status='published' order by p.id");console.log(JSON.stringify(q.rows))}finally{await p.end()}})().catch(e=>{console.error(e.message);process.exit(1)})'''
    result = subprocess.run(['ssh', 'vibers', 'docker exec -i semologo node -'],
                            input=source, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError('CMS catalog unavailable: ' + result.stderr.strip()[:300])
    rows = json.loads(result.stdout)
    if len(rows) < 100_000 or len({row['id'] for row in rows}) != len(rows):
        raise ValueError('Unexpected catalog size or duplicate identity')
    sweep = sorted(rows, key=lambda row: hashlib.sha256(row['id'].encode()).digest())
    for path, data in ((args.catalog, rows), (args.sweep, sweep)):
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(path.suffix + '.tmp')
        temporary.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
        temporary.replace(path)
    print(json.dumps({'catalog': len(rows), 'sweep': len(sweep)}))


if __name__ == '__main__':
    main()

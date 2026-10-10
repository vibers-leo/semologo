"""Merge freshly published variants before appending another reviewed source."""
import argparse, json, subprocess
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--release-dir', type=Path, required=True)
args = parser.parse_args()
folder = args.release_dir
release = json.loads((folder / 'release.json').read_text())
script = 'const ids=' + json.dumps(list(release['variants'])) + ';' + r'''
const {Pool}=require('pg');(async()=>{const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});try{const r=await p.query('SELECT brand_id,asset_manifest FROM semologo.logo_versions WHERE brand_id=ANY($1) AND is_current',[ids]);console.log(JSON.stringify(r.rows));}finally{await p.end();}})().catch(e=>{console.error(e.message);process.exitCode=1});
'''
result = subprocess.run(['ssh', 'vibers', 'docker exec -i semologo node -'], input=script, text=True, capture_output=True, check=True)
for row in json.loads(result.stdout):
    manifest = release['variants'][row['brand_id']]
    previous = (row['asset_manifest'] or {}).get('variants') or {}
    variants = list(previous.get('variants', []))
    for variant in manifest['variants']:
        old = next((v for v in variants if v['key'] == variant['key']), None)
        if old:
            assert old['files'] == variant['files'], 'Conflicting variant identity: ' + row['brand_id']
        else:
            variants.append(variant)
    manifest['variants'] = variants
    if previous.get('primary'):
        manifest['primary'] = previous['primary']
    release['patches'][row['brand_id']]['variants_n'] = len(variants)
(folder / 'release.json').write_text(json.dumps(release, ensure_ascii=False, indent=2) + '\n')
print('PASS refreshed manifests', len(release['variants']))

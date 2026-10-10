"""Expose newly published variations in latest ordering without replacing artwork."""
import argparse
import datetime
import json
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--release-dir', type=Path, action='append', required=True)
args = parser.parse_args()
for folder in args.release_dir:
    folder = folder.resolve()
    assert folder.is_relative_to(root / 'marketing/assets')
    assert folder.name.startswith('figma-better-')
    assert (folder / 'published.json').exists()
    verified = json.loads((folder / 'cdn-verification.json').read_text())
    assert verified and all(row['cdn_verified'] for row in verified)
    release = json.loads((folder / 'release.json').read_text())
    stamp_file = folder / 'publication-timestamps.json'
    stamps = json.loads(stamp_file.read_text()) if stamp_file.exists() else {
        bid: datetime.datetime.now(datetime.timezone.utc).isoformat()
        for bid in release['patches']
    }
    assert set(stamps) == set(release['variants'])
    script = 'const stamps=' + json.dumps(stamps) + ';' + r'''
const {Pool}=require('pg');
(async()=>{const pool=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});const db=await pool.connect();
try{await db.query('BEGIN');for(const [id,stamp] of Object.entries(stamps)){
const q=await db.query('SELECT payload,status FROM semologo.logo_posts WHERE id=$1 FOR UPDATE',[id]);
if(q.rowCount!==1||q.rows[0].status!=='published'||q.rows[0].payload.hidden||q.rows[0].payload.merged_into)throw Error('Canonical guard '+id);
const previous=q.rows[0].payload.logo_published_at;
if(!previous||Date.parse(previous)<Date.parse(stamp))await db.query('UPDATE semologo.logo_posts SET payload=payload||$2::jsonb,updated_at=now() WHERE id=$1',[id,JSON.stringify({logo_published_at:stamp})]);
}await db.query('COMMIT');console.log('PASS new-variation publication dates',Object.keys(stamps).length);
}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();await pool.end();}})().catch(e=>{console.error(e.message);process.exitCode=1});
'''
    subprocess.run(['ssh','vibers','docker exec -i semologo node -'], input=script, text=True, check=True)
    stamp_file.write_text(json.dumps(stamps, indent=2) + '\n')
    for bid, stamp in stamps.items():
        release['patches'][bid]['logo_published_at'] = stamp
    (folder / 'release.json').write_text(json.dumps(release, ensure_ascii=False, indent=2) + '\n')

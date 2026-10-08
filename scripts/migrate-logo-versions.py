"""Idempotently archive every CMS record; unknown design years stay NULL."""
from pathlib import Path
import subprocess
root=Path(__file__).resolve().parents[1];sql=(root/'scripts/logo-version-schema.sql').read_text()
import json
script='const sql='+json.dumps(sql)+';'+r'''const {Pool}=require('pg');(async()=>{const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});try{await p.query(sql);const r=await p.query("SELECT (SELECT count(*) FROM semologo.logo_posts)::int brands,count(DISTINCT brand_id)::int archived_brands,count(*) FILTER(WHERE is_current)::int current_versions,count(*) FILTER(WHERE introduced_year IS NOT NULL)::int known_years FROM semologo.logo_versions");console.log(JSON.stringify(r.rows[0]));if(r.rows[0].brands!==r.rows[0].archived_brands||r.rows[0].brands!==r.rows[0].current_versions)throw Error('Incomplete backfill');}finally{await p.end();}})().catch(e=>{console.error(e.message);process.exitCode=1});'''
subprocess.run(['ssh','vibers','docker exec -i semologo node -'],input=script,text=True,check=True)

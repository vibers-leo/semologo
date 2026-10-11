"""Correct reviewed language metadata without replacing any asset or variant."""
import json,subprocess,shlex
from pathlib import Path
import boto3
from botocore.config import Config
R=Path(__file__).resolve().parents[1];D=R/'marketing/assets/requested-finance-business-20261011';release=json.loads((D/'release.json').read_text());changes={}
for bid in ['sk-securities','gsretail']:
 m=release['variants'][bid]
 for v in m['variants']:v['lang']='en' if v['key'].endswith('-en') else 'ko'
 changes[bid]=m
script='const manifests='+json.dumps(changes,ensure_ascii=False)+';'+r'''const {Pool}=require('pg');(async()=>{const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});const d=await p.connect();try{await d.query('BEGIN');for(const [id,m]of Object.entries(manifests)){const r=await d.query('SELECT id,asset_manifest FROM semologo.logo_versions WHERE brand_id=$1 AND is_current FOR UPDATE',[id]);if(r.rowCount!==1)throw Error('Current version missing');const before=r.rows[0].asset_manifest;const prior=before.variants;if(prior.variants.length!==m.variants.length)throw Error('Variant preservation guard');for(const v of prior.variants){const n=m.variants.find(x=>x.key===v.key);if(!n||Object.keys(n.files).length!==Object.keys(v.files).length||Object.entries(v.files).some(([k,value])=>n.files[k]!==value))throw Error('File preservation guard');}await d.query('UPDATE semologo.logo_versions SET asset_manifest=$2::jsonb WHERE id=$1',[r.rows[0].id,JSON.stringify({...before,variants:m})]);}await d.query('COMMIT');}catch(e){await d.query('ROLLBACK');throw e;}finally{d.release();await p.end();}})().catch(e=>{console.error(e.message);process.exitCode=1;});'''
subprocess.run(['ssh','vibers','docker exec -i semologo node -'],input=script,text=True,check=True)
env={}
for line in Path('/Users/juuuno/Desktop/macminim4/.secrets/보안.env').read_text().splitlines():
 if line.startswith('export '):line=line[7:]
 if '=' not in line:continue
 k,v=line.split('=',1)
 if k in ['NCP_ACCESS_KEY','NCP_SECRET_KEY']:env[k]=shlex.split(v,comments=True)[0]
s3=boto3.client('s3',endpoint_url='https://kr.object.ncloudstorage.com',region_name='kr-standard',aws_access_key_id=env['NCP_ACCESS_KEY'],aws_secret_access_key=env['NCP_SECRET_KEY'],config=Config(signature_version='s3v4',request_checksum_calculation='when_required',response_checksum_validation='when_required'))
for bid,m in changes.items():
 raw=json.dumps(m,ensure_ascii=False).encode();s3.put_object(Bucket='vibers-bucket',Key='_clients/'+bid+'/variants.json',Body=raw,ACL='public-read',ContentType='application/json',CacheControl='public,max-age=300');assert s3.get_object(Bucket='vibers-bucket',Key='_clients/'+bid+'/variants.json')['Body'].read()==raw
for p in [D/'release.json',R/'src/lib/reviewed-requested-business-20261011.json']:p.write_text(json.dumps(release,ensure_ascii=False,indent=2)+'\n')
print('PASS language metadata; existing files and all variant keys preserved')

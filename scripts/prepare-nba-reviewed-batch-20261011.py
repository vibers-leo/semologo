"""Prepare two visually reviewed official NBA variants, preserving current manifests."""
from pathlib import Path
import copy, datetime, hashlib, json, re, subprocess, shlex
import boto3
from botocore.exceptions import ClientError
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT/'marketing/assets/sports-official-20261011/nba'
OUT = BASE/'release'
OUT.mkdir(exist_ok=True)
ids = ['boston-celtics', 'la-clippers']
js = 'const ids='+json.dumps(ids)+';'+'''const {Pool}=require('pg');(async()=>{const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1,connectionTimeoutMillis:5000});try{const r=await p.query("SELECT p.id,p.status,p.payload,v.asset_manifest FROM semologo.logo_posts p LEFT JOIN semologo.logo_versions v ON v.brand_id=p.id AND v.is_current WHERE p.id=ANY($1)",[ids]);console.log(JSON.stringify(r.rows))}finally{await p.end()}})().catch(e=>{console.error(e.message);process.exitCode=1});'''
rows = json.loads(subprocess.run(['ssh','vibers','docker exec -i semologo node -'],input=js,text=True,capture_output=True,check=True).stdout)
assert len(rows)==2 and {r['id'] for r in rows}==set(ids)
(OUT/'cms-before.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
release={'patches':{},'variants':{}}
uploads=[]
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
for row in rows:
    id=row['id']; assert row['status']=='published' and not row['payload'].get('hidden') and not row['payload'].get('merged_into')
    official_id={'boston-celtics':'1610612738','la-clippers':'1610612746'}[id]
    response=subprocess.run(['curl','--http1.1','-fsS','--max-time','25',f'https://logo.vibers.co.kr/_clients/{id}/variants.json'],capture_output=True)
    if response.returncode:
        assert response.returncode==22 and b'404' in response.stderr and not row.get('asset_manifest'), 'Unknown previous manifest; stop'
        env={}
        for line in Path('/Users/juuuno/Desktop/macminim4/.secrets/보안.env').read_text().splitlines():
            line=line.removeprefix('export ')
            if '=' not in line: continue
            k,v=line.split('=',1)
            if k in ('NCP_ACCESS_KEY','NCP_SECRET_KEY'): env[k]=shlex.split(v,comments=True)[0]
        client=boto3.client('s3',endpoint_url='https://kr.object.ncloudstorage.com',region_name='kr-standard',aws_access_key_id=env['NCP_ACCESS_KEY'],aws_secret_access_key=env['NCP_SECRET_KEY'])
        try:
            public=json.loads(client.get_object(Bucket='vibers-bucket',Key=f'_clients/{id}/variants.json')['Body'].read())
        except ClientError as error:
            assert error.response['Error']['Code'] in ('NoSuchKey','404'), 'Storage manifest unavailable'
            public={'id':id,'schema':1,'algo_v':1,'primary':'horizontal','variants':[{'key':'horizontal','form':'horizontal','lang':'en','color':'original','files':{'svg':'logo.svg'},'label':'기존 수집 로고','order':0}]}
    else:
        public=json.loads(response.stdout)
    assert public['id']==id and isinstance(public['variants'],list)
    manifest=copy.deepcopy(public)
    cms=row.get('asset_manifest') or {}
    for prior in cms.get('variants',{}).get('variants',[]):
        existing=next((v for v in manifest['variants'] if v['key']==prior['key']),None)
        if existing is None: manifest['variants'].append(copy.deepcopy(prior))
        else: assert existing['files']==prior['files']
    key='official-nba-primary-20261011'
    assert not any(v['key']==key for v in manifest['variants'])
    svg=BASE/(official_id+'.svg'); raw=svg.read_bytes()
    assert not re.search(rb'<(?:image|script|foreignObject)\b|data:image',raw,re.I)
    png=BASE/(id+'-official.png')
    with Image.open(png) as image:
        assert image.mode=='RGBA' and image.getchannel('A').getextrema()==(0,255)
        image.thumbnail((640,640),Image.Resampling.LANCZOS)
        preview=BASE/(id+'-preview.png'); image.save(preview)
    files={}
    for kind,path in [('svg',svg),('png',png),('preview',preview)]:
        blob=path.read_bytes(); sha=hashlib.sha256(blob).hexdigest()
        rel='sources/official-nba-20261011/'+sha[:20]+path.suffix
        uploads.append({'id':id,'file':str(path.relative_to(ROOT)),'key':f'_clients/{id}/{rel}','sha256':sha,'bytes':len(blob)})
        files[kind]=rel
    manifest['variants'].append({'key':key,'form':'emblem','lang':'en','color':'color','files':{'svg':files['svg'],'png':files['png']},'preview_png':files['preview'],'label':'NBA 공식 구단 디렉터리 · 기본 로고','provider':'official-original','official_distribution':True,'order':200,'source_url':f'https://cdn.nba.com/logos/nba/{official_id}/primary/L/logo.svg','source_note':'2026-10-11 NBA 공식 디렉터리에서 확인. 기존 버전과 대표 선택 유지.'})
    release['variants'][id]=manifest
    release['patches'][id]={'variants_n':len(manifest['variants']),'logo_published_at':now}
(OUT/'release.json').write_text(json.dumps(release,ensure_ascii=False,indent=2)+'\n')
(OUT/'uploads.json').write_text(json.dumps(uploads,ensure_ascii=False,indent=2)+'\n')
(OUT/'ready-proof.json').write_text(json.dumps({'status':'ready','source_page':'https://www.nba.com/teams','brands':2,'new_variants':2,'objects':6,'visual_review':'Root compared official/current rendered artwork; Celtics full-color composition and Clippers ship emblem distinct from old variants','existing_cms_and_public_variant_files_preserved':True,'primary_unchanged':True,'published':False},ensure_ascii=False,indent=2)+'\n')
print('PASS NBA2/6objects prepared; previous variants and primary retained')

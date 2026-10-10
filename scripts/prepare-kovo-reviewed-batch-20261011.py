"""Read-only preparation of two reviewed official KOVO vector upgrades."""
from pathlib import Path
import datetime,hashlib,json,re,shlex
import boto3
from botocore.exceptions import ClientError
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'marketing/assets/sports-official-20261011/kbl-kovo'
OUT=BASE/'release';OUT.mkdir(exist_ok=True)
rows=json.loads((BASE/'cms-before.json').read_text());assert {r['id'] for r in rows}=={'pinkspiders','hillstatehdec'}
env={}
for line in Path('/Users/juuuno/Desktop/macminim4/.secrets/보안.env').read_text().splitlines():
 line=line.removeprefix('export ')
 if '=' not in line:continue
 k,v=line.split('=',1)
 if k in ('NCP_ACCESS_KEY','NCP_SECRET_KEY'):env[k]=shlex.split(v,comments=True)[0]
client=boto3.client('s3',endpoint_url='https://kr.object.ncloudstorage.com',region_name='kr-standard',aws_access_key_id=env['NCP_ACCESS_KEY'],aws_secret_access_key=env['NCP_SECRET_KEY'])
release={'patches':{},'variants':{}};uploads=[];now=datetime.datetime.now(datetime.timezone.utc).isoformat()
for row in rows:
 id=row['id'];assert row['status']=='published' and not row['payload'].get('hidden') and not row['payload'].get('merged_into');assert not row['asset_manifest']
 try:
  prior=json.loads(client.get_object(Bucket='vibers-bucket',Key=f'_clients/{id}/variants.json')['Body'].read());raise AssertionError('Existing storage manifest found; review required')
 except ClientError as e:assert e.response['Error']['Code'] in ('NoSuchKey','404')
 code={'pinkspiders':'2004','hillstatehdec':'2001'}[id];svg=BASE/'sources'/f'kovo-{code}-emblem.svg';png=BASE/'previews'/f'kovo-{code}-emblem.png';raw=svg.read_bytes();assert not re.search(rb'<(?:image|script|foreignObject)\b|data:image',raw,re.I)
 with Image.open(png)as im:
  assert im.size==(1024,1024) and im.mode=='RGBA' and im.getchannel('A').getextrema()==(0,255);im.thumbnail((640,640));preview=BASE/'previews'/f'{id}-official-preview.png';im.save(preview)
 files={}
 for kind,path in [('svg',svg),('png',png),('preview',preview)]:
  blob=path.read_bytes();sha=hashlib.sha256(blob).hexdigest();rel='sources/official-kovo-20261011/'+sha[:20]+path.suffix;uploads.append({'id':id,'file':str(path.relative_to(ROOT)),'key':f'_clients/{id}/{rel}','sha256':sha,'bytes':len(blob)});files[kind]=rel
 roster=next(r for r in json.loads((BASE/'kovo-official-roster-assets.json').read_text())if r['code']==code)
 manifest={'id':id,'schema':1,'algo_v':1,'primary':'legacy-original','variants':[{'key':'legacy-original','form':'emblem','lang':'en','color':'original','files':{'png':'logo.png'},'label':'기존 수집 로고','order':0},{'key':'official-kovo-emblem-20261011','form':'emblem','lang':'en','color':'color','files':{'svg':files['svg'],'png':files['png']},'preview_png':files['preview'],'label':'KOVO 공식 구단 엠블럼 · 벡터 원본','provider':'official-site','official_distribution':False,'order':200,'source_url':roster['emblem_url'],'source_note':'KOVO 공식 사이트 구단 API와 CDN에서 확인. 공식 다운로드 패키지로 표기하지 않음. 기존 원본 및 대표 선택 유지.'}]}
 release['variants'][id]=manifest;release['patches'][id]={'variants_n':2,'has_svg':True,'has_png':True,'logo_published_at':now}
(OUT/'cms-before.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n');(OUT/'release.json').write_text(json.dumps(release,ensure_ascii=False,indent=2)+'\n');(OUT/'uploads.json').write_text(json.dumps(uploads,ensure_ascii=False,indent=2)+'\n')
(OUT/'ready-proof.json').write_text(json.dumps({'status':'ready','published':False,'brands':2,'new_variants':2,'objects':6,'source_page':'https://kovo.co.kr/','source_api':'https://user-api.kovo.co.kr/sites?type=CLUB','official_site_assets_not_claimed_download_package':True,'existing_cms_manifest_null':True,'existing_storage_manifest_confirmed_absent':True,'legacy_png_preserved':True,'primary_unchanged':True,'visual_review':'pinkspiders: legacy125x65 same identity now official vector and1024 PNG; hillstatehdec: legacy75x65 gray/white identity preserved, official full-color emblem added. No separate logo/icon canvas-only variants included.'},ensure_ascii=False,indent=2)+'\n')
print('PASS KOVO2 READY /6objects; no upload or DB writes')

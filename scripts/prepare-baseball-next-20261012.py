"""Prepare visually reviewed official NPB and SSG assets, preserving old manifests."""
from pathlib import Path
import json,subprocess,hashlib,re,io,datetime
import cairosvg
from PIL import Image
R=Path(__file__).resolve().parents[1];D=R/'marketing/assets/baseball-official-20261012';O=D/'release-next';O.mkdir(exist_ok=True)
rows=json.loads(Path('/Volumes/HDD-1TB/semologo-migration/task-tmp/baseball-cms.json').read_text());release={'patches':{},'variants':{}};uploads=[]
def manifest(id):
 r=subprocess.run(['curl','--http1.1','-fsSL','--retry','2','--max-time','30','https://logo.vibers.co.kr/_clients/'+id+'/variants.json'],capture_output=True)
 if r.returncode==0:m=json.loads(r.stdout)
 else:
  assert b'404' in r.stderr;m={'schema':1,'id':id,'primary':None,'variants':[]}
 old=next((x for x in rows if x['id']==id),None)
 for p in (((old or {}).get('asset_manifest')or{}).get('variants')or{}).get('variants',[]):
  idx=next((i for i,v in enumerate(m['variants']) if v['key']==p['key']),None)
  if idx is None:m['variants'].append(p)
  else:assert m['variants'][idx]['files']==p['files'];m['variants'][idx]=p
 return m,old
def put(id,p):
 raw=p.read_bytes();sha=hashlib.sha256(raw).hexdigest();file='sources/official-baseball-20261012/'+sha[:20]+p.suffix
 if not any(x['key']=='_clients/'+id+'/'+file for x in uploads):uploads.append({'id':id,'file':str(p.relative_to(R)),'key':'_clients/'+id+'/'+file,'sha256':sha})
 return file
def add(id,m,p,key,label,url,form='symbol',extra=None):
 raw=p.read_bytes();assert b'<svg' in raw and not re.search(rb'<image\b|<script\b|data:image',raw,re.I)
 png=p.with_suffix('.2000.png');cairosvg.svg2png(bytestring=raw,write_to=str(png),output_width=2000)
 im=Image.open(png).convert('RGBA');assert im.getbbox();prev=p.with_suffix('.640.png');im.thumbnail((640,640));im.save(prev)
 files={'svg':put(id,p),'png':put(id,png)};preview=put(id,prev)
 assert not any(v['key']==key for v in m['variants'])
 v={'key':key,'label':label,'form':form,'lang':'unknown','color':'original','files':files,'preview_png':preview,'source_url':url,'origin':'official','official_distribution':True,'order':len(m['variants'])}
 if extra:v.update(extra)
 m['variants'].append(v);return files,preview
teams=[('t','hanshin-tigers','한신 타이거스','Hanshin Tigers'),('g','yomiuri-giants','요미우리 자이언츠','Yomiuri Giants'),('d','chunichi-dragons','주니치 드래곤즈','Chunichi Dragons'),('c','hiroshima-toyo-carp','히로시마 도요 카프','Hiroshima Toyo Carp'),('s','tokyo-yakult-swallows','도쿄 야쿠르트 스왈로즈','Tokyo Yakult Swallows'),('h','fukuoka-softbank-hawks','후쿠오카 소프트뱅크 호크스','Fukuoka SoftBank Hawks'),('b','orix-buffaloes','오릭스 버팔로스','Orix Buffaloes'),('e','tohoku-rakuten-golden-eagles','도호쿠 라쿠텐 골든이글스','Tohoku Rakuten Golden Eagles'),('l','saitama-seibu-lions','사이타마 세이부 라이온스','Saitama Seibu Lions'),('m','chiba-lotte-marines','지바 롯데 마린스','Chiba Lotte Marines'),('f','hokkaido-nippon-ham-fighters','홋카이도 닛폰햄 파이터스','Hokkaido Nippon-Ham Fighters')]
for code,id,ko,en in teams:
 m,old=manifest(id);p=D/'npb'/f'{code}.svg';url='https://www.fighters.co.jp/media/sites/2/top/team_logo-'+code+'.svg' if code!='f' else 'https://www.fighters.co.jp/media/sites/2/common/logo_fighters.svg'
 files,preview=add(id,m,p,'official-npb-20261012','구단 공식 사이트 수록 로고 · 제작 시기 미확인',url, 'wordmark' if code=='f' else 'symbol')
 patch={'logo_published_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'variants_n':len(m['variants']),'aliases':[ko,en,'NPB','일본 프로야구']}
 if not old:
  m['primary']='official-npb-20261012';patch.update(id=id,name_ko=ko,name_en=en,category='스포츠',origin='GLOBAL',has_svg=True,has_png=True,logo_svg=files['svg'],logo_png=files['png'],preview_png='https://logo.vibers.co.kr/_clients/'+id+'/'+preview,light=False,light_logo=False,dark_variant=False,added_at='2026-10-12',asset_origin='구단 공식 사이트',official_source_page='https://npb.jp/teams/',presentation={'file':files['png'],'bg':'light'})
 release['patches'][id]=patch;release['variants'][id]=m;print('prepared',id,flush=True)
id='ssglanders';m,old=manifest(id);assert old
labels={'01_MainLogo(Emblem)':'메인 엠블럼','02_MainLogo(Wordmark)':'워드마크','03_Symbolmark':'심볼마크','04_SubEmblem':'보조 엠블럼','Mascot_Landy':'랜디 마스코트 기본형','Mascot_Poorie':'푸리 마스코트 기본형','Mascot_Batty':'배티 마스코트 기본형'}
for stem,label in labels.items():
 p=D/'ssg/render'/stem/'page-0.svg';add(id,m,p,'official-ssg-'+re.sub('[^a-z0-9]','',stem.lower())+'-20261012',label+' · 공식 AI 추출','https://www.ssglanders.com/landers/emblem','mascot' if stem.startswith('Mascot') else 'symbol')
 # Colored alternate artboards are retained as authored, not background-removed.
 p2=p.with_name('page-1.svg')
 if p2.exists():add(id,m,p2,'official-ssg-'+re.sub('[^a-z0-9]','',stem.lower())+'-reverse-20261012',label+' · 적색 배경 공식 응용형','https://www.ssglanders.com/landers/emblem')
release['patches'][id]={'logo_published_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'variants_n':len(m['variants'])};release['variants'][id]=m
for ext,field in [('.zip','source_zip'),('.ai','source_ai')]:
 p=next((D/'ssg').rglob('*'+ext));release['patches'][id][field]=put(id,p)
(O/'release.json').write_text(json.dumps(release,ensure_ascii=False,indent=2)+'\n');(O/'uploads.json').write_text(json.dumps(uploads,indent=2)+'\n');print('READY',len(release['variants']),len(uploads))

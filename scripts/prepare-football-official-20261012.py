"""Prepare one manifest per club from reviewed NBA/NHL official assets."""
from pathlib import Path
import json,subprocess,hashlib,datetime,unicodedata,re,concurrent.futures
R=Path(__file__).resolve().parents[1];D=R/'marketing/assets/sports-expansion-20261012';O=D/'release-football';O.mkdir(exist_ok=True)
rows={r['id']:r for f in ['sports-cms-20261012.json','football-cms-20261012.json']for r in json.loads((Path('/Volumes/HDD-1TB/semologo-migration/task-tmp')/f).read_text())}
ko={'Arsenal':'아스널','Aston Villa':'애스턴 빌라','Bournemouth':'본머스','Brentford':'브렌트퍼드','Brighton and Hove Albion':'브라이턴 앤 호브 앨비언','Chelsea':'첼시','Coventry City':'코번트리 시티','Crystal Palace':'크리스털 팰리스','Everton':'에버턴','Fulham':'풀럼','Hull City':'헐 시티','Ipswich Town':'입스위치 타운','Leeds United':'리즈 유나이티드','Liverpool':'리버풀','Manchester City':'맨체스터 시티','Manchester United':'맨체스터 유나이티드','Newcastle United':'뉴캐슬 유나이티드','Nottingham Forest':'노팅엄 포리스트','Sunderland':'선덜랜드','Tottenham Hotspur':'토트넘 홋스퍼'}
def slug(s):return re.sub(r'[^a-z0-9]+','-',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower()).strip('-')
tasks=json.loads((D/'pl-downloads.json').read_text())
for t in tasks:t.update(league='pl',ko=ko[t['name']])
def prepare(t):
 id={'bournemouth': 'bournemouth-afc', 'brentford': 'brentford-fc', 'brighton-and-hove-albion': 'brighton-hove-afc', 'crystal-palace': 'crystal-palace-fc', 'hull-city': 'hull-city-fc', 'ipswich-town': 'ipswich-town-fc', 'leeds-united': 'leeds-united-afc', 'nottingham-forest': 'nottingham-forest-fc', 'sunderland': 'sunderland-afc'}.get(slug(t['name']),slug(t['name']));old=rows.get(id);norm=lambda s:re.sub('[^a-z0-9]','',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower())
 if not old:
  matches=[r for r in rows.values() if norm(r['payload'].get('name_en')or'')==norm(t['name']) and r['status']=='published' and not r['payload'].get('hidden') and not r['payload'].get('merged_into')]
  assert len(matches)<=1,('ambiguous',t['name']);old=matches[0]if matches else None;id=old['id']if old else id
 if old:assert old['status']=='published' and not old['payload'].get('hidden') and not old['payload'].get('merged_into')
 r=subprocess.run(['curl','--http1.1','-fsSL','--retry','2','--max-time','25','https://logo.vibers.co.kr/_clients/'+id+'/variants.json'],capture_output=True)
 if r.returncode==0:m=json.loads(r.stdout)
 else:assert b'404' in r.stderr;m={'schema':1,'id':id,'primary':None,'variants':[]}
 for v in (((old or{}).get('asset_manifest')or{}).get('variants')or{}).get('variants',[]):
  idx=next((i for i,n in enumerate(m['variants'])if n['key']==v['key']),None)
  if idx is None:m['variants'].append(v)
  else:assert m['variants'][idx]['files']==v['files'];m['variants'][idx]=v
 if old and not m['variants']:
  r=subprocess.run(['curl','--http1.1','-fsSL','--retry','2','--max-time','20','https://logo.vibers.co.kr/_clients/'+id+'/logo.svg'],capture_output=True)
  if r.returncode==0 and b'<svg' in r.stdout and not re.search(rb'<image\b|data:image',r.stdout,re.I):m['variants'].append({'key':'legacy-original','label':'기존 수집 로고 · 제작 시기 미확인','form':'unknown','lang':'unknown','color':'original','files':{'svg':'logo.svg'},'origin':'collected','order':0});m['primary']='legacy-original'
 files={};uploads=[]
 for ext,fn in [('svg','original.svg'),('png','logo.png'),('preview','preview.png')]:
  p=D/t['league']/t['code']/fn;sha=hashlib.sha256(p.read_bytes()).hexdigest();file='sources/official-sports-20261012/'+sha[:20]+p.suffix;files[ext]=file;uploads.append({'id':id,'file':str(p.relative_to(R)),'key':'_clients/'+id+'/'+file,'sha256':sha})
 key='official-'+t['league']+'-20261012';m['variants'].append({'key':key,'label':t['league'].upper()+' 공식 구단 마크 · 제작 시기 미확인','form':'symbol','lang':'unknown','color':'original','files':{k:files[k]for k in ['svg','png']},'preview_png':files['preview'],'source_url':t['source_url'],'origin':'official','official_distribution':True,'order':len(m['variants'])})
 patch={'name_ko':t['ko'],'name_en':t['name'],'variants_n':len(m['variants']),'logo_published_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'aliases':[t['ko'],t['name'],t['league'].upper(),'축구']}
 if not old:
  m['primary']=key;patch.update(id=id,name_ko=t['ko'],name_en=t['name'],category='스포츠',origin='GLOBAL',has_svg=True,has_png=True,logo_svg=files['svg'],logo_png=files['png'],preview_png='https://logo.vibers.co.kr/_clients/'+id+'/'+files['preview'],light=False,light_logo=False,dark_variant=False,added_at='2026-10-12',asset_origin=t['league'].upper()+' 공식 CDN',official_source_page='https://www.premierleague.com/en/clubs',presentation={'file':files['png'],'bg':'light'})
 return id,m,patch,uploads,{'name':t['name'],'name_ko':t['ko'],'brand_id':id,'league':t['league'],'new_content':not old,'identity_reviewed':True,'png_verified':True,'source_url':t['source_url']}
release={'patches':{},'variants':{}};uploads=[];proof=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=4)as pool:
 for id,m,p,u,e in pool.map(prepare,tasks):release['patches'][id]=p;release['variants'][id]=m;uploads+=u;proof.append(e);print('prepared',id,flush=True)
for name,d in [('release',release),('uploads',uploads),('identity-proof',proof)]: (O/(name+'.json')).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
print('READY',len(proof),'clubs',sum(x['new_content']for x in proof),'new',len(uploads),'objects')

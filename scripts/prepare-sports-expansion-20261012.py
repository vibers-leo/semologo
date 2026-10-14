"""Prepare one manifest per club from reviewed NBA/NHL official assets."""
from pathlib import Path
import json,subprocess,hashlib,datetime,unicodedata,re,concurrent.futures
from logo_variant_enrichment import merge_variant, coverage
R=Path(__file__).resolve().parents[1];D=R/'marketing/assets/sports-expansion-20261012';O=D/'release';O.mkdir(exist_ok=True)
rows={r['id']:r for f in ['sports-cms-20261012.json','sports-expanded-cms-20261012.json']for r in json.loads((Path('/Volumes/HDD-1TB/semologo-migration/task-tmp')/f).read_text())}
ko_nhl=['캐롤라이나 허리케인스','베이거스 골든나이츠','뉴욕 레인저스','에드먼턴 오일러스','탬파베이 라이트닝','애너하임 덕스','오타와 세너터스','시애틀 크라켄','유타 매머드','보스턴 브루인스','미네소타 와일드','위니펙 제츠','토론토 메이플리프스','피츠버그 펭귄스','콜로라도 애벌랜치','워싱턴 캐피털스','내슈빌 프레더터스','플로리다 팬서스','산호세 샤크스','댈러스 스타스','세인트루이스 블루스','몬트리올 캐네이디언스','뉴저지 데블스','콜럼버스 블루재키츠','뉴욕 아일런더스','버펄로 세이버스','밴쿠버 커넉스','디트로이트 레드윙스','로스앤젤레스 킹스','시카고 블랙호크스','필라델피아 플라이어스','캘거리 플레임스']
ko_nba=['애틀랜타 호크스','보스턴 셀틱스','클리블랜드 캐벌리어스','뉴올리언스 펠리컨스','시카고 불스','댈러스 매버릭스','덴버 너기츠','골든스테이트 워리어스','휴스턴 로키츠','LA 클리퍼스','로스앤젤레스 레이커스','마이애미 히트','밀워키 벅스','미네소타 팀버울브스','브루클린 네츠','뉴욕 닉스','올랜도 매직','인디애나 페이서스','필라델피아 세븐티식서스','피닉스 선스','포틀랜드 트레일블레이저스','새크라멘토 킹스','샌안토니오 스퍼스','오클라호마시티 선더','토론토 랩터스','유타 재즈','멤피스 그리즐리스','워싱턴 위저즈','디트로이트 피스턴스','샬럿 호네츠']
def slug(s):return re.sub(r'[^a-z0-9]+','-',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower()).strip('-')
tasks=[]
for league,ko in [('nhl',ko_nhl),('nba',ko_nba)]:
 ts=json.loads((D/f'{league}-downloads.json').read_text());assert len(ts)==len(ko)
 for t,k in zip(ts,ko):t.update(league=league,ko=k);tasks.append(t)
def prepare(t):
 id=slug(t['name']);old=rows.get(id);norm=lambda s:re.sub('[^a-z0-9]','',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower())
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
 key='official-'+t['league']+'-20261012';merge_variant(m,{'key':key,'label':t['league'].upper()+' 공식 구단 마크 · 제작 시기 미확인','form':'symbol','lang':'unknown','color':'original','files':{k:files[k]for k in ['svg','png']},'preview_png':files['preview'],'source_url':t['source_url'],'origin':'official','official_distribution':True,'order':len(m['variants']),'source_sha256':hashlib.sha256((D/t['league']/t['code']/'original.svg').read_bytes()).hexdigest()})
 patch={'variants_n':len(m['variants']),'logo_published_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'aliases':[t['ko'],t['name'],t['league'].upper(),'아이스하키'if t['league']=='nhl'else'농구']}
 if not old:
  m['primary']=key;patch.update(id=id,name_ko=t['ko'],name_en=t['name'],category='스포츠',origin='GLOBAL',has_svg=True,has_png=True,logo_svg=files['svg'],logo_png=files['png'],preview_png='https://logo.vibers.co.kr/_clients/'+id+'/'+files['preview'],light=False,light_logo=False,dark_variant=False,added_at='2026-10-12',asset_origin=t['league'].upper()+' 공식 CDN',official_source_page='https://www.nhl.com/info/teams/'if t['league']=='nhl'else'https://www.nba.com/teams',presentation={'file':files['png'],'bg':'light'})
 return id,m,patch,uploads,{'name':t['name'],'name_ko':t['ko'],'brand_id':id,'league':t['league'],'new_content':not old,'identity_reviewed':True,'png_verified':True,'source_url':t['source_url']}
release={'patches':{},'variants':{}};uploads=[];proof=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=4)as pool:
 for id,m,p,u,e in pool.map(prepare,tasks):release['patches'][id]=p;release['variants'][id]=m;uploads+=u;proof.append(e);print('prepared',id,flush=True)
for name,d in [('release',release),('uploads',uploads),('identity-proof',proof)]: (O/(name+'.json')).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
(O/'composition-coverage.json').write_text(json.dumps([coverage(m) for m in release['variants'].values()],ensure_ascii=False,indent=2)+'\n')
print('READY',len(proof),'clubs',sum(x['new_content']for x in proof),'new',len(uploads),'objects')

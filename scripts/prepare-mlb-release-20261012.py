from pathlib import Path
import json,subprocess,hashlib,datetime,re,concurrent.futures
R=Path(__file__).resolve().parents[1];D=R/'marketing/assets/baseball-official-20261012';O=D/'release';O.mkdir(exist_ok=True)
rows=json.loads(Path('/Volumes/HDD-1TB/semologo-migration/task-tmp/baseball-cms.json').read_text());teams=json.loads((D/'mlb-roster-original.json').read_text())['teams'];download={r['official_id']:r for r in json.loads((D/'downloaded.json').read_text())}
ko=['애슬레틱스','피츠버그 파이리츠','샌디에이고 파드리스','시애틀 매리너스','샌프란시스코 자이언츠','세인트루이스 카디널스','탬파베이 레이스','텍사스 레인저스','토론토 블루제이스','미네소타 트윈스','필라델피아 필리스','애틀랜타 브레이브스','시카고 화이트삭스','마이애미 말린스','뉴욕 양키스','밀워키 브루어스','로스앤젤레스 에인절스','애리조나 다이아몬드백스','볼티모어 오리올스','보스턴 레드삭스','시카고 컵스','신시내티 레즈','클리블랜드 가디언스','콜로라도 로키스','디트로이트 타이거스','휴스턴 애스트로스','캔자스시티 로열스','로스앤젤레스 다저스','워싱턴 내셔널스','뉴욕 메츠'];names=dict(zip([t['id'] for t in teams],ko))
def norm(s):return re.sub('[^a-z0-9]','',s.lower())
def process(t):
 id=t['name'].lower().replace('.','').replace(' ','-');id={'athletics':'oakland-athletics','miami-marlins':'miami-marlins-primary-logo-on-light'}.get(id,id)
 old=next((r for r in rows if r['id']==id),None)
 if old:assert old['status']=='published' and not old['payload'].get('merged_into') and not old['payload'].get('hidden')
 cms=((old or {}).get('asset_manifest') or {}).get('variants');r=subprocess.run(['curl','--http1.1','-fsSL','--max-time','20','https://logo.vibers.co.kr/_clients/'+id+'/variants.json'],capture_output=True)
 if r.returncode==0:m=json.loads(r.stdout)
 else:
  assert r.returncode in (22,56) and b'404' in r.stderr
  m={'schema':1,'id':id,'primary':None,'variants':[]}
 if cms:
  # PostgreSQL JSONB ordering is retained for the existing publisher's guard.
  for prior in cms['variants']:
   match=next((i for i,v in enumerate(m['variants']) if v['key']==prior['key']),None)
   if match is not None:assert m['variants'][match]['files']==prior['files'];m['variants'][match]=prior
   else:m['variants'].append(prior)
 if old and not m['variants']:
  v=subprocess.run(['curl','--http1.1','-fsSL','--max-time','20','https://logo.vibers.co.kr/_clients/'+id+'/logo.svg'],capture_output=True)
  if v.returncode==0 and b'<svg' in v.stdout and not re.search(rb'<image\b|data:image',v.stdout,re.I):m['variants'].append({'key':'legacy-original','label':'기존 수집 로고 · 시기 미확인','form':'unknown','lang':'unknown','color':'original','files':{'svg':'logo.svg'},'origin':'collected','order':0});m['primary']='legacy-original'
 files={};u=[]
 for ext,filename in [('svg','original.svg'),('png','logo.png'),('preview','preview.png')]:
  p=D/'mlb'/str(t['id'])/filename;raw=p.read_bytes();sha=hashlib.sha256(raw).hexdigest();file='sources/official-mlb-20261012/'+sha[:20]+p.suffix;files[ext]=file;u.append({'id':id,'file':str(p.relative_to(R)),'key':'_clients/'+id+'/'+file,'sha256':sha})
 key='official-mlb-cap-20261012';m['variants'].append({'key':key,'label':'MLB 공식 구단 심볼 · 2026-10-12 확인','form':'symbol','lang':'en','color':'original','files':{k:files[k] for k in ['svg','png']},'preview_png':files['preview'],'source_url':download[t['id']]['source_url'],'provider':'MLB 공식 CDN','official_distribution':True,'origin':'official','order':len(m['variants'])})
 patch={'variants_n':len(m['variants']),'logo_published_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'aliases':list(dict.fromkeys(((old or {}).get('payload',{}).get('metadata')or{}).get('aliases',[])+[t['name'],names[t['id']],'MLB','메이저리그']))}
 if not old:
  m['primary']=key;patch.update(id=id,name_ko=names[t['id']],name_en=t['name'],category='스포츠',origin='GLOBAL',has_svg=True,has_png=True,logo_svg=files['svg'],svg_transparent=files['svg'],logo_png=files['png'],preview_png='https://logo.vibers.co.kr/_clients/'+id+'/'+files['preview'],light=False,light_logo=False,dark_variant=False,added_at='2026-10-12',asset_review_status='verified',asset_origin='MLB 공식 CDN',official_source_page='https://www.mlb.com/team',presentation={'file':files['png'],'bg':'light'})
 return id,m,patch,u,{'official_id':t['id'],'name':t['name'],'brand_id':id,'new_content':not old,'source_url':download[t['id']]['source_url'],'png_file':files['png'],'identity_reviewed':True,'png_verified':True}
release={'patches':{},'variants':{}};uploads=[];proof=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 for id,m,p,u,e in pool.map(process,teams):release['patches'][id]=p;release['variants'][id]=m;uploads+=u;proof.append(e);print('prepared',id,flush=True)
(O/'release.json').write_text(json.dumps(release,ensure_ascii=False,indent=2)+'\n');(O/'uploads.json').write_text(json.dumps(uploads,indent=2)+'\n');(O/'identity-proof.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n');(R/'src/lib/reviewed-baseball-20261012.json').write_text(json.dumps(release,ensure_ascii=False,indent=2)+'\n');print('READY',len(proof),'teams',len(uploads),'objects',sum(p['new_content'] for p in proof),'new content')

"""Complete missing KOVO clubs using reviewed official vectors; preserve former Peppers."""
from pathlib import Path
import json,subprocess,re,hashlib,datetime
import cairosvg
from PIL import Image
R=Path(__file__).resolve().parents[1];D=R/'marketing/assets/sports-expansion-20261012';B=R/'marketing/assets/sports-official-20261011/kbl-kovo';O=D/'release-kovo';O.mkdir(exist_ok=True);P=D/'kovo-completion';P.mkdir(exist_ok=True)
rows={x['id']:x for x in json.loads(Path('/Volumes/HDD-1TB/semologo-migration/task-tmp/sports-cms-20261012.json').read_text())};codes={'1005':('hyundai-capital-skywalkers','Hyundai Capital Skywalkers'),'1006':('kepco-vixtorm','KEPCO Vixtorm'),'1002':('samsung-fire-bluefangs','Samsung Fire Bluefangs'),'2002':('korea-expressway-hi-pass','Korea Expressway Hi-Pass'),'2008':('aipeppers','SOOP SOOPers')};release={'patches':{},'variants':{}};uploads=[];proof=[]
for t in json.loads((B/'kovo-official-roster-assets.json').read_text()):
 if t['code']not in codes:continue
 id,en=codes[t['code']];old=rows.get(id)
 if old:assert old['status']=='published' and not old['payload'].get('hidden') and not old['payload'].get('merged_into')
 r=subprocess.run(['curl','--http1.1','-fsSL','--retry','2','--max-time','25','https://logo.vibers.co.kr/_clients/'+id+'/variants.json'],capture_output=True)
 if r.returncode==0:m=json.loads(r.stdout)
 else:assert b'404' in r.stderr;m={'schema':1,'id':id,'primary':None,'variants':[]}
 for v in (((old or{}).get('asset_manifest')or{}).get('variants')or{}).get('variants',[]):
  idx=next((i for i,n in enumerate(m['variants'])if n['key']==v['key']),None)
  if idx is None:m['variants'].append(v)
  else:assert m['variants'][idx]['files']==v['files'];m['variants'][idx]=v
 if id=='aipeppers':
  former=P/'former-ai-peppers.svg';subprocess.run(['curl','--http1.1','-fsSL','--retry','2','--max-time','25','https://cdn.kovo.co.kr/emblems/aipeppers.svg','-o',str(former)],check=True);raw=former.read_bytes();assert b'<svg' in raw and not re.search(rb'<image\b|data:image|<script',raw,re.I)
  fp=P/'former-ai-peppers-2000.png';cairosvg.svg2png(bytestring=raw,write_to=str(fp),output_width=2000);im=Image.open(fp).convert('RGBA');assert im.getbbox();im.thumbnail((640,640));prev=P/'former-ai-peppers-preview.png';im.save(prev);ff={}
  for ext,p in [('svg',former),('png',fp),('preview',prev)]:
   sha=hashlib.sha256(p.read_bytes()).hexdigest();file='sources/official-sports-20261012/'+sha[:20]+p.suffix;ff[ext]=file;uploads.append({'id':id,'file':str(p.relative_to(R)),'key':'_clients/'+id+'/'+file,'sha256':sha})
  key='official-former-ai-peppers-20261012'
  if not any(v['key']==key for v in m['variants']):m['variants'].append({'key':key,'label':'AI 페퍼스 · 이전 구단명 공식 엠블럼','form':'symbol','lang':'en','color':'original','files':{'svg':ff['svg'],'png':ff['png']},'preview_png':ff['preview'],'source_url':'https://cdn.kovo.co.kr/emblems/aipeppers.svg','official_distribution':True,'origin':'official','order':len(m['variants'])})
 svg=B/'sources'/f"kovo-{t['code']}-emblem.svg";raw=svg.read_bytes();assert b'<svg' in raw and not re.search(rb'<image\b|data:image|<script',raw,re.I);png=P/(id+'.png');cairosvg.svg2png(bytestring=raw,write_to=str(png),output_width=2000);im=Image.open(png).convert('RGBA');assert im.getbbox();im.thumbnail((640,640));prev=P/(id+'-preview.png');im.save(prev);files={}
 for ext,p in [('svg',svg),('png',png),('preview',prev)]:
  sha=hashlib.sha256(p.read_bytes()).hexdigest();file='sources/official-sports-20261012/'+sha[:20]+p.suffix;files[ext]=file;uploads.append({'id':id,'file':str(p.relative_to(R)),'key':'_clients/'+id+'/'+file,'sha256':sha})
 key='official-kovo-20261012';entry=({'key':key,'label':t['name']+' · KOVO 공식 팀마크','form':'symbol','lang':'unknown','color':'original','files':{k:files[k]for k in ['svg','png']},'preview_png':files['preview'],'origin':'official','official_distribution':True,'source_url':t['emblem_url'],'order':len(m['variants'])});
 if not any(v['key']==key for v in m['variants']):m['variants'].append(entry)
 m['primary']=key
 patch={'variants_n':len(m['variants']),'logo_published_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'aliases':[t['name'],en,'KOVO','배구'],'name_ko':t['name'],'name_en':en,'has_svg':True,'has_png':True,'logo_svg':files['svg'],'svg_transparent':files['svg'],'logo_png':files['png'],'preview_png':'https://logo.vibers.co.kr/_clients/'+id+'/'+files['preview'],'asset_origin':'KOVO 공식 CDN','official_source_page':t['source_page']}
 if id!='aipeppers':patch.update(id=id,category='스포츠',origin='KR',added_at='2026-10-12',light=False,light_logo=False,dark_variant=False,presentation={'file':files['png'],'bg':'light'})
 if id=='aipeppers':patch['aliases']+=['AI 페퍼스','페퍼저축은행 배구단','광주 AI 페퍼스','SOOPers','숲 수퍼스'];patch['history_note']='AI 페퍼스 인수 후 SOOP SOOPers로 운영. 이전 구단명 로고를 같은 콘텐츠에 보존.';patch['rejected_asset_files']=['logo.png']
 release['patches'][id]=patch;release['variants'][id]=m;proof.append({'name':t['name'],'brand_id':id,'league':'KOVO','identity_reviewed':True,'png_verified':True,'source_url':t['emblem_url'],'new_content':not old});print('prepared',id,flush=True)
for name,d in [('release',release),('uploads',uploads),('identity-proof',proof)]: (O/(name+'.json')).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
print('READY',len(proof),len(uploads))

"""Prepare reviewed KBL/KOVO vectors for existing team identities."""
from pathlib import Path
import json,subprocess,hashlib,datetime,re
import cairosvg
from PIL import Image
R=Path(__file__).resolve().parents[1];D=R/'marketing/assets/sports-expansion-20261012';B=R/'marketing/assets/sports-official-20261011/kbl-kovo';O=D/'release-domestic';O.mkdir(exist_ok=True);P=D/'domestic';P.mkdir(exist_ok=True)
rows={r['id']:r for r in json.loads(Path('/Volumes/HDD-1TB/semologo-migration/task-tmp/sports-cms-20261012.json').read_text())}
kbl={'kgc':'kgckbl','lg':'sakerskbl','sk':'sksports','hd':'phoebuskbl','sono':'skygunnerskbl','kcc':'kccegis','db':'promykbl','kt':'sonicboomkbl','pega':'pegasuskbl','ss':'thunderskbl'}
tasks=[(id,'KBL',B/'sources'/f'kbl-{code}-logo.svg','https://kbl.or.kr/assets/img/logo/logo-'+code+'.svg','https://kbl.or.kr/')for code,id in kbl.items()]
for t in json.loads((B/'audit-report.json').read_text())['kovo']['teams']:
 id=t.get('canonical_id')
 if id and id not in ['hillstatehdec','pinkspiders']:tasks.append((id,'KOVO',B/'sources'/f"kovo-{t['code']}-emblem.svg",t['emblem_url'],t['source_page']))
release={'patches':{},'variants':{}};uploads=[];proof=[]
for id,league,svg,url,page in tasks:
 old=rows[id];assert old['status']=='published' and not old['payload'].get('hidden')
 r=subprocess.run(['curl','--http1.1','-fsSL','--retry','2','--max-time','25','https://logo.vibers.co.kr/_clients/'+id+'/variants.json'],capture_output=True)
 if r.returncode==0:m=json.loads(r.stdout)
 else:assert b'404' in r.stderr;m={'schema':1,'id':id,'primary':None,'variants':[]}
 for v in ((old.get('asset_manifest')or{}).get('variants')or{}).get('variants',[]):
  idx=next((i for i,n in enumerate(m['variants'])if n['key']==v['key']),None)
  if idx is None:m['variants'].append(v)
  else:assert m['variants'][idx]['files']==v['files'];m['variants'][idx]=v
 raw=svg.read_bytes();assert b'<svg' in raw and not re.search(rb'<image\b|data:image|<script',raw,re.I)
 png=P/(id+'.png');cairosvg.svg2png(bytestring=raw,write_to=str(png),output_width=2000);im=Image.open(png).convert('RGBA');assert im.getbbox();im.thumbnail((640,640));prev=P/(id+'-preview.png');im.save(prev)
 files={}
 for ext,p in [('svg',svg),('png',png),('preview',prev)]:
  sha=hashlib.sha256(p.read_bytes()).hexdigest();file='sources/official-sports-20261012/'+sha[:20]+p.suffix;files[ext]=file;uploads.append({'id':id,'file':str(p.relative_to(R)),'key':'_clients/'+id+'/'+file,'sha256':sha})
 key='official-'+league.lower()+'-20261012';assert not any(v['key']==key for v in m['variants']);m['variants'].append({'key':key,'label':league+' 공식 구단 마크 · 제작 시기 미확인','form':'symbol','lang':'unknown','color':'original','files':{k:files[k]for k in ['svg','png']},'preview_png':files['preview'],'origin':'official','source_url':url,'official_distribution':True,'order':len(m['variants'])});m['primary']=m['primary']or key
 release['variants'][id]=m;release['patches'][id]={'variants_n':len(m['variants']),'logo_published_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'svg_transparent':files['svg'],'has_svg':True,'logo_svg':True,'aliases':[old['payload']['name_ko'],league,'농구'if league=='KBL'else'배구']};proof.append({'name':old['payload']['name_ko'],'brand_id':id,'league':league,'identity_reviewed':True,'png_verified':True,'source_url':url});print('prepared',id,flush=True)
for name,d in [('release',release),('uploads',uploads),('identity-proof',proof)]: (O/(name+'.json')).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
print('READY',len(tasks),len(uploads))

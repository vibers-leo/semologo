"""Build a release from explicitly selected visual reviews; never replace original files."""
import hashlib,io,json,subprocess,re,shlex,datetime
from pathlib import Path
from collections import defaultdict
from urllib.parse import parse_qs,urlparse
from lxml import html,etree as E
from PIL import Image
import fitz
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'marketing/assets/asset-release-20261008';BASE=ROOT/'marketing/assets/public-institution-vectors-20261007';REVIEW=ROOT/'marketing/assets/public-institution-review-20261008';CDN='https://logo.vibers.co.kr/_clients'
def png(raw):
 if re.search(rb'<(?:[A-Za-z0-9_-]+:)?(?:filter|mask|image)\b',raw):
  code="const sharp=require('sharp');const a=[];process.stdin.on('data',d=>a.push(d));process.stdin.on('end',async()=>{try{const b=await sharp(Buffer.concat(a),{density:144}).resize({width:800,height:800,fit:'inside'}).trim({background:'#00000000'}).png().toBuffer();process.stdout.write(b);}catch(e){console.error(e.message);process.exitCode=1;}});"
  b=subprocess.check_output(['node','-e',code],input=raw,cwd=ROOT);return Image.open(io.BytesIO(b)).convert('RGBA')
 d=fitz.open(stream=raw,filetype='svg');p=fitz.open(stream=d.convert_to_pdf(),filetype='pdf')[0];pix=p.get_pixmap(matrix=fitz.Matrix(800/max(p.rect.width,p.rect.height),800/max(p.rect.width,p.rect.height)),alpha=True);im=Image.frombytes('RGBA',[pix.width,pix.height],pix.samples);box=im.getbbox();assert box;im=im.crop(box);return im

def main():
 OUT.mkdir(exist_ok=True);patches={};manifests={};uploads=[];decisions=[]
 def save(id,rel,raw):
  f=OUT/id/rel;f.parent.mkdir(parents=True,exist_ok=True);f.write_bytes(raw);uploads.append({'id':id,'file':str(f.relative_to(ROOT)),'key':'_clients/'+id+'/'+rel,'sha256':hashlib.sha256(raw).hexdigest()})
 def savepng(id,rel,im):
  b=io.BytesIO();im.save(b,format='PNG');save(id,rel,b.getvalue())
 reviews=json.loads((BASE/'existing-svg-review.json').read_text());old={r['member_key']:r['selected_id'] for r in reviews if r.get('audit_status')=='identity-visually-reviewed'}
 q=json.loads((BASE/'prepared-review.json').read_text())['visual_queue'];approved=set(json.loads((REVIEW/'visual-selection-indexes.json').read_text()))
 # Discard county crests, service marks and tiny text whose institutional identity remains ambiguous.
 approved-=set([56,274,324,453,475,477,482,168,215,410,411,412,461])
 groups=defaultdict(list)
 for i,r in enumerate(q):
  status='visually-reviewed-vector' if i in approved else 'held-nonlogo-manual-or-ambiguous-identity'
  decisions.append({'index':i,'institution_id':r['member_key'],'name':r['name'],'file':r['file'],'status':status})
  if i in approved:groups[r['member_key']].append((i,r))
 selected=[]
 for key,rs in groups.items():
  r=rs[0][1];id=old.get(key) or next((v for v in r['candidates'] if v!='korea-electric-power-corporation-logo'),None)
  if not id:continue
  vs=[];seen=set()
  for index,v in rs:
   raw=(ROOT/v['file']).read_bytes();sha=hashlib.sha256(raw).hexdigest()
   if sha in seen:continue
   seen.add(sha);im=png(raw);opaque=[p for p in im.getdata() if p[3]>100];light=bool(opaque) and sum(min(p[:3])>175 for p in opaque)/len(opaque)>.65
   rel=('sources/official-reviewed-filter-20261008/' if re.search(rb'<(?:filter|mask)\b',raw) else 'sources/official-reviewed-20261008/')+sha[:16];save(id,rel+'.svg',raw);savepng(id,rel+'.png',im)
   is_symbol=bool(re.search(r'symbol|simbol|심볼|심벌',v['archive_member'],re.I));form='symbol' if is_symbol else 'horizontal';color='white' if light else 'original'
   vs.append({'key':'official-'+sha[:12],'form':form,'lang':'none' if is_symbol else 'ko','color':color,'label':'공식 심볼마크' if is_symbol else '공식 로고타입','files':{'svg':rel+'.svg','png':rel+'.png'},'provider':'공식 기관 홈페이지','origin':'collected','order':len(vs),'asset_group':'symbol' if is_symbol else 'logotype','light':light})
  if not vs:continue
  primary=next((v for v in vs if v['color']!='white' and v['form']!='symbol'),next((v for v in vs if v['color']!='white'),vs[0]));primary['order']=-1
  patches[id]={'logo_svg':True,'has_svg':True,'has_png':True,'logo_png':primary['files']['png'],'preview_png':f'{CDN}/{id}/'+primary['files']['png'],'svg_transparent':primary['files']['svg'],'light':primary['color']=='white','light_logo':primary['color']=='white','dark_variant':False,'official_source_page':r['source_page'],'asset_origin':'공식 기관 홈페이지 · 원본 벡터 검수','rejected_asset_files':['logo-800.png','logo-transparent.png','logo-white.png','logo-icon.png']}
  if id in ['kcopa','kdissw','ygpa']:patches[id]['hidden']=False
  manifests[id]={'schema':1,'algo_v':1,'id':id,'primary':primary['key'],'variants':vs}
  selected.append({'institution_id':key,'brand_id':id,'name':r['name'],'png_file':primary['files']['png'],'source_page':r['source_page']})
 # Full-canvas rectangle removals approved by before/after dark-background review.
 bg=ROOT/'marketing/assets/svg-background-review-20261008';br=json.loads((bg/'prepared.json').read_text());bgapproved=[0,36,39,43,44,45,48,51,52,57,58,59,61,62,63,64,66,67,68,69,70,71,72,73,75,78,80,83,86,87,88,90,91,92,94]
 for index in bgapproved:
  r=br[index];id=r['id'];raw=(bg/id/'transparent.svg').read_bytes();im=png(raw);rel='sources/reviewed-background-20261008/';save(id,rel+'logo.svg',raw);savepng(id,rel+'logo.png',im)
  patches[id]={'logo_svg':True,'has_svg':True,'has_png':True,'logo_png':rel+'logo.png','preview_png':f'{CDN}/{id}/'+rel+'logo.png','svg_transparent':rel+'logo.svg','light':False,'light_logo':False,'dark_variant':False,'rejected_asset_files':['logo-white.png','logo-transparent.png','logo-800.png','logo-icon.png']}
  manifests[id]={'schema':1,'algo_v':1,'id':id,'primary':'transparent','variants':[{'key':'transparent','form':'unknown','lang':'unknown','color':'original','label':'투명 배경 로고','files':{'svg':rel+'logo.svg','png':rel+'logo.png'},'provider':'보유 SVG · 흰 배경 도형만 제거','origin':'derived','order':0}]}
  if id=='hypernix':
   # This mono wordmark's white paths are letter counters; preserve their cutouts in dark derivative.
   white=im.copy();pixels=[]
   for red,green,blue,alpha in white.getdata():
    weight=max(0,min(1,(255-red)/(255-130)));pixels.append((255,255,255,round(alpha*weight)))
   white.putdata(pixels);savepng(id,rel+'dark.png',white);patches[id]['dark_png']=rel+'dark.png'
 # Official ZIPs stay at the institution's host, never copied to public CDN.
 rows=json.loads((BASE/'queue.json').read_text());bykey={r['member_key']:r for r in rows}
 for z in json.loads((REVIEW/'official-zips.json').read_text()):
  url=z['official_zip_url'].replace('http://www.kwater','https://www.kwater')
  for id in bykey[z['member_key']]['candidates']:patches.setdefault(id,{}).update(official_zip_url=url,official_source_page=z['official_page'])
 # Frequently visited vector logos: render PNG from the existing true vector, preserving artwork.
 for id in ['mammoth-coffee','tving','hanwhaengine']:
  original=ROOT/'marketing/assets/analytics-review-20261008'/(id+'.svg');raw=original.read_bytes();im=png(raw);rel='sources/reviewed-priority-20261008/';save(id,rel+'logo.svg',raw);savepng(id,rel+'logo.png',im)
  light=id=='hanwhaengine'
  patches[id]={'has_png':True,'has_svg':True,'logo_svg':True,'logo_png':rel+'logo.png','preview_png':CDN+'/'+id+'/'+rel+'logo.png','svg_transparent':rel+'logo.svg','light':light,'light_logo':light,'rejected_asset_files':['logo-800.png','logo-transparent.png','logo-white.png','logo-icon.png']}
 # Current Doosan Bears artwork: keep JPG originals and publish lossless PNG previews, no raster-wrapped SVG.
 doc=html.fromstring((REVIEW/'doosan-brand.html').read_text());sections=doc.xpath('//*[contains(concat(" ",normalize-space(@class)," ")," tab-content ")]')[0].xpath('./section');vs=[]
 forms=['emblem','logotype','symbol','typography','mascot'];names=['엠블럼','로고타입','심볼마크','타이포그래피 안내','마스코트']
 for section,form,label in zip(sections,forms,names):
  for n,url in enumerate(section.xpath('.//img/@src'),1):
   file=parse_qs(urlparse(url).query)['url'][0];source='https://www.doosanbears.com'+file;original=OUT/'doosan-bears'/'originals'/Path(file).name;raw=original.read_bytes() if original.exists() else subprocess.check_output(['curl','-fsSL','--max-time','25',source]);im=Image.open(io.BytesIO(raw));im.load();assert im.format=='JPEG';rel='sources/official-brand-20261008/'+Path(file).stem+'.png';savepng('doosan-bears',rel,im)
   archive=OUT/'doosan-bears'/'originals';archive.mkdir(exist_ok=True);(archive/Path(file).name).write_bytes(raw)
   vs.append({'key':f'{form}-{n}','form':form if form in ['emblem','symbol','typography','mascot'] else 'wordmark','asset_group':form,'lang':'none' if form in ['emblem','symbol','mascot'] else 'ko','color':'original','label':f'{label} {n}' if len(section.xpath('.//img'))>1 else label,'files':{'png':rel},'provider':'두산베어스 공식 브랜드 페이지 · 현재','origin':'collected','order':len(vs),'source_url':source})
 raw=(ROOT/'marketing/assets/analytics-review-20261008/doosan-bears.svg').read_bytes();rel='sources/reviewed-priority-20261008/';save('doosan-bears',rel+'symbol.svg',raw);savepng('doosan-bears',rel+'symbol.png',png(raw))
 vs.append({'key':'existing-symbol-vector','form':'symbol','asset_group':'symbol','lang':'none','color':'original','label':'기존 보유 심볼 SVG','files':{'svg':rel+'symbol.svg','png':rel+'symbol.png'},'provider':'기존 보유 벡터 · 공식 페이지 이미지와 별도','origin':'collected','order':12})
 manifests['doosan-bears']={'schema':1,'algo_v':1,'id':'doosan-bears','primary':vs[0]['key'],'variants':vs}
 patches['doosan-bears']={'logo_svg':False,'has_svg':False,'svg_transparent':None,'logo_png':vs[0]['files']['png'],'preview_png':CDN+'/doosan-bears/'+vs[0]['files']['png'],'has_png':True,'official_source_page':'https://www.doosanbears.com/bears/brand','asset_origin':'두산베어스 공식 브랜드 페이지 · 현재','light':False,'light_logo':False}
 # Gemini's current official SVG uses blur filters; keep them through SVG and PNG delivery.
 gem=ROOT/'marketing/assets/gemini-review-20261008';raw=(gem/'official-wordmark.svg').read_bytes();root=E.fromstring(raw);root.attrib.pop('class',None)
 current=[]
 for key,label,form,color in [('wordmark','공식 로고타입','wordmark','original'),('symbol','공식 심볼마크','symbol','original'),('dark','공식 로고타입 · 어두운 배경용','wordmark','white')]:
  d=E.fromstring(E.tostring(root))
  if key=='symbol':
   for el in list(d)[:6]:d.remove(el)
   d.set('viewBox','0 0 65 65');d.set('width','65');d.set('height','65')
  for el in d.iter():
   if el.get('fill')=='currentColor':el.set('fill','#ffffff' if key=='dark' else '#000000')
  data=E.tostring(d);rel='sources/official-gemini-gradient-20261008/'+key;save('gemini',rel+'.svg',data);savepng('gemini',rel+'.png',png(data))
  current.append({'key':key,'form':form,'asset_group':'symbol' if key=='symbol' else 'logotype','lang':'none' if key=='symbol' else 'en','color':color,'label':label,'files':{'svg':rel+'.svg','png':rel+'.png'},'provider':'Google · About Gemini','origin':'collected' if key=='wordmark' else 'derived','order':len(current),'source_url':'https://gemini.google/about/'})
 manifests['gemini']={'schema':1,'algo_v':1,'id':'gemini','primary':'wordmark','variants':current}
 patches['hyundaielevator']={'presentation':{'file':'logo-transparent.png','bg':'light'}}
 patches['gemini']={'name_ko':'구글 제미나이','name_en':'Google Gemini','category':'AI·머신러닝','aliases':['제미나이','제미니','바드','구글 바드','Bard','Google Bard','Gemini AI','Gemini','Google Gemini','구글 제미나이'],'logo_svg':True,'has_svg':True,'has_png':True,'svg_transparent':current[0]['files']['svg'],'logo_png':current[0]['files']['png'],'preview_png':CDN+'/gemini/'+current[0]['files']['png'],'dark_png':current[2]['files']['png'],'light':False,'light_logo':False,'dark_variant':False,'official_source_page':'https://gemini.google/about/','asset_origin':'Google 공식 페이지 · 그라데이션 필터 유지','rejected_asset_files':['logo-800.png','logo-transparent.png','logo-white.png','logo-icon.png']}
 # Reviewed homonyms: remove only the full-canvas white path and regenerate missing previews.
 import importlib.util
 spec=importlib.util.spec_from_file_location('background_audit',ROOT/'scripts/audit-svg-backgrounds.py');audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)
 for id in ['gemini--src-14572db','gemini-1--src-657e881','gemini-sound-products-corporation','gemini-dvd','gemini-film']:
  raw=(gem/(id+'.svg')).read_bytes();d,els=audit.candidates(raw)
  for el in els:el.getparent().remove(el)
  assert d is not None;data=E.tostring(d);rel='sources/reviewed-gemini-search-20261008/';save(id,rel+'logo.svg',data);savepng(id,rel+'logo.png',png(data))
  patches[id]={'has_png':True,'has_svg':True,'logo_svg':True,'svg_transparent':rel+'logo.svg','logo_png':rel+'logo.png','preview_png':CDN+'/'+id+'/'+rel+'logo.png','light':False,'light_logo':False,'rejected_asset_files':['logo-800.png','logo-transparent.png','logo-white.png','logo-icon.png']}
 for id,name in {'gemini--src-14572db':'GEMINI · 별 심볼','gemini-1--src-657e881':'GEMINI · 레드 로고','gemini-sound-products-corporation':'Gemini Sound Products','gemini-dvd':'Gemini DVD','gemini-film':'Gemini Film'}.items():patches[id].update(name_ko=name,name_en=name)
 # Mixed vector/raster original: recover a truthful PNG, do not advertise it as pure vector.
 id='gemini-communication';d=E.fromstring((gem/(id+'.svg')).read_bytes());first=d[0];assert audit.rectangle(first)==(0.0,0.0,192.756,192.756);d.remove(first)
 for el in d.xpath('//*[local-name()="image"]'):
  for k,v in list(el.attrib.items()):
   if k.endswith('href') and v.startswith('data:image/'):
    head,body=v.split(',',1);el.set(k,head+','+re.sub(r'\s+','',body))
 rel='sources/reviewed-gemini-search-20261008/';savepng(id,rel+'logo.png',png(E.tostring(d)))
 patches[id]={'has_png':True,'has_svg':False,'logo_svg':False,'logo_png':rel+'logo.png','preview_png':CDN+'/'+id+'/'+rel+'logo.png','light':False,'light_logo':False,'rejected_asset_files':['logo.svg','logo-800.png','logo-transparent.png','logo-white.png','logo-icon.png']}
 (OUT/'release.json').write_text(json.dumps({'patches':patches,'variants':manifests},ensure_ascii=False,indent=2))
 (OUT/'uploads.json').write_text(json.dumps(uploads,ensure_ascii=False,indent=2));(OUT/'institution-members.json').write_text(json.dumps(selected,ensure_ascii=False,indent=2));(OUT/'visual-decisions.json').write_text(json.dumps(decisions,ensure_ascii=False,indent=2))
 print('PASS prepared',len(selected),'institutions;',len(bgapproved),'transparent logos;',len(vs),'Doosan assets (12 current official + retained vector);',len(uploads),'upload files')
if __name__=='__main__':main()

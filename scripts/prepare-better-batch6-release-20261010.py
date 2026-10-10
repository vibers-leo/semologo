"""Render all reviewed color variants, preserve previous representatives and manifests."""
from pathlib import Path
from lxml import etree as E
from PIL import Image,ImageDraw
import json,hashlib,copy,re,subprocess,zipfile,io,concurrent.futures
ROOT=Path(__file__).resolve().parents[1];SRC=ROOT/'marketing/assets/figma-better-collection-20261010';OUT=ROOT/'marketing/assets/figma-better-batch6-20261010';INK='/Applications/Inkscape.app/Contents/MacOS/inkscape';decisions=json.loads((OUT/'decisions.json').read_text());old={x['id']:x for x in json.loads((OUT/'cms-before.json').read_text())};archive=json.loads((SRC/'intake.json').read_text())['source'];jobs=[];HELD=[]
for d in decisions:
 if d['status']!='approved-identity':continue
 if d['existing']:assert d['id'] in old and old[d['id']]['status']=='published' and not old[d['id']]['payload'].get('hidden') and not old[d['id']]['payload'].get('merged_into')
 else:assert d['id'] not in old and any(f.endswith('.svg') for f in d['files'])
 for file in d['files']:
  if file.endswith(('.svg','.png')):jobs.append((d,file))
def render(job):
 d,file=job;id=d['id'];color='white' if '(white)' in file else 'black' if '(black)' in file else 'original';folder=OUT/'prepared'/id;folder.mkdir(parents=True,exist_ok=True);png=folder/(color+'.png');result={'name':d['name'],'id':id,'color':color,'source_file':file,'png':str(png.relative_to(ROOT)),'existing':d['existing']}
 try:
  if file.endswith('.svg'):
   src=SRC/'source'/file;root=E.parse(str(src)).getroot();assert not root.xpath('//*[local-name()="image" or local-name()="script" or local-name()="foreignObject" or local-name()="text"]');assert not any(k.lower().startswith('on') or (k.endswith('href') and not v.startswith('#')) or re.search(r'url\([\s\x27\x22]*(?:https?:|//|data:)',v) for el in root.iter() for k,v in el.attrib.items());vb=list(map(float,root.get('viewBox').split()));w,h=vb[2:];removed=0
   for el in list(root):
    if E.QName(el).localname=='rect' and el.get('fill','').lower() in ['white','#fff','#ffffff'] and float(el.get('x','0'))==vb[0] and float(el.get('y','0'))==vb[1] and el.get('width') and el.get('height') and float(el.get('width'))==w and float(el.get('height'))==h:root.remove(el);removed+=1
   svg=folder/(color+'.svg');root.attrib.pop('width',None);root.attrib.pop('height',None);svg.write_bytes(E.tostring(root));dim='--export-width=' if w>=h else '--export-height='
   subprocess.run([INK,str(svg),'--export-area-page',dim+'2000','--export-filename='+str(png)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);result.update(svg=str(svg.relative_to(ROOT)),removed_canvas_rects=removed)
  else:
   assert d['existing'] or any(f.endswith('.svg') for f in d['files']),'PNG-only new identity is held'
   with zipfile.ZipFile(archive) as z:im=Image.open(io.BytesIO(z.read(file)));im.load()
   result['source_dimensions']=im.size;im.convert('RGBA').save(png)
  im=Image.open(png).convert('RGBA');lo,hi=im.getextrema()[3];assert lo==0 and hi>0;box=im.getchannel('A').getbbox();assert box;im=im.crop(box)
  if result.get('svg'):
   root=E.parse(str(ROOT/result['svg'])).getroot();x,y,w,h=map(float,root.get('viewBox').split());full=Image.open(png);root.set('viewBox',f'{x+box[0]/full.width*w} {y+box[1]/full.height*h} {(box[2]-box[0])/full.width*w} {(box[3]-box[1])/full.height*h}');(ROOT/result['svg']).write_bytes(E.tostring(root))
  im.save(png,optimize=True);prev=folder/(color+'-preview.png');im.thumbnail((640,640),Image.Resampling.LANCZOS);im.save(prev,optimize=True);result.update(preview=str(prev.relative_to(ROOT)),png_dimensions=Image.open(png).size,alpha_extrema=[lo,hi]);return result
 except Exception as e:return {**result,'held_error':type(e).__name__+': '+str(e)[:160]}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:rows=list(pool.map(render,jobs))
(OUT/'rendered-candidates.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n');approved=[];duplicates=[]
for d in decisions:
 if d['status']!='approved-identity':continue
 group=[r for r in rows if r['id']==d['id'] and not r.get('held_error')];bycolor={r['color']:r for r in group}
 def pixels(r):im=Image.open(ROOT/r['png']).convert('RGBA');return im.size,im.tobytes()
 if 'original' in bycolor and 'black' in bycolor and pixels(bycolor['original'])==pixels(bycolor['black']):duplicates.append({**bycolor.pop('black'),'reason':'Original and black pixels exactly identical; original retained'})
 if 'original' in bycolor and 'white' in bycolor and pixels(bycolor['original'])==pixels(bycolor['white']):duplicates.append({**bycolor.pop('original'),'reason':'Original and white pixels exactly identical; explicit white retained'})
 approved.extend(bycolor.values())
release={'patches':{},'variants':{},'source_kind':'user-provided-figma-community','official':False,'checked_at':'2026-10-10'};uploads=[]
dark_originals={'northflank','pulte-homes','step-fintech','osedea','thrive-capital','tigerglobal','westcap'}
prior_cdn=json.loads((OUT/'cdn-prior-variants.json').read_text()) if (OUT/'cdn-prior-variants.json').exists() else {}
def obj(id,path):
 f=ROOT/path;raw=f.read_bytes();sha=hashlib.sha256(raw).hexdigest();rel='sources/figma-better-community-20261010/'+sha[:20]+f.suffix;uploads.append({'id':id,'file':path,'key':'_clients/'+id+'/'+rel,'sha256':sha,'bytes':len(raw)});return rel
for row in approved:
 id=row['id'];d=next(d for d in decisions if d.get('id')==id);manifest=release['variants'].get(id)
 if manifest is None:
  manifest=copy.deepcopy(((old.get(id,{}).get('asset_manifest') or {}).get('variants')) or prior_cdn.get(id) or {'id':id,'schema':1,'algo_v':1,'primary':None,'variants':[]});manifest['id']=id
  for previous in (prior_cdn.get(id) or {}).get('variants',[]):
   if not any(v['key']==previous['key'] for v in manifest['variants']):manifest['variants'].append(copy.deepcopy(previous))
  release['variants'][id]=manifest
 files={ext:obj(id,row[ext]) for ext in ['svg','png'] if row.get(ext)};preview=obj(id,row['preview']);key='figma-better-'+row['color'];assert not any(v['key']==key for v in manifest['variants']),id+' has already published same source key';label={'original':'원색','black':'검정','white':'화이트'}[row['color']]
 variant=dict(key=key,label='커뮤니티 수록 '+label+' · 시기 미확인'+(' · PNG 원본' if not row.get('svg') else ''),form='horizontal',lockup='horizontal',lang='en',color=row['color'],light=(row['color']=='white' or (row['color']=='original' and id in dark_originals)),files=files,preview_png=preview,provider='figma-community',origin='community',official=False,official_distribution=False,order=len(manifest['variants']),source_note='사용자 제공 Better Logos (Community).zip의 해당 회사 로고. 원본 경로·색상 보존, 시기 미확인. 공식 최신 CI나 공식 화이트 배포본으로 인증하지 않음.',png_width=row['png_dimensions'][0],png_height=row['png_dimensions'][1]);manifest['variants'].append(variant)
for id,manifest in release['variants'].items():
 d=next(d for d in decisions if d.get('id')==id);patch={'variants_n':len(manifest['variants'])}
 if not d['existing']:
  own=[v for v in manifest['variants'] if v['key'].startswith('figma-better-') and v['files'].get('svg')];assert own;v=next((v for v in own if v['color']=='original'),next((v for v in own if v['color']=='black'),own[0]));light=v['light'];manifest['primary']=v['key'];patch.update(id=id,name_en=d['name'],name_ko=d['name'],category=d['category'],origin='GLOBAL',website=d['website'],has_svg=True,has_png=True,logo_svg=v['files']['svg'],svg_transparent=v['files']['svg'],logo_png=v['files']['png'],preview_png='https://logo.vibers.co.kr/_clients/'+id+'/'+v['preview_png'],presentation={'file':v['files']['png'],'bg':'dark' if light else 'light'},light=light,light_logo=light,asset_origin=None,asset_review_status='verified',sources=['figma-community'],metadata={'has_svg':True,'has_png':True,'added_at':'2026-10-10'})
 release['patches'][id]=patch
 for v in ((old.get(id,{}).get('asset_manifest') or {}).get('variants') or {}).get('variants',[]):assert any(n==v for n in manifest['variants'])
uploads=list({u['key']:u for u in uploads}.values())
for name,value in [('release',release),('uploads',uploads),('excluded-duplicates',duplicates),('approved-candidates',approved)]: (OUT/(name+'.json')).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
for start in range(0,len(approved),30):
 sheet=Image.new('RGB',(1800,1080),'white')
 for j,row in enumerate(approved[start:start+30]):
  white=row['color']=='white';tile=Image.new('RGB',(360,180),'#222' if white else '#ddd');im=Image.open(ROOT/row['preview']);im.thumbnail((340,130));tile.paste(im,((360-im.width)//2,12),im);ImageDraw.Draw(tile).text((6,150),row['id']+' '+row['color'],fill='white' if white else 'black');sheet.paste(tile,(j%5*360,j//5*180))
 sheet.save(OUT/('approved-contact-'+str(start//30+1)+'.jpg'))
print('Prepared',len(release['variants']),'brands',len(approved),'variants',len(uploads),'objects;',len(duplicates),'exact duplicates;',sum(bool(r.get('held_error')) for r in rows),'held render errors')

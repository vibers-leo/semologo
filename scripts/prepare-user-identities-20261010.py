"""Extract reviewed vector artwork from user-supplied identity files, never guide pages."""
from pathlib import Path
import copy, hashlib, json, subprocess
import fitz, cairosvg
from lxml import etree as E
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'marketing/assets/user-identities-20261010'
OUT.mkdir(parents=True,exist_ok=True)
NS='http://www.w3.org/2000/svg'
uploads=[]; manifests={}; patches={}; thumbs=[]

def object_file(brand,f):
 raw=f.read_bytes();h=hashlib.sha256(raw).hexdigest();rel=f'sources/user-identities-20261010/{h[:16]}{f.suffix}'
 uploads.append({'id':brand,'file':str(f.relative_to(ROOT)),'key':f'_clients/{brand}/{rel}','sha256':h})
 return rel

def add(brand,key,label,form,lang,svg,source,group=None):
 assert not svg.xpath('//*[local-name()="image"]'), 'Raster SVG rejected'
 dest=OUT/brand;dest.mkdir(exist_ok=True)
 f=dest/(key+'.svg');f.write_bytes(E.tostring(svg))
 w,h=[float(x) for x in svg.get('viewBox').split()[2:]]
 png=f.with_suffix('.png');cairosvg.svg2png(url=str(f),write_to=str(png),output_width=round(2000*w/max(w,h)),output_height=round(2000*h/max(w,h)))
 im=Image.open(png);assert im.getbbox() and im.getbbox()[2]>1
 files={'svg':object_file(brand,f),'png':object_file(brand,png)}
 variants=manifests.setdefault(brand,{'schema':1,'algo_v':1,'id':brand,'primary':key,'variants':[]})['variants']
 variants.append({'key':key,'label':label,'form':form,'lockup':form if form in ['symbol','horizontal','vertical','wordmark'] else 'unknown','lang':lang,'color':'original','files':files,'aspect':w/h,'origin':'manual','provider':'사용자 제공 공식 AI · 가이드 제거 검수','derived_from':source,'order':len(variants),'asset_group':group or ('symbol' if form=='symbol' else 'mascot' if form=='mascot' else 'logotype')})
 tile=Image.new('RGB',(400,240),'#ededed');im.thumbnail((370,200));tile.paste(im,((400-im.width)//2,12),im);ImageDraw.Draw(tile).text((8,220),brand+' / '+key,fill='black');thumbs.append(tile)
 return files

def crop_art(svgfile,zone,remove_guides=True,exclude_blue=False):
 r=E.parse(str(svgfile)).getroot()
 bounds={a[0]:tuple(map(float,a[1:])) for ln in svgfile.with_suffix('.bounds.csv').read_text().splitlines() if len(a:=ln.split(','))==5}
 picked=[];rects=[]
 for e in r:
  b=bounds.get(e.get('id'))
  if not b:continue
  x,y,w,h=b
  if not(zone[0]<=x+w/2<=zone[2] and zone[1]<=y+h/2<=zone[3]):continue
  if remove_guides and (e.get('fill') in ['none','#00aeef','#6d6e71','#bcbec0']):continue
  if exclude_blue and e.get('fill')=='#005499':continue
  picked.append(copy.deepcopy(e));rects.append(b)
 assert picked
 x=min(b[0] for b in rects);y=min(b[1] for b in rects);w=max(b[0]+b[2] for b in rects)-x;h=max(b[1]+b[3] for b in rects)-y
 result=E.Element('{'+NS+'}svg',nsmap={None:NS},viewBox=f'{x} {y} {w} {h}',width=str(w),height=str(h))
 result.extend(picked)
 return result

def chungnam():
 brand='south-chungcheong';src=ROOT/'marketing/assets/chungnam-20261010'
 configs={
 'BS2-01': [('ko-mark','국문 상하조합 · 심볼 강조','ko'),('ko-en-mark','국영문 상하조합 · 심볼 강조','ko'),('ko-text','국문 상하조합 · 글자 강조','ko'),('ko-en-text','국영문 상하조합 · 글자 강조','ko')],
 'BS2-02':[('en-short','영문 상하조합 · Chungnam','en'),('en-full','영문 상하조합 · Chungcheongnam-do','en')],
 'BS2-03':[('han-mark','한문 상하조합 · 심볼 강조','unknown'),('han-en-mark','한영문 상하조합 · 심볼 강조','unknown'),('han-text','한문 상하조합 · 글자 강조','unknown'),('han-en-text','한영문 상하조합 · 글자 강조','unknown')],
 'BS2-04':[('ko-horizontal','국문 좌우조합','ko'),('ko-en-horizontal','국영문 좌우조합','ko')],
 'BS2-05':[('en-short-horizontal','영문 좌우조합 · Chungnam','en'),('en-full-horizontal','영문 좌우조합 · Chungcheongnam-do','en')],
 'BS2-06':[('han-horizontal','한문 좌우조합','unknown'),('han-en-horizontal','한영문 좌우조합','unknown')],
 }
 for page,items in configs.items():
  zones=[(120,275,275,420),(330,275,495,420),(120,505,275,670),(330,505,495,670)] if len(items)==4 else [(110,275,510,420),(110,500,510,670)]
  for item,zone in zip(items,zones):
   key,label,lang=item;add(brand,key,label,'horizontal' if 'horizontal' in key else 'vertical',lang,crop_art(src/(page+'.svg'),zone),page+'.ai')
 add(brand,'symbol','심볼마크','symbol','none',crop_art(src/'BS2-01.svg',(120,275,275,365),exclude_blue=True),'BS2-01.ai')
 for row in range(3):
  for col in range(3):
   key=f'emblem-{row+1}-{col+1}';zone=(135+140*col,245+155*row,245+140*col,345+160*row)
   add(brand,key,f'엠블럼 {"A" if row<2 else "B"}-{row*3+col+1 if row<2 else col+1}','emblem','ko',crop_art(src/'BS3-08.svg',zone,False),'BS3-08.ai','emblem')
 add(brand,'characters','캐릭터 · 기본형 2종','mascot','none',crop_art(src/'BS4-01.svg',(150,270,460,510),False),'BS4-01.ai')
 primary=next(v for v in manifests[brand]['variants'] if v['key']=='ko-horizontal');manifests[brand]['primary']=primary['key']
 patches[brand]={'name_ko':'충청남도','name_en':'Chungcheongnam-do','origin':'KR','category':'공공·기관','has_svg':True,'has_png':True,'logo_svg':primary['files']['svg'],'svg_transparent':primary['files']['svg'],'logo_png':primary['files']['png'],'preview_png':'https://logo.vibers.co.kr/_clients/'+brand+'/'+primary['files']['png'],'light':False,'light_logo':False,'dark_variant':False,'asset_review_status':'verified','variants_n':len(manifests[brand]['variants']),'rejected_asset_files':['logo-icon.png','logo-800.png','logo-transparent.png','logo-white.png']}

def nonsan():
 brand='nonsan-strawberry-expo-2027';src=ROOT/'marketing/assets/nonsan-expo-20261010'
 for i,f in enumerate(sorted((src/'ai').glob('*.ai'))):
  p=fitz.open(f)[0];r=E.fromstring(p.get_svg_image(text_as_path=True).encode())
  key='symbol' if f.stem=='심벌마크' else f'identity-{i+1:02}'
  form='symbol' if key=='symbol' else 'horizontal' if f.stem.startswith('시그니처') else 'wordmark'
  lang='en' if f.stem=='시그니처 - 영문' else 'none' if key=='symbol' else 'unknown' if '국일문' in f.stem or '국중문' in f.stem else 'ko'
  add(brand,key,f.stem,form,lang,r,f.name)
 primary=next(v for v in manifests[brand]['variants'] if v['label']=='시그니처 - 국영문');manifests[brand]['primary']=primary['key']
 patches[brand]={'id':brand,'name_ko':'2027 논산세계딸기산업엑스포','name_en':'2027 Nonsan World Strawberry Industry Expo','category':'문화·행사','origin':'KR','aliases':['논산딸기엑스포','논산세계딸기산업엑스포','2027 논산 엑스포'],'has_svg':True,'has_png':True,'logo_svg':primary['files']['svg'],'svg_transparent':primary['files']['svg'],'logo_png':primary['files']['png'],'preview_png':'https://logo.vibers.co.kr/_clients/'+brand+'/'+primary['files']['png'],'asset_origin':'사용자 제공 행사 EI 공식 배포 ZIP','asset_review_status':'verified','variants_n':len(manifests[brand]['variants']),'added_at':'2026-10-10','logo_published_at':'2026-10-10T08:00:00Z','rejected_asset_files':['logo.svg','logo.png','logo-icon.png','logo-800.png','logo-transparent.png','logo-white.png'],'brand_manual':object_file(brand,src/'brand-manual.pdf')}

def trimmed_source(f,only_left=False):
 r=E.parse(str(f)).getroot()
 for i,e in enumerate(r):
  if E.QName(e).localname!='defs':e.set('id','component-'+str(i))
 temp=OUT/'query.svg';temp.write_bytes(E.tostring(r))
 q=subprocess.check_output(['inkscape','--query-all',str(temp)],text=True)
 bounds={a[0]:tuple(map(float,a[1:])) for ln in q.splitlines() if len(a:=ln.split(','))==5}
 if only_left:
  rects=[]
  for e in list(r):
   if E.QName(e).localname=='defs':continue
   b=bounds.get(e.get('id'))
   if not b or b[0]+b[2]/2>400:r.remove(e)
   else:rects.append(b)
  x=min(b[0] for b in rects);y=min(b[1] for b in rects);w=max(b[0]+b[2] for b in rects)-x;h=max(b[1]+b[3] for b in rects)-y
 else:x,y,w,h=bounds['art-root']
 r.set('viewBox',f'{x} {y} {w} {h}');r.set('width',str(w));r.set('height',str(h))
 return r

def dangjin():
 src=ROOT/'marketing/assets/dangjin-20261010';brand='dangjin'
 for filename,key,label,form,lang in [
  ('SymbolMark','symbol','심볼마크','symbol','none'),
  ('LogoType','wordmark','로고타입 · 당찬 당진','wordmark','ko'),
  ('Signature','signature','시그니처 · Energetic Dangjin','horizontal','ko'),
  ('Character','character','캐릭터 · 기본형','mascot','none')]:
  add(brand,key,label,form,lang,trimmed_source(src/('DangjnCity_'+filename+'.svg')),'DangjnCity_'+filename+'.ai')
 manifests[brand]['primary']='signature';p=next(v for v in manifests[brand]['variants'] if v['key']=='signature')
 patches[brand]={'has_svg':True,'has_png':True,'logo_svg':p['files']['svg'],'svg_transparent':p['files']['svg'],'logo_png':p['files']['png'],'preview_png':'https://logo.vibers.co.kr/_clients/'+brand+'/'+p['files']['png'],'light':False,'light_logo':False,'dark_variant':False,'variants_n':4,'asset_review_status':'verified','rejected_asset_files':['logo-icon.png','logo-800.png','logo-transparent.png','logo-white.png']}
 brand='dangjin-port';f=src/'DangjnCity_Port.svg'
 p=add(brand,'signature','당진항 · 국영문 좌우조합','horizontal','ko',trimmed_source(f),'DangjnCity_Port.ai')
 add(brand,'symbol','당진항 · 심볼마크','symbol','none',trimmed_source(f,True),'DangjnCity_Port.ai')
 patches[brand]={'id':brand,'name_ko':'당진항','name_en':'Port of Dangjin','category':'공공·기관','origin':'KR','has_svg':True,'has_png':True,'logo_svg':p['svg'],'svg_transparent':p['svg'],'logo_png':p['png'],'preview_png':'https://logo.vibers.co.kr/_clients/'+brand+'/'+p['png'],'asset_origin':'사용자 제공 당진시 공식 AI','asset_review_status':'verified','variants_n':2,'added_at':'2026-10-10','logo_published_at':'2026-10-10T08:00:00Z','rejected_asset_files':['logo.svg','logo.png','logo-icon.png','logo-800.png','logo-transparent.png','logo-white.png']}

def icons():
 for brand,m in manifests.items():
  if not any(v['form']=='symbol' for v in m['variants']):continue
  im=Image.open(OUT/brand/'symbol.png').convert('RGBA');im=im.crop(im.getbbox());im.thumbnail((896,896),Image.Resampling.LANCZOS)
  canvas=Image.new('RGBA',(1024,1024));canvas.alpha_composite(im,((1024-im.width)//2,(1024-im.height)//2));f=OUT/brand/'icon-1024.png';canvas.save(f)
  patches[brand]['icon_png']=object_file(brand,f)

if __name__=='__main__':
 chungnam();nonsan();dangjin();icons()
 for brand,folder in [('south-chungcheong','chungnam-20261010'),('nonsan-strawberry-expo-2027','nonsan-expo-20261010'),('dangjin','dangjin-20261010'),('dangjin-port','dangjin-20261010')]:
  patches[brand]['source_zip']=object_file(brand,ROOT/'marketing/assets'/folder/'original-ai.zip')
 release={'patches':patches,'variants':manifests}
 (OUT/'release.json').write_text(json.dumps(release,ensure_ascii=False,indent=2));(OUT/'uploads.json').write_text(json.dumps(uploads,ensure_ascii=False,indent=2))
 sheet=Image.new('RGB',(400*4,240*((len(thumbs)+3)//4)),'white')
 for i,t in enumerate(thumbs):sheet.paste(t,((i%4)*400,(i//4)*240))
 sheet.save(OUT/'contact-sheet.jpg');print({k:len(v['variants']) for k,v in manifests.items()})

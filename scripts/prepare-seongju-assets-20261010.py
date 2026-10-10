from pathlib import Path
import subprocess,copy,json,re,hashlib,io
from lxml import etree as E
import cairosvg,fitz
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'marketing/assets/seongju-20261010';BRAND='sj-2';uploads=[];variants=[]
def add(key,label,form,lang,files):
 dest={}
 for ext,f in files.items():
  raw=f.read_bytes();h=hashlib.sha256(raw).hexdigest();rel=f'sources/seongju-20261010/{h[:16]}.{ext}';dest[ext]=rel;uploads.append({'id':BRAND,'file':str(f.relative_to(ROOT)),'key':f'_clients/{BRAND}/{rel}','sha256':h})
 variants.append({'key':key,'label':label,'form':form,'lockup':form,'lang':lang,'text_layout':lang,'color':'original','files':dest,'origin':'official','provider':'성주군 공식 상징물 · 활용 시 군수 승인 필요','order':len(variants)})
def page(source,n,name):
 f=OUT/(name+'.svg')
 if source=='chambyeoli_down-0.pdf':
  d=fitz.open(OUT/source);f.write_text(d[n-1].get_svg_image(text_as_path=True))
 else:subprocess.run(['pdftocairo','-f',str(n),'-l',str(n),'-svg',str(OUT/source),str(f)],check=True)
 r=E.parse(str(f)).getroot()
 for i,e in enumerate(r):
  if E.QName(e).localname!='defs':e.set('id','top'+str(i))
 
 for i,e in enumerate(r.iter()):
  if not e.get('id'):e.set('id','node'+str(i))
 E.ElementTree(r).write(str(f));q=subprocess.check_output(['inkscape','--query-all',str(f)],text=True);(OUT/(name+'-bounds.csv')).write_text(q)
 bounds={a[0]:tuple(float(x)*(1 if source=='chambyeoli_down-0.pdf' else .75) for x in a[1:]) for ln in q.splitlines() if len(a:=ln.split(','))==5};return r,bounds
report=[]
def extract(src,bounds,key,label,box,form='mascot',lang='none',pdf_page=None):
 r=copy.deepcopy(src);bb=[]
 def prune(parent):
  for e in list(parent):
   if E.QName(e).localname=='defs':continue
   b=bounds.get(e.get('id'));inside=b and b[0]>=box[0] and b[1]>=box[1] and b[0]+b[2]<=box[2] and b[1]+b[3]<=box[3]
   if inside:bb.append(b)
   elif E.QName(e).localname=='g':
    prune(e)
    if not len(e):parent.remove(e)
   else:parent.remove(e)
 prune(r)
 assert bb,key
 # Keep only referenced definitions, including dependencies of gradients/clips.
 defs=r.find('{http://www.w3.org/2000/svg}defs')
 if defs is not None:
  needed=set(re.findall(rb'(?:url\(#|href="#)([^)"\s]+)',b''.join(E.tostring(e) for e in r if e is not defs)))
  while True:
   old=set(needed)
   for e in defs:
    if (e.get('id') or '').encode() in needed:needed.update(re.findall(rb'(?:url\(#|href="#)([^)"\s]+)',E.tostring(e)))
   if old==needed:break
  for e in list(defs):
   if (e.get('id') or '').encode() not in needed:defs.remove(e)
 x=min(b[0] for b in bb)-2;y=min(b[1] for b in bb)-2;w=max(b[0]+b[2] for b in bb)-x+2;h=max(b[1]+b[3] for b in bb)-y+2
 r.set('viewBox',f'{x} {y} {w} {h}');r.set('width',str(w));r.set('height',str(h));raw=E.tostring(r)
 png=OUT/(key+'.png');cairosvg.svg2png(bytestring=raw,write_to=str(png),output_width=round(1200*w/max(w,h)),output_height=round(1200*h/max(w,h)));assert Image.open(png).getbbox()
 if pdf_page is not None:
  doc=fitz.open(OUT/'chambyeoli_down-0.pdf');clip=fitz.Rect(box);pix=doc[pdf_page-1].get_pixmap(matrix=fitz.Matrix(1200/max(clip.width,clip.height),1200/max(clip.width,clip.height)),clip=clip,alpha=True);pix.save(png)
  im=Image.open(png);bb2=im.getbbox();assert bb2;im.crop(bb2).save(png)
 files={'png':png}
 if b'<image' not in raw:
  f=OUT/(key+'.svg');f.write_bytes(raw);files['svg']=f
 add(key,label,form,lang,files);report.append({'key':key,'objects':len(bb),'box':box,'svg':'svg' in files});print(key,len(bb),'SVG' if 'svg' in files else 'PNG',flush=True)
# Crop coordinates in original PDF points; exclude captions and manual headers.
r,b=page('symbol.pdf',1,'ci');extract(r,b,'ci-symbol','CI · 심볼마크',(0,0,430,420),'symbol')
r,b=page('down4-0.ai',1,'slogan');extract(r,b,'slogan-chamhada','브랜드 슬로건 · 성주는 참하다',(120,325,470,560),'wordmark','ko')
for n in range(1,5):
 r,b=page('chambyeoli_down-0.pdf',n,f'character{n}')
 if n==1:
  extract(r,b,'character-basic','참별이 · 기본형',(250,230,450,525),pdf_page=n);extract(r,b,'character-outline','참별이 · 단색형',(570,320,700,490),pdf_page=n);continue
 if n in [2,3]:
  names=['안녕','최고야','잘가','힘차게','금지','꿀잠','사랑해','축하해'] if n==2 else ['안내 왼쪽','안내 오른쪽','부채질','둥둥','알립니다','프레젠테이션','멈춰요','복 받으세요']
  for i,name in enumerate(names):
   col=i%4;row=i//4;xs=([265,375,480,590] if row==0 else [265,375,505,600]) if n==3 else [265,395,510,615];xe=([375,480,590,735] if row==0 else [375,505,605,735]) if n==3 else [375,475,590,705];ys=[220,355];ye=[312,465]
   extract(r,b,f'character-motion{n}-{i+1}','참별이 · '+name,(xs[col],ys[row],xe[col],ye[row]),pdf_page=n)
 else:
  names=['힘내','최고','열일 중','비 오는 날','시무룩','자축','시원하다','러브','궁금해','아이 좋아']
  for i,name in enumerate(names):
   col=i%5;row=i//5;xs=[245,360,460,575,685];xe=[320,430,545,650,765];ys=[220,360];ye=[300,440]
   extract(r,b,f'character-emotion-{i+1}','참별이 · '+name,(xs[col],ys[row],xe[col],ye[row]),pdf_page=n)
# JPG originals are retained; transparent derivatives remove only edge-connected white.
for file,key,label in [('down3-0.jpg','chambyeolmiso','공동브랜드 · 참별미소'),('down5-0.jpg','byeolmat','가공품 공동브랜드 · 별의별맛')]:
 im=Image.open(OUT/file).convert('RGBA');rgb=im.convert('RGB');mask=Image.new('L',im.size);pix=rgb.load();seen=set();stack=[(x,0) for x in range(im.width)]+[(x,im.height-1) for x in range(im.width)]+[(0,y) for y in range(im.height)]+[(im.width-1,y) for y in range(im.height)]
 while stack:
  x,y=stack.pop()
  if (x,y) in seen or not (0<=x<im.width and 0<=y<im.height):continue
  seen.add((x,y))
  if min(pix[x,y])<240:continue
  im.putpixel((x,y),(255,255,255,0));stack.extend([(x-1,y),(x+1,y),(x,y-1),(x,y+1)])
 bb=im.getbbox();assert bb;im=im.crop(bb);f=OUT/(key+'.png');im.save(f);add(key,label+' · 투명','wordmark','ko',{'png':f})
 original=OUT/(key+'-white.png');Image.open(OUT/file).save(original);add(key+'-white',label+' · 흰 배경 원본','wordmark','ko',{'png':original})
m={'schema':1,'algo_v':3,'id':BRAND,'primary':'ci-symbol','variants':variants};first=variants[0]['files']
patch={'name_ko':'성주군','name_en':'Seongju County','origin':'KR','category':'공공·기관','website':'https://www.sj.go.kr/','has_png':True,'has_svg':True,'logo_png':first['png'],'logo_svg':first['svg'],'svg_transparent':first['svg'],'preview_png':f"https://logo.vibers.co.kr/_clients/{BRAND}/{first['png']}",'variants_n':len(variants),'official_source_page':'https://www.sj.go.kr/page.do?mnu_uid=1014','asset_origin':'성주군 공식 상징물 · 물품 제작 및 행사 활용 시 군수 승인 필요','asset_review_status':'verified','light':False,'light_logo':False,'dark_variant':False,'rejected_asset_files':['logo.png','logo-800.png','logo-transparent.png','logo-white.png','logo-icon.png']}
from datetime import datetime,timezone
patch['logo_published_at']=datetime.now(timezone.utc).isoformat()
release={'patches':{BRAND:patch,'gongu-ci-1235':{'variant_of':BRAND,'merged_into':BRAND,'hidden':False,'hidden_reason':'성주군 공식 상징물 콘텐츠로 통합'}},'variants':{BRAND:m}}
(OUT/'release.json').write_text(json.dumps(release,ensure_ascii=False,indent=2)+'\n');(OUT/'uploads.json').write_text(json.dumps(uploads,indent=2)+'\n');(OUT/'extraction.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');(ROOT/'src/lib/reviewed-seongju-20261010.json').write_text(json.dumps(release,ensure_ascii=False,indent=2)+'\n')
sheet=Image.new('RGB',(1200,((len(variants)+5)//6)*190),'#ddd');d=ImageDraw.Draw(sheet)
for i,v in enumerate(variants):
 f=next(ROOT/u['file'] for u in uploads if u['key']==f"_clients/{BRAND}/{v['files']['png']}");im=Image.open(f).convert('RGBA');im.thumbnail((180,150));x=i%6*200;y=i//6*190;sheet.paste(im,(x+(200-im.width)//2,y+20),im);d.text((x+4,y+175),v['key'],fill='black')
sheet.save(OUT/'contact.jpg');print('TOTAL',len(variants),'variants',len(uploads),'files')

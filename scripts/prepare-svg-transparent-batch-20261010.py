"""Conservative Z batch: exact full-canvas white path removal, no raster white flood erasure."""
import json,subprocess,hashlib,io,concurrent.futures
from lxml import etree as E
from pathlib import Path
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'marketing/assets/svg-transparent-batch-20261010';CDN='https://logo.vibers.co.kr/_clients'
a=json.load(open(ROOT/'marketing/assets/collection-coverage/catalog.json'));end=next(i for i,b in enumerate(a) if b['id']=='zzn');brands=list(reversed(a[end-31:end+1]))
def fetch(b):
 d=OUT/b['id'];d.mkdir(exist_ok=True)
 if not (d/'logo.svg').exists():subprocess.run(['curl','-fLsS','--max-time','30','-H','Referer: https://semologo.com/','-o',str(d/'logo.svg'),CDN+'/'+b['id']+'/logo.svg'],check=True)
 # Existing no-PNG import has no manifest; release adds rather than mutates originals.
 return b
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 results=[]
 for b in brands:
  pass
 futures={pool.submit(fetch,b):b for b in brands}
 for f in concurrent.futures.as_completed(futures):
  try:results.append(f.result())
  except Exception as e:print('FETCH SKIP',futures[f]['id'])
node="""const sharp=require('sharp');let a=[];process.stdin.on('data',d=>a.push(d));process.stdin.on('end',async()=>{try{let b=Buffer.concat(a);process.stdout.write(await sharp(b,{density:72,limitInputPixels:100000000}).resize({width:+process.argv[1],height:+process.argv[1],fit:'inside'}).png().toBuffer())}catch(e){console.error(e.message);process.exitCode=1}});"""
def render(raw,size):
 body=subprocess.check_output(['node','-e',node,str(size)],input=raw,cwd=ROOT,stderr=subprocess.PIPE)
 im=Image.open(io.BytesIO(body)).convert('RGBA');box=im.getchannel('A').getbbox()
 if box:im=im.crop(box)
 im.thumbnail((size,size));out=io.BytesIO();im.save(out,format='PNG',optimize=True);return out.getvalue()
patches={};variants={};uploads=[];decisions=[];review=[]
for b in brands:
 id=b['id'];d=OUT/id
 if not (d/'logo.svg').exists():continue
 raw=(d/'logo.svg').read_bytes()
 try:
  if b'<image' in raw or b'data:image' in raw:raise ValueError('embedded raster')
  x=E.fromstring(raw);removed=False
  first=next((n for n in x.iter() if E.QName(n).localname=='path'),None)
  if first is not None and first.get('fill','').lower() in ['#fff','#ffffff','white'] and first.get('d')=='M0 0h192.756v192.756H0V0z' and x.get('viewBox')=='0 0 192.756 192.756':
   first.getparent().remove(first);raw=E.tostring(x);removed=True
  png=render(raw,640)
  im=Image.open(io.BytesIO(png)).convert('RGBA');alpha=im.getchannel('A');bbox=alpha.getbbox()
  if not bbox:raise ValueError('empty vector')
  transparent=sum(v==0 for v in alpha.getdata())/(im.width*im.height)
  # Opaque SVG backgrounds need reviewed vector shape removal; never erase white artwork automatically.
  safe=transparent>0.025
  decisions.append({'id':id,'transparent_fraction':round(transparent,4),'decision':'native-alpha-candidate' if safe else 'opaque-background-manual-review','source_sha256':hashlib.sha256((d/'logo.svg').read_bytes()).hexdigest(),'removed_exact_canvas_path':removed})
  (d/'preview.png').write_bytes(png);review.append((id,im,safe))
  if not safe:continue
  files={}
  for name,body in [('original.svg',(d/'logo.svg').read_bytes()),('logo.svg',raw),('preview.png',png),('logo.png',render(raw,2000))]:
   sha=hashlib.sha256(body).hexdigest();rel='sources/reviewed-alpha-20261010/'+sha[:16]+'/'+name;dest=d/rel;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(body);files[name]=rel;uploads.append({'id':id,'file':str(dest.relative_to(ROOT)),'key':'_clients/'+id+'/'+rel,'sha256':sha})
  patches[id]={'has_svg':True,'logo_svg':True,'has_png':True,'svg_transparent':files['logo.svg'],'logo_png':files['logo.png'],'preview_png':CDN+'/'+id+'/'+files['preview.png'],'asset_review_status':'awaiting-visual-review'}
  primary={'key':'reviewed-transparent','form':'logo','color':'original','label':'투명 배경 로고','files':{'svg':files['logo.svg'],'png':files['logo.png']},'provider':'보유 벡터 원본 · 투명 PNG 재생성','origin':'derived','order':0}
  old={}
  try:old=json.loads((d/'variants.json').read_text())
  except Exception:pass
  variants[id]={**old,'schema':1,'id':id,'primary':primary['key'],'variants':[primary,*old.get('variants',[])]}
 except Exception as e:decisions.append({'id':id,'decision':'skip','reason':str(e)[:200]})
# This file remains candidate pending contact-sheet review by agent.
for start in range(0,len(review),16):
 sheet=Image.new('RGB',(1200,4*180),'#ddd');draw=ImageDraw.Draw(sheet)
 for k,(id,im,safe) in enumerate(review[start:start+16]):
  x=k%4*300;y=k//4*180;im.thumbnail((140,145))
  for j,col in enumerate(['#eee','#222']):
   bg=Image.new('RGBA',(145,150),col);bg.alpha_composite(im,((145-im.width)//2,(150-im.height)//2));sheet.paste(bg.convert('RGB'),(x+j*150,y))
  draw.text((x,y+155),id+('' if safe else ' OPAQUE'),fill='black')
 sheet.save(OUT/f'contact-{start//16+1}.jpg')
(OUT/'release.json').write_text(json.dumps({'patches':patches,'variants':variants},ensure_ascii=False,indent=2));(OUT/'uploads.json').write_text(json.dumps(uploads,indent=2));(OUT/'decisions.json').write_text(json.dumps(decisions,indent=2));print('Prepared',len(patches),'native-alpha candidates',len(uploads),'objects; review required')

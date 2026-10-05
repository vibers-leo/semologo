#!/usr/bin/env python3
import json,subprocess,concurrent.futures,io,time,urllib.parse
from pathlib import Path
from PIL import Image,ImageDraw
Image.MAX_IMAGE_PIXELS=16000000
out=Path('ops/reviews');votes=json.loads((out/'quality-votes-20261005.json').read_text());quality=next(c['entries'] for c in votes['data'] if c['collection']=='logo_quality');ids=[r['id'] for r in quality if r.get('fields',{}).get('flagged',{}).get('booleanValue') or int(r.get('fields',{}).get('down',{}).get('integerValue',0))>0]
base='https://logo.vibers.co.kr/_clients/'
def get(url):
 for attempt in range(2):
  p=subprocess.run(['curl','-sS','--max-time','12','--max-filesize','2000000','-w','\n%{http_code}',url],capture_output=True);b,_,st=p.stdout.rpartition(b'\n');code=int(st) if st.isdigit() else 0
  if code not in [429,502,503,504]:break
  time.sleep(1)
 return code,b

def check(id):
 prefix=base+urllib.parse.quote(id)+'/';r={'id':id,'assets':{}};tiles=[]
 status,body=get(prefix+'brand.json')
 try:r['brand']=json.loads(body) if status==200 else None
 except:r['brand']=None
 if not r['brand']:
  code,raw=get('https://semologo.com/api/catalog/?'+urllib.parse.urlencode({'q':id,'limit':5}))
  try:r['brand']=next((b for b in json.loads(raw).get('brands',[]) if b['id']==id),None)
  except:pass
 for file in ['logo.png','logo-transparent.png']:
  url=prefix+file
  brand=r.get('brand') or {}
  if file=='logo.png' and isinstance(brand.get('logo_png'),str) and brand['logo_png'].startswith('/'):
   url='https://semologo.com'+brand['logo_png']
  elif file=='logo.png' and isinstance(brand.get('logo_svg'),str) and brand['logo_svg'].startswith('/'):
   url='https://semologo.com/api/logo-preview/?id='+urllib.parse.quote(id)
  status,body=get(url);primary_status=status
  if file=='logo.png' and (status!=200 or not(body.startswith(b'\x89PNG') or body.startswith(b'\xff\xd8'))):
   status,body=get('https://semologo.com/api/logo-preview/?id='+urllib.parse.quote(id))
  a={'status':status,'primary_status':primary_status,'bytes':len(body)}
  try:
   im=Image.open(io.BytesIO(body));im.load();a.update(format=im.format,width=im.width,height=im.height);thumb=im.convert('RGBA');thumb.thumbnail((145,86));tiles.append((file,thumb))
  except Exception:a['invalid']=True
  r['assets'][file]=a
 return r,tiles
rows=[];images=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:
 for n,(r,tiles) in enumerate(ex.map(check,ids),1):
  rows.append(r);images.append((r['id'],tiles));(out/'quality-assets-20261005.json').write_text(json.dumps({'checked':n,'total':len(ids),'rows':rows},ensure_ascii=False,indent=2))
  if n%20==0:print('Checked',n,'/',len(ids),flush=True)
for page in range((len(images)+29)//30):
 batch=images[page*30:(page+1)*30];canvas=Image.new('RGB',(1000,((len(batch)+4)//5)*145),'#ededed');draw=ImageDraw.Draw(canvas)
 for n,(id,tiles) in enumerate(batch):
  x=(n%5)*200;y=(n//5)*145;draw.text((x+5,y+5),id[:28],fill='black')
  for t,(file,im) in enumerate(tiles):
   bg=Image.new('RGBA',(190,52),'white' if t==0 else '#18181b');im=im.copy();im.thumbnail((180,46));bg.alpha_composite(im,((190-im.width)//2,(52-im.height)//2));canvas.paste(bg.convert('RGB'),(x+5,y+25+t*55))
 canvas.save(out/f'quality-contact-{page+1}.png')
print('Finished',len(rows),flush=True)

"""Detect a baked-in white rectangle; never remove logo pixels automatically."""
import concurrent.futures,hashlib,io,json,time,os
from pathlib import Path
import requests
from PIL import Image

ROOT=Path(os.environ.get('SEMOLOGO_AUDIT_ROOT',str(Path(__file__).resolve().parents[2])))
OUT=ROOT/'ops/evidence/public-white-background-20261025'
OUT.mkdir(parents=True,exist_ok=True)
(OUT/'assets').mkdir(exist_ok=True)
data=json.loads((OUT/'range-input.json').read_text())
receipt=OUT/'white-audit.json'
prior=json.loads(receipt.read_text())['items'] if receipt.exists() else []
done={r['id']:r for r in prior if r.get('status')!='fetch-failed'}

def check(row):
 if row['id'] in done and done[row['id']].get('url')==row['url'] and done[row['id']].get('file')==row['file']:
  return done[row['id']]
 result=dict(row)
 try:
  r=requests.get(row['url'],headers={'User-Agent':'Mozilla/5.0 SemoLogo asset review'},timeout=20)
  r.raise_for_status();raw=r.content
  if len(raw)>8_000_000:raise ValueError('asset-too-large')
  im=Image.open(io.BytesIO(raw))
  if im.width*im.height>12_000_000:raise ValueError('pixel-budget-exceeded')
  im.load();fmt=im.format
  rgba=im.convert('RGBA');box=rgba.getchannel('A').getbbox()
  if not box:raise ValueError('empty-image')
  crop=rgba.crop(box);w,h=crop.size
  edges=[crop.getpixel((x,y)) for y in [0,h-1] for x in range(w)]
  edges += [crop.getpixel((x,y)) for x in [0,w-1] for y in range(h)]
  white=lambda p:p[3]>=250 and min(p[:3])>=245
  ratio=sum(white(p) for p in edges)/len(edges)
  small=crop.copy();small.thumbnail((400,400));pixels=list(small.getdata())
  fraction=sum(white(p) for p in pixels)/len(pixels)
  opaque_white=ratio>=.97 and fraction>=.2 and w>=40 and h>=15
  result.update(status='white-background' if opaque_white else 'not-white-background',
    format=fmt,width=im.width,height=im.height,sha256=hashlib.sha256(raw).hexdigest(),
    edgeWhiteRatio=round(ratio,4),whiteFraction=round(fraction,4),alphaMin=rgba.getchannel('A').getextrema()[0])
  if opaque_white:(OUT/'assets'/(row['id']+'.png')).write_bytes(raw)
 except Exception as e:result.update(status='fetch-failed',error=str(e)[:160])
 return result

results=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
 for i,row in enumerate(pool.map(check,data['items']),1):
  results.append(row)
  if i%50==0 or i==len(data['items']):
   report={k:v for k,v in data.items() if k!='items'}
   report.update(checked=i,white=sum(r['status']=='white-background' for r in results),
     failures=sum(r['status']=='fetch-failed' for r in results),items=results)
   tmp=receipt.with_suffix('.tmp');tmp.write_text(json.dumps(report,ensure_ascii=False,indent=2));tmp.replace(receipt)
   print(json.dumps({k:v for k,v in report.items() if k!='items'}),flush=True)

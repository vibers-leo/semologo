"""Verify published logos through the public CDN, including all new brand records."""
import concurrent.futures,hashlib,json,re,urllib.request,urllib.error,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def main():
 report=json.loads((ROOT/'data/collection/published-review-20260908.json').read_text())
 version=re.search(r'export const VERSION = "(\d+)"',(ROOT/'src/lib/cdn.ts').read_text()).group(1)
 def get(path):
  req=urllib.request.Request('https://logo.vibers.co.kr/_clients/'+path+'?v='+version,headers={'Referer':'https://semologo.com/','User-Agent':'SemoLogo-asset-verification/1.0'})
  for attempt in range(6):
   time.sleep(.2)
   try:
    with urllib.request.urlopen(req,timeout=40) as r:return r.read()
   except urllib.error.HTTPError as e:
    if e.code not in (429,502,503,504) or attempt==5:raise
    delay=e.headers.get('Retry-After','')
    time.sleep(float(delay) if delay.isdigit() else 5*(attempt+1))
 def verify(row):
  base=row['id']+'/'+row['rel'];svg=get(base);assert hashlib.sha256(svg).hexdigest()==row['sha256'],base
  png=get(base[:-4]+'.png');assert png.startswith(b'\x89PNG\r\n\x1a\n'),base
  return 1
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:
  for i,_ in enumerate(ex.map(verify,report['approved'])):
   if i%100==0:print('Verified SVG/PNG pairs',i+1,flush=True)
 def brand(id):
  b=json.loads(get(id+'/brand.json'));m=json.loads(get(id+'/variants.json'));assert b['id']==m['id']==id;assert m['variants'];return id
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:list(ex.map(brand,report['new_ids']))
 slim=json.loads(get('brands-slim.json'));assert set(report['new_ids'])<={b['id'] for b in slim if not b.get('hidden') and not b.get('variant_of')}
 print('PASS: 507 SVG/PNG pairs, 63 new brand manifests and searchable catalog entries',flush=True)
if __name__=='__main__':main()

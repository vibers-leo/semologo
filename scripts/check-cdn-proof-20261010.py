"""Resumable exact-byte checks of already-published immutable release keys, through public CDN."""
import concurrent.futures,hashlib,json,time,urllib.request,urllib.error,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'marketing/assets/cdn-proof20261010';OUT.mkdir(exist_ok=True);PROGRESS=OUT/'progress.jsonl'
folders=sys.argv[1:] or ['png-recollection-ai-batch3-20261010','png-recollection-ai-batch4-20261010','png-recollection-zip-batch5-20261010','baemin-guide-fix-20261010']
rows=[]
for folder in folders:
 path=ROOT/'marketing/assets'/folder
 if not (path/'published.json').exists():raise SystemExit('Not published yet: '+folder)
 for row in json.load(open(path/'uploads.json')):rows.append({**row,'release':folder})
previous={}
if PROGRESS.exists():
 for line in PROGRESS.read_text().splitlines():
  try:r=json.loads(line);previous[(r['key'],r['sha256'])]=r
  except:pass
rows=list({(r['key'],r['sha256']):r for r in rows}.values());todo=[r for r in rows if previous.get((r['key'],r['sha256']),{}).get('status')!='verified']
def verify(row):
 key=row['key']
 if not key.startswith('_clients/') or '..' in key.split('/'):return {**row,'status':'unsafe-key'}
 url='https://logo.vibers.co.kr/'+urllib.parse.quote(key,safe='/')
 for attempt in range(5):
  try:
   request=urllib.request.Request(url,headers={'Referer':'https://semologo.com/','User-Agent':'Mozilla/5.0 SemoLogo/1.0'})
   with urllib.request.urlopen(request,timeout=35) as response:
    digest=hashlib.sha256();size=0
    while True:
     chunk=response.read(1024*1024)
     if not chunk:break
     digest.update(chunk);size+=len(chunk)
   sha=digest.hexdigest();return {'release':row['release'],'id':row['id'],'key':key,'sha256':row['sha256'],'actual_sha256':sha,'bytes':size,'status':'verified' if sha==row['sha256'] else 'hash-mismatch'}
  except urllib.error.HTTPError as e:
   if e.code in [429,502,503,504] and attempt<4:time.sleep(min(30,5*(attempt+1)));continue
   return {'release':row['release'],'id':row['id'],'key':key,'sha256':row['sha256'],'status':'failed','http_status':e.code}
  except Exception as e:
   if attempt<2:time.sleep(3);continue
   return {'release':row['release'],'id':row['id'],'key':key,'sha256':row['sha256'],'status':'failed','error':type(e).__name__}
 time.sleep(.2)
with PROGRESS.open('a') as log,concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 for i,result in enumerate(pool.map(verify,todo),1):
  log.write(json.dumps(result,ensure_ascii=False)+'\n');log.flush();previous[(result['key'],result['sha256'])]=result
  if i%25==0:print('CDN checked',i,'/',len(todo),flush=True)
results=[previous[(r['key'],r['sha256'])] for r in rows];counts={}
for r in results:counts[r['status']]=counts.get(r['status'],0)+1
report={'scope':'Exact uploaded manifest keys; public CDN SHA-256 verification, not browser/UI review','releases':folders,'objects':len(rows),'counts':counts,'results':results}
(OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='results'}),flush=True)
if counts.get('verified')!=len(rows):sys.exit(1)

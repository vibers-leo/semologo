#!/usr/bin/env python3
import concurrent.futures, json, re
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

ROOT=Path(__file__).resolve().parents[1]
MAN=ROOT/'data/collection/us-equity-index-logo-discovery.json'
OUT=ROOT/'artifacts/index-logo-candidates'
GOOD=re.compile(r'(logo|brand|mark|favicon|og[-_])',re.I)

def one(job):
    item,u=job
    try:
        req=Request(u,headers={'User-Agent':'SemoLogo-index-collector/1.0'})
        with urlopen(req,timeout=12) as r:
            data=r.read(1024*1024+1); ct=r.headers.get('Content-Type','')
        if len(data)>1024*1024 or len(data)<100: return item['ticker'],None
        name=re.sub(r'[^0-9A-Za-z._-]','_',Path(urlparse(u).path).name or 'logo')
        folder=OUT/re.sub(r'[^A-Za-z0-9._-]','_',item['ticker']); folder.mkdir(parents=True,exist_ok=True)
        path=folder/name; path.write_bytes(data)
        return item['ticker'],{'url':u,'file':str(path.relative_to(ROOT)),'bytes':len(data),'content_type':ct}
    except Exception: return item['ticker'],None

d=json.loads(MAN.read_text()); items=d['items']; jobs=[]
for item in items:
    links=[u for u in item.get('asset_links',[]) if GOOD.search(Path(urlparse(u).path).name)][:2]
    if links: jobs.append((item,links[0]))
with concurrent.futures.ThreadPoolExecutor(max_workers=32) as ex:
    got=dict(ex.map(one,jobs))
count=0
for item in items:
    x=got.get(item['ticker'])
    if x:
        item['staged_candidate']=x; item['status']='candidate-asset-staged'; count+=1
d['staged_candidate_count']=count
MAN.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
print('downloaded',count,'of',len(jobs),'filtered candidates')

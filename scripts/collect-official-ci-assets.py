#!/usr/bin/env python3
import argparse,json,re,sys,tempfile,os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import Request,urlopen
ROOT=Path(__file__).resolve().parents[1]; QUEUE=ROOT/'data/collection/public-ci-index.json'; OUT=ROOT/'data/collection/official-ci-assets-staged.json'; EXTS=('.ai','.svg','.eps','.pdf','.zip','.png','.jpg','.jpeg')
def page(url):
 req=Request(url,headers={'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36','Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'})
 with urlopen(req,timeout=20) as r:return r.read(2_000_000).decode('utf-8','replace')
def links(source,html):
 found=[]
 for href in re.findall(r'''(?:href|src)=["']([^"']+)["']''',html,re.I):
  u=urljoin(source,href).split('#')[0]; path=u.lower().split('?')[0]
  if path.endswith(EXTS) and u not in found:found.append(u)
 return found
def main():
 parser=argparse.ArgumentParser(description='Stage bounded asset links from fixed official CI pages')
 parser.add_argument('offset',type=int,nargs='?',default=0)
 parser.add_argument('limit',type=int,nargs='?',default=20)
 parser.add_argument('--missing',action='store_true',help='scan pages not already in the staged manifest')
 parser.add_argument('--retry-failed',action='store_true',help='retry staged pages whose fetch failed or had no direct assets')
 parser.add_argument('--workers',type=int,default=1)
 args=parser.parse_args()
 if not 1<=args.workers<=12 or not 1<=args.limit<=2000:parser.error('invalid worker count or limit')
 q=json.loads(QUEUE.read_text())['candidates']; old={}
 if OUT.exists(): old={x['id']:x for x in json.loads(OUT.read_text()).get('candidates',[])}
 if args.missing and args.retry_failed:parser.error('choose either --missing or --retry-failed')
 q=([x for x in q if x['id'] not in old][:args.limit] if args.missing else
    [x for x in q if x['id'] in old and old[x['id']].get('status') in ('page-fetch-failed','page-no-direct-asset')][:args.limit]
    if args.retry_failed else q[args.offset:args.offset+args.limit])
 def scan(item):
  try:
   assets=links(item['official_source_page'],page(item['official_source_page']))
   return {**item,'asset_links':assets[:20],'status':'asset-links-found' if assets else 'page-no-direct-asset'}
  except Exception as e:return {**item,'asset_links':[],'status':'page-fetch-failed','error':type(e).__name__}
 with ThreadPoolExecutor(max_workers=args.workers) as pool:
  for item in pool.map(scan,q):old[item['id']]=item
 fd,tmp=tempfile.mkstemp(dir=OUT.parent,prefix='.official-ci-assets-')
 try:
  with os.fdopen(fd,'w') as stream:json.dump({'schema':1,'count':len(old),'candidates':list(old.values())},stream,ensure_ascii=False,indent=2);stream.write('\n')
  os.replace(tmp,OUT)
 finally:
  if os.path.exists(tmp):os.unlink(tmp)
 print(json.dumps({'scanned':len(q),'total':len(old),'assetLinksFound':sum(x['status']=='asset-links-found' for x in old.values()),'fetchFailed':sum(x['status']=='page-fetch-failed' for x in old.values())},ensure_ascii=False))
if __name__=='__main__':main()

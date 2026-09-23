#!/usr/bin/env python3
from __future__ import annotations
import json,re,sys
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import Request,urlopen
ROOT=Path(__file__).resolve().parents[1]; QUEUE=ROOT/'data/collection/public-ci-index.json'; OUT=ROOT/'data/collection/official-ci-assets-staged.json'; EXTS=('.ai','.svg','.eps','.pdf','.zip','.png','.jpg','.jpeg')
def page(url):
 req=Request(url,headers={'User-Agent':'SemoLogo-official-ci-collector/1.0'})
 with urlopen(req,timeout=20) as r:return r.read().decode('utf-8','replace')
def links(source,html):
 found=[]
 for href in re.findall(r'''(?:href|src)=["']([^"']+)["']''',html,re.I):
  u=urljoin(source,href).split('#')[0]; path=u.lower().split('?')[0]
  if path.endswith(EXTS) and u not in found:found.append(u)
 return found
def main():
 limit=int(sys.argv[1]) if len(sys.argv)>1 else 20; q=json.loads(QUEUE.read_text())['candidates'][:limit]; rows=[]
 for i,item in enumerate(q,1):
  try:
   assets=links(item['official_source_page'],page(item['official_source_page'])); rows.append({**item,'asset_links':assets[:20],'status':'asset-links-found' if assets else 'page-no-direct-asset'}); print(f'{i}/{len(q)} {item["name_ko"]}: {len(assets)}')
  except Exception as e: rows.append({**item,'asset_links':[],'status':'page-fetch-failed','error':str(e)[:200]}); print(f'{i}/{len(q)} {item["name_ko"]}: ERROR {e}',file=sys.stderr)
 OUT.write_text(json.dumps({'schema':1,'count':len(rows),'candidates':rows},ensure_ascii=False,indent=2)+'\n'); print('wrote',OUT)
if __name__=='__main__':main()

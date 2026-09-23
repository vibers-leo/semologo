#!/usr/bin/env python3
import json, re, sys
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request,urlopen
ROOT=Path(__file__).resolve().parents[1]; src=ROOT/'data/collection/official-ci-assets-staged.json'; out=ROOT/'artifacts/public-ci-assets'

def main():
 d=json.loads(src.read_text()); out.mkdir(parents=True,exist_ok=True); total=ok=0
 for item in d['candidates']:
  if not item.get('asset_links'): continue
  folder=out/item['id']; folder.mkdir(parents=True,exist_ok=True); results=[]
  for i,u in enumerate(item['asset_links']):
   total+=1; name=Path(urlparse(u).path).name or f'asset-{i}'
   name=re.sub(r'[^0-9A-Za-z가-힣._-]','_',name); path=folder/name
   try:
    req=Request(u,headers={'User-Agent':'SemoLogo-official-ci-collector/1.0','Referer':item['official_source_page']})
    with urlopen(req,timeout=25) as r: data=r.read()
    if len(data)<100: raise ValueError('too-small')
    path.write_bytes(data); results.append({'url':u,'file':str(path.relative_to(ROOT)),'bytes':len(data)}); ok+=1
   except Exception as e: results.append({'url':u,'error':str(e)[:180]})
  item['downloads']=results
 d['downloaded_count']=ok; d['download_attempts']=total; (ROOT/'data/collection/official-ci-assets-downloaded.json').write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n'); print('downloaded',ok,'/',total)
if __name__=='__main__':main()

#!/usr/bin/env python3
"""Bounded read-only audit; stores JSON findings, never logo assets."""
import argparse, concurrent.futures, json, subprocess, urllib.parse, datetime
from pathlib import Path

def get(url):
 p=subprocess.run(['curl','-sS','--max-time','12','--max-filesize','2000000','-w','\n%{http_code}',url],capture_output=True)
 body,_,status=p.stdout.rpartition(b'\n')
 return {'status':int(status) if status.isdigit() else 0,'valid_png':body[:8]==b'\x89PNG\r\n\x1a\n','bytes':len(body),'curl_exit':p.returncode}
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--pages',type=int,default=1);ap.add_argument('--output',required=True);args=ap.parse_args()
 base='https://semologo.com';cdn='https://logo.vibers.co.kr/_clients';brands={}
 for mode in ['fame','recent']:
  for page in range(args.pages):
   url=base+'/api/catalog/?'+urllib.parse.urlencode({'sort':mode,'offset':page*120,'limit':120})
   raw=subprocess.check_output(['curl','-fsS','--max-time','30',url]);data=json.loads(raw)
   for b in data['brands']:brands[b['id']]=b
 def check(b):
  direct=b.get('logo_png');u=(base+direct if direct.startswith('/') else direct) if isinstance(direct,str) and '.png' in direct else cdn+'/'+urllib.parse.quote(b['id'])+'/logo.png'
  result=get(u);r={'id':b['id'],'name':b['name_ko'],'png_url':u,'primary':result,'local_svg':isinstance(b.get('logo_svg'),str) and b['logo_svg'].startswith('/')}
  if not(result['status']==200 and result['valid_png']):
   transparent=cdn+'/'+urllib.parse.quote(b['id'])+'/logo-transparent.png';r['transparent']=get(transparent)
   if r['transparent']['status']==200 and r['transparent']['valid_png']:r['recovery']=r['transparent'];r['recovery_url']=transparent
   else:r['recovery']=get(base+'/api/logo-preview/?id='+urllib.parse.quote(b['id']));r['recovery_url']=base+'/api/logo-preview/?id='+urllib.parse.quote(b['id'])
  return r
 rows=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:
  for r in ex.map(check,brands.values()):rows.append(r)
 broken=[r for r in rows if not(r['primary']['status']==200 and r['primary']['valid_png'])]
 missing=[r for r in broken if not(r['recovery']['status']==200 and r['recovery']['valid_png'])]
 out={'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'first fame/recent pages, not entire catalog','checked':len(rows),'primary_failed':len(broken),'unrecovered':len(missing),'rows':rows}
 Path(args.output).write_text(json.dumps(out,ensure_ascii=False,indent=2));print(json.dumps({k:v for k,v in out.items() if k!='rows'},ensure_ascii=False),flush=True)
main()

"""Snapshot matching candidates separately from reviewed identities and PNG bytes."""
import json,re,datetime,hashlib,subprocess,io
from pathlib import Path
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'marketing/assets/collection-coverage'
QUEUES=ROOT/'data/collection/us-equity-index-logo-queue.json'
# Explicit identities reviewed against the saved constituent names. Disney+ is
# deliberately NOT used as the Walt Disney Company identity.
REVIEWED={'MMM':'3m','AAPL':'apple','MSFT':'microsoft','AMZN':'amazon','NVDA':'nvidia','TSLA':'tesla','NFLX':'netflix','ADBE':'adobe','V':'visa','MA':'mastercard','SBUX':'starbucks','MCD':'mcdonalds','ORCL':'oracle','IBM':'ibm','INTC':'intel','AMD':'amd','QCOM':'qualcomm'}
def norm(name):
 name=re.sub(r'\([^)]*\)','',name.lower())
 name=re.sub(r'\b(incorporated|inc|corporation|corp|limited|ltd|plc|company|co)\b','',name)
 return re.sub(r'[^a-z0-9]','',name)
def main():
 raw=QUEUES.read_bytes();queues=json.loads(raw)['queues']
 brands=json.loads((WORK/'catalog.json').read_text()); byid={b['id']:b for b in brands}
 reviews=json.loads((ROOT/'src/lib/logo-quality-review.json').read_text())
 eligible=[b for b in brands if not b.get('hidden') and not b.get('variant_of') and reviews.get(b['id'],{}).get('status') not in ['merged','quarantined']]
 names=defaultdict(set)
 for b in eligible:
  for n in [b.get('name_en',''),b.get('name_ko',''),*b.get('aliases',[])]:
   if norm(n):names[norm(n)].add(b['id'])
 # Local reviewed submissions are additions to the CDN catalog, not a new roster.
 local_text=(ROOT/'src/lib/index-candidate-review-submissions.ts').read_text()
 local_ids=set(re.findall(r'"id":"(us-russell-2000-[^"]+)"',local_text))
 reports=[]
 for queue in queues:
  groups=defaultdict(list)
  for row in queue['items']:
   key=row['cik'] if queue['id']=='us-sp500' else row['exchange']+':'+row['ticker']
   if not key:raise ValueError('Missing roster identity')
   groups[key].append(row)
  members=[]
  for key,rows in groups.items():
   first=rows[0];candidates=set()
   for row in rows:
    candidates.update(names.get(norm(row['company_name']),set()))
    local_id='us-russell-2000-'+row['ticker'].lower().replace('.','-')
    if local_id in local_ids and reviews.get(local_id,{}).get('status') not in ['merged','quarantined']:candidates.add(local_id)
   reviewed=next((REVIEWED.get(r['ticker']) for r in rows if REVIEWED.get(r['ticker'])),None) if queue['id']=='us-sp500' else None
   if reviewed and reviewed not in byid:reviewed=None
   members.append({'member_key':key,'name':first['company_name'],'tickers':[r['ticker'] for r in rows], 'brand_id':reviewed,'candidates':sorted(candidates),'identity_reviewed':bool(reviewed),'png_verified':False})
  def audit(m):
   if not m['brand_id']:return
   id=m['brand_id'];url=f'https://logo.vibers.co.kr/_clients/{id}/logo.png?v=1790381000'
   try:
    result=subprocess.run(['curl','-fsSL','--max-time','15','--max-filesize','1000000',url],capture_output=True,check=True)
    im=Image.open(io.BytesIO(result.stdout));im.verify()
    if im.format!='PNG':raise ValueError('not PNG')
    response=json.loads(subprocess.check_output(['curl','-fsSL','--max-time','15',f'https://semologo.com/api/catalog/?q={id}&limit=120']))
    if not any(b['id']==id for b in response['brands']):raise ValueError('not publicly listed')
    m.update(png_verified=True,png_url=url,asset_sha256=hashlib.sha256(result.stdout).hexdigest())
   except Exception as e:m['asset_error']=type(e).__name__
  with ThreadPoolExecutor(max_workers=4) as pool:list(pool.map(audit,members))
  reports.append({'id':queue['id'],'name':queue['name']+(' · IWM 보유종목 기준' if queue['id']=='us-russell-2000' else ''),'as_of':'2026-09-27' if queue['id']=='us-sp500' else '2026-09-24','source_kind':'saved_constituent_roster' if queue['id']=='us-sp500' else 'etf_holdings_proxy','source_url':queue['source']['url'] if queue['id']=='us-sp500' else 'https://www.ishares.com/us/products/239710/ishares-russell-2000-etf/latest-holdings.csv','source_revision':hashlib.sha256(raw).hexdigest(),'count_unit':'entity' if queue['id']=='us-sp500' else 'security','total':len(members),'securities':len(queue['items']),'verified':sum(m['png_verified'] for m in members),'candidates':sum(bool(m['candidates']) for m in members),'members':members})
 report={'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'collections':reports}
 (WORK/'coverage.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 (ROOT/'data/collection/coverage-summary.json').write_text(json.dumps({'checked_at':report['checked_at'],'collections':[{k:v for k,v in c.items() if k!='members'} for c in reports]},ensure_ascii=False,indent=2)+'\n')
 missing=[{'collection_id':c['id'],**m} for c in reports for m in c['members'] if not m['png_verified']]
 (ROOT/'data/collection/collection-gap-queue.json').write_text(json.dumps({'checked_at':report['checked_at'],'items':missing},ensure_ascii=False,indent=2)+'\n')
 for c in reports:print(c['id'],c['verified'],'/',c['total'],'name candidates',c['candidates'])
if __name__=='__main__':main()

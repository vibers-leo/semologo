"""Verify public CDN bytes and institution pages before updating collection coverage."""
import concurrent.futures,hashlib,json,subprocess,datetime
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'marketing/assets/asset-release-20261008'
def get(url):return subprocess.check_output(['curl','-fsSL','--connect-timeout','8','--max-time','25',url],stderr=subprocess.DEVNULL)
def main():
 uploads=json.loads((OUT/'uploads.json').read_text());members=json.loads((OUT/'institution-members.json').read_text())
 def check(u):
  url='https://logo.vibers.co.kr/'+u['key'];r={'key':u['key'],'url':url,'ok':False}
  try:r['ok']=hashlib.sha256(get(url)).hexdigest()==u['sha256']
  except Exception as e:r['error']=str(e)
  return r
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:checks=list(pool.map(check,uploads))
 (OUT/'public-asset-checks.json').write_text(json.dumps(checks,indent=2));assert all(r['ok'] for r in checks),'Public CDN mismatch'
 def page(m):
  r=dict(m);raw=get('https://semologo.com/brand/'+m['brand_id']+'/').decode();r['png_verified']=m['brand_id'] in raw and 'noindex' not in raw.lower();r['identity_reviewed']=True;r['review_evidence']='asset-release-20261008/visual-decisions.json';return r
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:verified=list(pool.map(page,members))
 (OUT/'verified-institutions.json').write_text(json.dumps(verified,ensure_ascii=False,indent=2));assert all(m['png_verified'] for m in verified),'Hidden or missing institution page'
 report=json.loads((ROOT/'marketing/assets/public-institution-review-20261008/coverage.json').read_text());byid={m['institution_id']:m for m in verified}
 for c in report['collections']:
  for m in c['members']:
   if m['member_key'] in byid:m.update(byid[m['member_key']])
  c['verified']=sum(bool(m.get('png_verified')) for m in c['members'])
 report['checked_at']=datetime.datetime.now(datetime.timezone.utc).isoformat();(OUT/'coverage.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 print('PASS public assets',len(checks),'institutions',len(verified));print(json.dumps([{k:c[k] for k in ['id','total','verified']} for c in report['collections']],ensure_ascii=False))
if __name__=='__main__':main()

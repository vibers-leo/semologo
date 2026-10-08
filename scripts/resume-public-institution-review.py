"""Verify previously reviewed assets and prepare institution membership evidence."""
import concurrent.futures, datetime, hashlib, io, json, subprocess, zipfile
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'marketing/assets/public-institution-vectors-20261007'
OUT=ROOT/'marketing/assets/public-institution-review-20261008'
def get(url):
 return subprocess.check_output(['curl','-fsSL','--connect-timeout','8','--max-time','25','--max-filesize','16000000',url],stderr=subprocess.DEVNULL)
def main():
 OUT.mkdir(exist_ok=True)
 reviews=json.loads((BASE/'existing-svg-review.json').read_text())
 patches=json.loads((BASE/'published-patches.json').read_text())
 approved=[r for r in reviews if r.get('audit_status')=='identity-visually-reviewed']
 def check(r):
  item={'member_key':r['member_key'],'name':r['name'],'brand_id':r['selected_id'],'identity_reviewed':True,'png_verified':False,'review_evidence':'existing-svg-review.json: identity-visually-reviewed'}
  try:
   patch=patches[r['selected_id']];raw=get(patch['preview_png']);im=Image.open(io.BytesIO(raw));im.verify();assert im.format=='PNG'
   assert hashlib.sha256(raw).hexdigest()==patch['asset_sha256'],'PNG hash mismatch'
   page=get('https://semologo.com/brand/'+r['selected_id']+'/').decode('utf-8','replace')
   assert r['selected_id'] in page and 'noindex' not in page.lower(),'Public detail not verified'
   item.update(png_verified=True,png_url=patch['preview_png'],asset_sha256=patch['asset_sha256'])
  except Exception as e:item['error']=str(e)
  return item
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:checked=list(pool.map(check,approved))
 lookup={r['member_key']:r for r in checked if r['png_verified']};collections=[]
 for name in ['coverage.json','local-coverage.json']:
  report=json.loads((ROOT/'marketing/assets/public-institution-roster-20261007'/name).read_text())
  for c in report['collections']:
   for m in c['members']:
    if m['member_key'] in lookup:m.update(lookup[m['member_key']])
   c['verified']=sum(bool(m.get('png_verified')) for m in c['members']);collections.append(c)
 result={'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'collections':collections}
 (OUT/'coverage.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
 (OUT/'asset-checks.json').write_text(json.dumps(checked,ensure_ascii=False,indent=2))
 prepared=json.loads((BASE/'prepared-review.json').read_text())['records'];zips=[]
 # These archive contents were inspected in prepared-sheet-1.jpg; manuals remain originals.
 for key in ['alio-f19c6153841df6d1','alio-690d2fe37bf93842','alio-f55ac0aab320b4f0']:
  r=next(x for x in prepared if x['member_key']==key and x['source_file'].endswith('.zip'))
  raw=(ROOT/r['source_file']).read_bytes()
  with zipfile.ZipFile(io.BytesIO(raw)) as z:
   assert len(z.infolist())<2000
   assert z.testzip() is None
   entries=[n.filename for n in z.infolist() if Path(n.filename).suffix.lower() in ['.ai','.eps','.pdf','.svg']]
   assert entries
  live=get(r['url']);assert hashlib.sha256(live).digest()==hashlib.sha256(raw).digest(),'Official ZIP changed'
  zips.append({'member_key':key,'name':r['name'],'official_page':r['source_page'],'official_zip_url':r['url'],'local_file':r['source_file'],'sha256':hashlib.sha256(raw).hexdigest(),'vector_members':entries,'visual_evidence':r['png_file'],'status':'official-zip-crc-live-hash-and-logo-visual-checked','policy':'Original remains private locally; download from official institution only.'})
 (OUT/'official-zips.json').write_text(json.dumps(zips,ensure_ascii=False,indent=2))
 summary={'checked':len(checked),'passed':len(lookup),'failed':[r for r in checked if not r['png_verified']],'official_zips':len(zips),'collections':[{k:c[k] for k in ['id','total','verified']} for c in collections]}
 (OUT/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2));print(json.dumps(summary,ensure_ascii=False,indent=2))
if __name__=='__main__':main()

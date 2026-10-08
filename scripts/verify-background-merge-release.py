"""Check every immutable public object and released SVG vector integrity."""
import concurrent.futures,hashlib,json,subprocess
from pathlib import Path
from lxml import etree as E
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'marketing/assets/background-merge-review-20261008'
def main():
 uploads=json.loads((OUT/'uploads.json').read_text())
 def check(u):
  raw=subprocess.check_output(['curl','-fsS','--max-time','45','https://logo.vibers.co.kr/'+u['key']]);assert hashlib.sha256(raw).hexdigest()==u['sha256'],u['key']
  if u['key'].endswith('.svg'):assert not E.fromstring(raw).xpath('.//*[local-name()="image"]'), 'Raster mislabeled as vector'
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:list(pool.map(check,uploads))
 (OUT/'cdn-verified.json').write_text(json.dumps({'verified_objects':len(uploads),'all_sha256_match':True},indent=2));print('PASS public CDN SHA256 and genuine vector files:',len(uploads))
if __name__=='__main__':main()

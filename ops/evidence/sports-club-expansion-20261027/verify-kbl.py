import json,subprocess,concurrent.futures,io,hashlib
from pathlib import Path
from PIL import Image
B=Path(__file__).parent;R=json.loads((B/'kbl-receipt.json').read_text())
def get(u):return subprocess.run(['curl','-fsSL','--max-time','35','-A','Mozilla/5.0',u],capture_output=True,check=True).stdout
def verify(r):
 id=r['id'];m=json.loads(get('https://semologo.com/api/logo-variants/?id='+id+'&review=kbl20261027'));vs=[v for v in m['variants']if v['key'].startswith('official-kbl-20261027-')];assert len(vs)==r['added'];v=next((v for v in vs if v['form']=='mascot'),vs[0]);u='https://logo.vibers.co.kr/_clients/'+id+'/'+v['files']['png'];raw=get(u);im=Image.open(io.BytesIO(raw));im.verify();return {'id':id,'added':len(vs),'total':len(m['variants']),'png_verified':True,'variant_api_verified':True,'representative_preserved':r['representative_preserved'],'sample':u,'sample_sha256':hashlib.sha256(raw).hexdigest(),'forms':sorted(set(v['form']for v in m['variants']))}
a=list(concurrent.futures.ThreadPoolExecutor(max_workers=4).map(verify,R));assert len(a)==10;assert sum(x['added']for x in a)==46;(B/'kbl-public-verification.json').write_text(json.dumps(a,ensure_ascii=False,indent=2));print(json.dumps(a,ensure_ascii=False,indent=2))

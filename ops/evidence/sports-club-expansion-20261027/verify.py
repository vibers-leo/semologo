import subprocess,json,urllib.parse,hashlib,io,concurrent.futures
from pathlib import Path
from PIL import Image
B=Path(__file__).parent
teams=[('jeonbuk-fc','전북 현대 모터스',34),('steelers','포항 스틸러스',12)]
def get(url):return subprocess.run(['curl','-fsSL','--max-time','35','-A','Mozilla/5.0',url],capture_output=True,check=True).stdout
def verify(x):
 id,name,expected=x;catalog=json.loads(get('https://semologo.com/api/catalog/?q='+urllib.parse.quote(name)));brand=next(a for a in catalog['brands']if a['id']==id);assert brand['category']=='스포츠' and brand['origin']=='KR';manifest=json.loads(get('https://semologo.com/api/logo-variants/?id='+id+'&review=sports-20261027'));vs=[a for a in manifest['variants']if a['key'].startswith('official-sports-20261027-')];assert len(vs)==expected,(id,len(vs),expected)
 samples=[next(v for v in vs if v['form']=='emblem'),next(v for v in vs if v['form']=='mascot')];proof=[]
 for v in samples:
  url='https://logo.vibers.co.kr/_clients/'+id+'/'+v['files']['png'];raw=get(url);im=Image.open(io.BytesIO(raw));im.verify();proof.append({'key':v['key'],'png_url':url,'sha256':hashlib.sha256(raw).hexdigest()})
 (B/(id+'-public-manifest.json')).write_text(json.dumps(manifest,ensure_ascii=False,indent=2));return {'id':id,'name':name,'added':len(vs),'total':len(manifest['variants']),'catalog_identity_verified':True,'png_verified':True,'proof':proof}
a=list(concurrent.futures.ThreadPoolExecutor(max_workers=2).map(verify,teams));(B/'public-verification.json').write_text(json.dumps(a,ensure_ascii=False,indent=2));print(json.dumps(a,ensure_ascii=False,indent=2))
if __name__=='__main__':pass

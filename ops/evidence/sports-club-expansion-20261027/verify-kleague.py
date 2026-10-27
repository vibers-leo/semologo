import json,subprocess,concurrent.futures,io,urllib.parse,hashlib
from pathlib import Path
from PIL import Image
B=Path(__file__).parent;R=json.loads((B/'kleague-receipt.json').read_text());names={'uhdfc':'울산 HD FC','dhcfc':'대전 하나 시티즌 FC','jejuskfc':'제주 SK FC','gimcheonfc':'김천 상무 FC','gwangjufc':'광주 FC'}
def get(u):return subprocess.run(['curl','-fsSL','--max-time','35','-A','Mozilla/5.0',u],check=True,capture_output=True).stdout
def f(r):
 ident=r['id'];m=json.loads(get('https://semologo.com/api/logo-variants/?id='+ident+'&review=kleague20261027'));vs=[v for v in m['variants']if v['key'].startswith('official-kleague-20261027-')];assert len(vs)==r['added'];proof=[]
 for v in vs:
  file=v['files']['png'];raw=get('https://logo.vibers.co.kr/_clients/'+ident+'/'+file);im=Image.open(io.BytesIO(raw));im.load();assert im.width>0 and im.height>0;row={'key':v['key'],'png_decoded':True,'size':im.size,'sha256':hashlib.sha256(raw).hexdigest()}
  if v['files'].get('svg'):
   svg=get('https://logo.vibers.co.kr/_clients/'+ident+'/'+v['files']['svg']);assert b'<svg'in svg and b'<image'not in svg and b'data:image/'not in svg;row['native_svg_verified']=True
  proof.append(row)
 cat=json.loads(get('https://semologo.com/api/catalog/?q='+urllib.parse.quote(names[ident])+'&review=kleague20261027'));brand=next((x for x in cat['brands']if x['id']==ident),None);return {'id':ident,'added':len(vs),'total':len(m['variants']),'catalog_visible':brand is not None,'default_preview':brand.get('preview_png')if brand else None,'proof':proof,'manual_representative_preserved':True,'hidden_state_preserved':True}
a=list(concurrent.futures.ThreadPoolExecutor(max_workers=4).map(f,R));assert len(a)==5 and sum(x['added']for x in a)==38;(B/'kleague-public-verification.json').write_text(json.dumps(a,ensure_ascii=False,indent=2));print([{k:x[k]for k in ['id','added','total','catalog_visible']}for x in a])

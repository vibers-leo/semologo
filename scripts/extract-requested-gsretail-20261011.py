"""Preserve official GS Retail PDF shading via Poppler gradients, remove grid images."""
from pathlib import Path
from lxml import etree as E
import copy,json,hashlib,cairosvg
D=Path('marketing/assets/requested-finance-business-20261011');P=D/'gsretail';tree=E.parse(str(P/'vector-import.svg'));root=tree.getroot();assert not tree.xpath('//*[local-name()="image"]');assert len(tree.xpath('//*[local-name()="linearGradient" or local-name()="radialGradient"]'))==21
bounds={}
for line in (P/'bounds.csv').read_text().splitlines():
 a=line.split(',')
 if len(a)==5:bounds[a[0]]=[float(v)*.75 for v in a[1:]]
data=json.loads((D/'extracted.json').read_text());data['meta']['gsretail']=['GS리테일','GS Retail','유통·쇼핑','https://hpsimg.gsretail.com/gsretail/en/intro/ci-bi']
for lang,box in [('ko',(351,347,491,394)),('en',(108,347,247,394))]:
 r=copy.deepcopy(root);x,y,x1,y1=box
 for el in list(r.iter()):
  if E.QName(el).localname not in ['path','use','rect','circle','ellipse','polygon','polyline','line','text']:continue
  if any(E.QName(a).localname in ['defs','clipPath','mask','pattern'] for a in el.iterancestors()):continue
  b=bounds.get(el.get('id'))
  if b and not (x<=b[0] and y<=b[1] and b[0]+b[2]<=x1 and b[1]+b[3]<=y1):el.getparent().remove(el)
 r.set('viewBox',f'{x} {y} {x1-x} {y1-y}');r.set('width',str(x1-x));r.set('height',str(y1-y));folder=P/'reviewed'/lang;folder.mkdir(parents=True,exist_ok=True);s=folder/'logo.svg';p=folder/'logo.png';s.write_bytes(E.tostring(r));cairosvg.svg2png(bytestring=s.read_bytes(),write_to=str(p),output_width=1600)
 data['rows'].append(dict(id='gsretail',key='official-'+lang,label=('국문' if lang=='ko' else '영문')+' 가로 조합',svg=str(s),png=str(p),source_url='https://hpimg.gsretail.com/_ui/desktop/common/docs/GS+CIBI.zip',sha256=hashlib.sha256(s.read_bytes()).hexdigest(),visual_review='pending'))
(D/'extracted.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');print('GS Retail 2 variants; zero raster images; vector gradients retained')

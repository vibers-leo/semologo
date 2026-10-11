"""Extract BIZENTRO official AI signatures from an Inkscape Poppler import; guide paths excluded."""
from pathlib import Path
from lxml import etree as E
import copy,json,hashlib,cairosvg
D=Path('marketing/assets/requested-finance-business-20261011');P=D/'bizentro';tree=E.parse(str(P/'vector-import.svg'));root=tree.getroot();assert not tree.xpath('//*[local-name()="image"]')
bounds={}
for line in (P/'bounds.csv').read_text().splitlines():
 a=line.split(',')
 if len(a)==5:bounds[a[0]]=[float(v)*.75 for v in a[1:]]
data=json.loads((D/'extracted.json').read_text());data['meta']['bizentro']=['비젠트로','BIZENTRO','IT·테크','http://www.bizentro.com/s5/s5_5.do?lang='];data['rows']=[r for r in data['rows'] if r['id']!='bizentro']
for lang,box in [('en',(68,118,240,161)),('ko',(356,118,527,161))]:
 r=copy.deepcopy(root);x,y,x1,y1=box
 for el in list(r.iter()):
  if E.QName(el).localname not in ['path','use','rect','circle','ellipse','polygon','polyline','line','text']:continue
  if any(E.QName(a).localname in ['defs','clipPath','mask','pattern'] for a in el.iterancestors()):continue
  b=bounds.get(el.get('id'))
  if b and not (x<=b[0] and y<=b[1] and b[0]+b[2]<=x1 and b[1]+b[3]<=y1):el.getparent().remove(el)
 r.set('viewBox',f'{x} {y} {x1-x} {y1-y}');r.set('width',str(x1-x));r.set('height',str(y1-y));s=P/f'official-{lang}.svg';p=P/f'official-{lang}.png';s.write_bytes(E.tostring(r));cairosvg.svg2png(bytestring=s.read_bytes(),write_to=str(p),output_width=1600)
 data['rows'].append(dict(id='bizentro',key='official-'+lang,label=('국문' if lang=='ko' else '영문')+' 가로 조합',svg=str(s),png=str(p),source_url='http://www.bizentro.com/theme/bize/images/pdf/Bizentro_ci.ai',sha256=hashlib.sha256(s.read_bytes()).hexdigest(),visual_review='pending'))
(D/'extracted.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');print('BIZENTRO 2 variants; zero raster images; official blue retained')

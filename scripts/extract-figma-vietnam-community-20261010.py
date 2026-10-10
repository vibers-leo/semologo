"""Extract explicitly identified artwork; keep only reachable mask/gradient dependencies."""
from pathlib import Path
from lxml import etree as E
from PIL import Image,ImageDraw
import json,re,copy,subprocess,hashlib
R=Path(__file__).resolve().parents[1];O=R/'marketing/assets/figma-vietnam-collection-20261010';root=E.parse(str(O/'indexed.svg')).getroot();bounds={a[0]:tuple(map(float,a[1:])) for line in (O/'bounds.csv').read_text().splitlines() if len(a:=line.split(','))==5};idmap={e.get('id'):e for e in root.iter() if e.get('id')};ns='http://www.w3.org/2000/svg';configs=[]
configs=[]
configs.append(('abbank','ABBANK',tuple(v*2629/922 for v in (95,38,270,66)),'community-horizontal'))
configs.append(('acb-vietnam','ACB',tuple(v*2629/922 for v in (95,69,270,97)),'community-horizontal'))
configs.append(('agribank-vietnam','Agribank',tuple(v*2629/922 for v in (95,131,270,159)),'community-horizontal'))
configs.append(('baoviet-bank','BAOVIET Bank',tuple(v*2629/922 for v in (95,254,270,282)),'community-horizontal'))
configs.append(('bank-for-investment-and-development-of-vietnam','BIDV',tuple(v*2629/922 for v in (95,315,270,343)),'community-horizontal'))
configs.append(('cake-bank','CAKE',tuple(v*2629/922 for v in (95,346,270,374)),'community-horizontal'))
configs.append(('eximbank-vietnam','Eximbank',tuple(v*2629/922 for v in (95,655,270,683)),'community-horizontal'))
configs.append(('hdbank','HDBank',tuple(v*2629/922 for v in (95,716,270,744)),'community-horizontal'))
configs.append(('lpbank','LPBank',tuple(v*2629/922 for v in (95,963,270,991)),'community-horizontal'))
configs.append(('mb-bank','MB',tuple(v*2629/922 for v in (95,1024,270,1052)),'community-horizontal'))
configs.append(('msb','MSB',tuple(v*2629/922 for v in (95,1117,270,1145)),'community-horizontal'))
configs.append(('tpbank','TPBank',tuple(v*2629/922 for v in (95,1672,270,1700)),'community-horizontal'))
configs.append(('vib','VIB',tuple(v*2629/922 for v in (95,1795,270,1823)),'community-horizontal'))
configs.append(('vietcombank','Vietcombank',tuple(v*2629/922 for v in (95,1887,270,1915)),'community-horizontal'))
def refs(e):
 out=set()
 for q in e.iter():
  for k,v in q.attrib.items():
   out.update(re.findall(r'url\(#([^)]*)\)',v))
   if k.endswith('href') and v.startswith('#'):out.add(v[1:])
 return out
def select(e,zone,kept):
 name=E.QName(e).localname
 if name in ['defs','mask','clipPath','pattern','linearGradient','radialGradient','filter']:return None
 if name=='g':
  out=copy.deepcopy(e)
  for q in list(out):out.remove(q)
  for child in e:
   q=select(child,zone,kept)
   if q is not None:out.append(q)
  return out if len(out) else None
 if name not in ['path','rect','circle','ellipse','polygon','line','use','image']:return None
 b=bounds.get(e.get('id'));x1,y1,x2,y2=zone
 if not b:return None
 x,y,w,h=b
 if x>=x1-.1 and y>=y1-.1 and x+w<=x2+.1 and y+h<=y2+.1 and w*h<(x2-x1)*(y2-y1)*.85:
  kept.append(b);return copy.deepcopy(e)
 return None
out=[];tiles=[];rejected=[]
for b,name,zone,suffix in configs:
 r=E.Element('{'+ns+'}svg',nsmap={None:ns,'xlink':'http://www.w3.org/1999/xlink'});kept=[]
 for e in root:
  q=select(e,zone,kept)
  if q is not None:r.append(q)
 if not kept:rejected.append({'id':b,'name':name,'reason':'지정 영역에 완전한 벡터 요소 없음'});continue
 needed=refs(r);done=set();defs=E.SubElement(r,'{'+ns+'}defs')
 while needed-done:
  key=next(iter(needed-done));assert key in idmap,key;q=copy.deepcopy(idmap[key]);defs.append(q);done.add(key);needed.update(refs(q))
 if r.xpath('//*[local-name()="image"]'):
  rejected.append({'id':b,'name':name,'reason':'래스터 image dependency 포함 — SVG 서비스 제외'});continue
 x=min(k[0] for k in kept);y=min(k[1] for k in kept);w=max(k[0]+k[2] for k in kept)-x;h=max(k[1]+k[3] for k in kept)-y;r.set('viewBox',f'{x} {y} {w} {h}');r.set('width',str(w));r.set('height',str(h));d=O/'reviewed'/b;d.mkdir(parents=True,exist_ok=True);svg=d/(suffix+'.svg');svg.write_bytes(E.tostring(r));png=svg.with_suffix('.png')
 with (O/'render-warnings.log').open('a') as log:subprocess.run(['inkscape',str(svg),'--export-filename='+str(png),'--export-width='+str(round(2000*w/max(w,h)))],stdout=subprocess.DEVNULL,stderr=log,check=True)
 im=Image.open(png).convert('RGBA');assert max(im.size) in [1999,2000,2001];im.thumbnail((350,140));tile=Image.new('RGB',(400,180),'#ccc');tile.paste(im,((400-im.width)//2,5),im);ImageDraw.Draw(tile).text((5,155),b+' '+suffix,fill='black');tiles.append(tile);out.append(dict(id=b,name=name,key=suffix,svg=str(svg.relative_to(R)),png=str(png.relative_to(R)),zone=zone,source='사용자 제공 Figma Community 모음집',origin='community',official=False,review='pending-visual-review',mask_dependencies=len(done)))
s=Image.new('RGB',(1600,180*((len(tiles)+3)//4)),'white')
for n,t in enumerate(tiles):s.paste(t,((n%4)*400,(n//4)*180))
s.save(O/'reviewed-contact.jpg');(O/'extracted.json').write_text(json.dumps(out,ensure_ascii=False,indent=2));(O/'rejected.json').write_text(json.dumps(rejected,ensure_ascii=False,indent=2));print(len(out),'identified vector-only brands;',len(rejected),'raster/empty rejected; visual review pending')

"""Extract chosen AI artwork paths; remove all layout outside reviewed zones."""
from pathlib import Path
from lxml import etree as E
from PIL import Image,ImageDraw
import json,subprocess,cairosvg
R=Path(__file__).resolve().parents[1];O=R/'marketing/assets/png-recollection-zip-batch5-20261010';O.mkdir(exist_ok=True);rows=json.loads((R/'marketing/assets/png-recollection-zip-reviewed-20261010/candidates.json').read_text());out=[];tiles=[]
configs=[]
for x in rows:
 b=x['id'];k=x['key'];cfg=[]
 if b in ['gongu-ci-1730','gongu-ci-1729','gongu-ci-1707','gongu-ci-1670','gongu-ci-1657']:cfg=[((0,0,1,1),'main','공식 로고','symbol' if b=='gongu-ci-1730' else 'horizontal')]
 if b=='gongu-ci-1701' and k.startswith('candidate-3'):cfg=[((0,0,1,1),'main','공식 국영문 로고','horizontal')]
 if b=='gongu-ci-1683' and k.startswith('candidate-0'):cfg=[((0,0,1,1),'wordmark','국문 로고타입','wordmark')]
 for zone,suf,label,form in cfg:configs.append((x,zone,suf,label,form))
for x,z,suffix,label,form in configs:
 (O/x['id']).mkdir(exist_ok=True);r=E.parse(str(R/x['svg'])).getroot();vb=list(map(float,r.get('viewBox').split()));zone=(vb[0]+z[0]*vb[2],vb[1]+z[1]*vb[3],vb[0]+z[2]*vb[2],vb[1]+z[3]*vb[3]);leaves=[]
 for i,e in enumerate(r.xpath('//*[local-name()="path" or local-name()="use" or local-name()="rect" or local-name()="line" or local-name()="polygon"]')):
  if any(E.QName(a).localname in ['defs','clipPath','mask'] for a in e.iterancestors()):continue
  e.set('id','art-'+str(i));leaves.append(e)
 q=O/'query.svg';q.write_bytes(E.tostring(r));raw=subprocess.check_output(['inkscape','--query-all',str(q)],text=True);bounds={a[0]:tuple(map(float,a[1:])) for ln in raw.splitlines() if len(a:=ln.split(','))==5};kept=[]
 for e in leaves:
  b=bounds.get(e.get('id'));ok=b and not (x['id']=='gongu-ci-1592' and (e.get('fill') in ['none','#4f8fcc','#e60013'])) and zone[0]<=b[0]+b[2]/2<=zone[2] and zone[1]<=b[1]+b[3]/2<=zone[3] and b[2]*b[3]<(zone[2]-zone[0])*(zone[3]-zone[1])*.9
  if ok:kept.append(b)
  else:e.getparent().remove(e)
 assert kept,(x,z)
 xx=min(b[0] for b in kept);yy=min(b[1] for b in kept);ww=max(b[0]+b[2] for b in kept)-xx;hh=max(b[1]+b[3] for b in kept)-yy
 r.set('viewBox',f'{xx} {yy} {ww} {hh}');r.set('width',str(ww));r.set('height',str(hh));key=x['key']+'-'+suffix;svg=O/x['id']/(key+'-extracted.svg');svg.write_bytes(E.tostring(r));png=svg.with_suffix('.png');cairosvg.svg2png(url=str(svg),write_to=str(png),output_width=round(2000*ww/max(ww,hh)),output_height=round(2000*hh/max(ww,hh)))
 im=Image.open(png).convert('RGBA');im.thumbnail((360,150));tile=Image.new('RGB',(400,190),'#cccccc');tile.paste(im,((400-im.width)//2,5),im);ImageDraw.Draw(tile).text((6,165),x['id']+' '+key,fill='black');tiles.append(tile)
 out.append(dict(x,key=key,label=label,form=form,svg=str(svg.relative_to(R)),png=str(png.relative_to(R)),review='pending-extracted-artwork'))
sheet=Image.new('RGB',(1600,190*((len(out)+3)//4)),'white')
for n,t in enumerate(tiles):sheet.paste(t,((n%4)*400,(n//4)*190))
sheet.save(O/'extracted-contact.jpg');(O/'extracted.json').write_text(json.dumps(out,ensure_ascii=False,indent=2));print(len(out),'artworks',len(set(x['id'] for x in out)),'brands')

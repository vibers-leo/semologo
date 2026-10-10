"""Extract chosen AI artwork paths; remove all layout outside reviewed zones."""
from pathlib import Path
from lxml import etree as E
from PIL import Image,ImageDraw
import json,subprocess,cairosvg
R=Path(__file__).resolve().parents[1];O=R/'marketing/assets/png-recollection-ai-reviewed-20261010';rows=json.loads((O/'candidates.json').read_text());out=[];tiles=[]
configs=[]
for x in rows:
 b=x['id'];k=x['key']
 if b=='gongu-ci-1759':
  for zone,suf,lab,frm in [((.12,.28,.46,.75),'emblem','엠블럼','emblem'),((.70,.28,.90,.55),'vertical','상하조합','vertical'),((.64,.73,.90,.87),'horizontal','좌우조합','horizontal'),((.75,.28,.85,.48),'symbol','심볼','symbol')]:configs.append((x,zone,suf,lab,frm))
 if b=='gongu-ci-1604':
  configs.append((x,(.05,.07,.45,.46),'color','국문' if 'candidate-0' in k else '영문' if 'candidate-1' in k else '중문 번체' if 'candidate-2' in k else '중문 간체','vertical'))
  if 'candidate-0' in k:configs.append((x,(.55,.07,.95,.46),'blue','국문 단색','vertical'))
 if b in ['gongu-ci-1591','gongu-ci-1420','gongu-ci-1296']:configs.append((x,(0,0,1,1),'main','공식 조합형','vertical' if b=='gongu-ci-1296' or 'candidate-1' in k else 'horizontal'))
 if b=='gongu-ci-1373':configs.append((x,(.15,.3,.7,.62),'main','심볼' if 'candidate-0' in k else '워드마크' if 'candidate-1' in k else '좌우조합' if 'candidate-2' in k else '상하조합','symbol' if 'candidate-0' in k else 'wordmark' if 'candidate-1' in k else 'horizontal' if 'candidate-2' in k else 'vertical'))
for x,z,suffix,label,form in configs:
 r=E.parse(str(R/x['svg'])).getroot();vb=list(map(float,r.get('viewBox').split()));zone=(vb[0]+z[0]*vb[2],vb[1]+z[1]*vb[3],vb[0]+z[2]*vb[2],vb[1]+z[3]*vb[3]);leaves=[]
 for i,e in enumerate(r.xpath('//*[local-name()="path" or local-name()="use" or local-name()="rect" or local-name()="line" or local-name()="polygon"]')):
  if any(E.QName(a).localname in ['defs','clipPath','mask'] for a in e.iterancestors()):continue
  e.set('id','art-'+str(i));leaves.append(e)
 q=O/'query.svg';q.write_bytes(E.tostring(r));raw=subprocess.check_output(['inkscape','--query-all',str(q)],text=True);bounds={a[0]:tuple(map(float,a[1:])) for ln in raw.splitlines() if len(a:=ln.split(','))==5};kept=[]
 for e in leaves:
  b=bounds.get(e.get('id'));ok=b and zone[0]<=b[0]+b[2]/2<=zone[2] and zone[1]<=b[1]+b[3]/2<=zone[3] and b[2]*b[3]<(zone[2]-zone[0])*(zone[3]-zone[1])*.9
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

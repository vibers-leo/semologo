"""Extract chosen AI artwork paths; remove all layout outside reviewed zones."""
from pathlib import Path
from lxml import etree as E
from PIL import Image,ImageDraw
import json,subprocess,cairosvg
R=Path(__file__).resolve().parents[1];O=R/'marketing/assets/png-recollection-ai-batch3-20261010';O.mkdir(exist_ok=True);rows=json.loads((R/'marketing/assets/png-recollection-ai-reviewed-20261010/candidates.json').read_text());out=[];tiles=[]
configs=[]
for x in rows:
 b=x['id'];k=x['key'];cfg=[]
 if b=='gongu-ci-1747':
  cfg=[((.1,.38,.46,.465),'ko-en-vertical','국영문 상하조합','vertical'),((.53,.38,.9,.465),'ko-vertical','국문 상하조합','vertical'),((.1,.515,.46,.58),'en-vertical','영문 상하조합','vertical'),((.1,.61,.46,.66),'ko-en-horizontal','국영문 좌우조합','horizontal'),((.53,.61,.9,.66),'ko-horizontal','국문 좌우조합','horizontal'),((.1,.69,.46,.74),'en-horizontal','영문 좌우조합','horizontal')]
 if b=='gongu-ci-1601':cfg=[((.1,.19,.47,.32),'ko-horizontal','국문 기본형','horizontal'),((.73,.22,.92,.38),'ko-vertical','국문 상하조합','vertical'),((.12,.60,.47,.71),'abbr-ko','국문 약칭형','horizontal'),((.12,.73,.47,.84),'abbr-en','영문 약칭형','horizontal'),((.69,.61,.83,.79),'emblem','단독조합형','emblem')]
 if b=='gongu-ci-1592' and k.endswith('page-1'):cfg=[((.20,.44,.78,.54),'ko-horizontal','국문 좌우조합','horizontal'),((.20,.65,.42,.78),'ko-vertical','국문 상하조합','vertical')]
 if b=='gongu-ci-1589':cfg=[((.24,.34,.85,.59),'wordmark','워드마크 · Clean & Green','wordmark')]
 if b=='gongu-ci-1457':cfg=[((.09,.39,.92,.61),'ko-en-horizontal','국영문 좌우조합','horizontal')]
 if b=='gongu-ci-1287':cfg=[((.14,.21,.85,.28),'horizontal','좌우조합','horizontal'),((.20,.54,.80,.69),'vertical','상하조합','vertical')]
 if b=='gongu-ci-1450':cfg=[((.28,.24,.69,.40),'wordmark','ICC JEJU 워드마크','wordmark')]
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

from pathlib import Path
from lxml import etree as E
from PIL import Image,ImageDraw
import re,copy,json,cairosvg,numpy as np,io
OUT=Path(__file__).resolve().parents[1]/'marketing/assets/figma-premium-collection-20261010';root=E.parse(str(OUT/'query.svg'),E.XMLParser(resolve_entities=False,no_network=True)).getroot();ids={e.get('id'):e for e in root.iter() if e.get('id')};bounds={a[0]:tuple(map(float,a[1:])) for ln in (OUT/'bounds.csv').read_text().splitlines() if len(a:=ln.split(','))==5};folder=OUT/'candidates';folder.mkdir(exist_ok=True);records=[];thumbnails=[]
def refs(el):
 s=E.tostring(el).decode();return set(re.findall(r'url\(#([^)]*)\)',s)+re.findall(r'(?:href)="#([^"]+)"',s))
def norm(im):
 im=im.convert('RGBA');im=im.crop(im.getchannel('A').getbbox());scale=min(240/im.width,60/im.height);im=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS);tile=Image.new('RGBA',(256,80),'white');tile.alpha_composite(im,((256-im.width)//2,(80-im.height)//2));return np.asarray(tile.convert('RGB'),dtype=float)/255
for col,(left,right) in enumerate([(80,380),(380,650),(650,950)]):
 for row in range(36):
  top,bottom=650+80*row,730+80*row;selected=[];boxes=[]
  for e in root:
   b=bounds.get(e.get('id'))
   if b and left-.1<=b[0] and top-.1<=b[1] and b[0]+b[2]<=right+.1 and b[1]+b[3]<=bottom+.1:selected.append(copy.deepcopy(e));boxes.append(b)
  if not selected:continue
  need=set().union(*(refs(e) for e in selected));defs=[];seen=set()
  while need:
   key=need.pop()
   if key in seen:continue
   seen.add(key);assert key in ids,key;d=copy.deepcopy(ids[key]);defs.append(d);need.update(refs(d)-seen)
  all_nodes=[n for e in selected+defs for n in e.iter()];types={E.QName(e).localname for e in all_nodes};unsafe=types&{'image','foreignObject','script','a','use'}
  x=min(b[0] for b in boxes);y=min(b[1] for b in boxes);w=max(b[0]+b[2] for b in boxes)-x;h=max(b[1]+b[3] for b in boxes)-y
  svg=E.Element(root.tag,nsmap=root.nsmap,viewBox=f'{x} {y} {w} {h}',width=str(w),height=str(h),fill='none');de=E.SubElement(svg,'{http://www.w3.org/2000/svg}defs');de.extend(defs);svg.extend(selected);raw=E.tostring(svg);assert not re.search(rb'(?:href)="(?!#)',raw)
  key=f'c{col}-r{row}';(folder/(key+'.svg')).write_bytes(raw);png=cairosvg.svg2png(bytestring=raw,output_width=round(400*w/max(w,h)),output_height=round(400*h/max(w,h)));(folder/(key+'.png')).write_bytes(png);im=Image.open(io.BytesIO(png));rec={'key':key,'col':col,'row':row,'box':[x,y,w,h],'unsafe_types':list(unsafe),'path_count':sum(E.QName(n).localname=='path' for n in all_nodes),'selected_ids':[e.get('id') for e in selected]};records.append(rec);thumbnails.append(norm(im))
matched=[]
for f in sorted(OUT.glob('Company=*.png')):
 expected=norm(Image.open(f));errors=[float(np.abs(expected-a).mean()) for a in thumbnails];best=np.argsort(errors)[:3];matched.append({'company':f.stem.removeprefix('Company='),'candidates':[dict(records[n],error=errors[n]) for n in best]})
(OUT/'matches.json').write_text(json.dumps(matched,indent=2));(OUT/'candidate-inventory.json').write_text(json.dumps(records,indent=2));print('candidates',len(records),'matched',len(matched));print('\n'.join(f"{m['company']}: {m['candidates'][0]['key']} error={m['candidates'][0]['error']:.4f} unsafe={m['candidates'][0]['unsafe_types']}" for m in matched))
sheet=Image.new('RGB',(1600,160*((len(matched)+3)//4)),'#eee');draw=ImageDraw.Draw(sheet)
for n,m in enumerate(matched):
 x=n%4*400;y=n//4*160
 for j,f in enumerate([OUT/('Company='+m['company']+'.png'),folder/(m['candidates'][0]['key']+'.png')]):
  im=Image.open(f).convert('RGBA');im.thumbnail((185,110));sheet.paste(im,(x+j*200+(190-im.width)//2,y+5),im)
 draw.text((x+5,y+120),m['company']+' '+m['candidates'][0]['key']+' '+str(round(m['candidates'][0]['error'],4)),fill='black')
sheet.save(OUT/'comparison-contact.jpg')

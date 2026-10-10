"""Stage official SVG candidates for human review; never publishes."""
from pathlib import Path
import json,hashlib
import cairosvg
from PIL import Image,ImageDraw
from lxml import etree as E
R=Path(__file__).resolve().parents[1]; O=R/'marketing/assets/png-recollection-reviewed-20261010'; O.mkdir(exist_ok=True)
rows=json.loads((R/'marketing/assets/png-recollection-20261010/results.json').read_text()); review=[];tiles=[]
for row in rows:
 ds=[d for d in row.get('downloads',[]) if d.get('file','').endswith('.svg')]
 for i,d in enumerate(ds):
  f=R/d['file'];r=E.fromstring(f.read_bytes())
  if r.xpath('//*[local-name()="image" or local-name()="text" or local-name()="script"]'):continue
  out=O/row['id'];out.mkdir(exist_ok=True); svg=out/f'candidate-{i}.svg';svg.write_bytes(E.tostring(r))
  png=svg.with_suffix('.png')
  try:cairosvg.svg2png(url=str(svg),write_to=str(png),output_width=1600)
  except Exception:continue
  im=Image.open(png).convert('RGBA');bbox=im.getbbox()
  if not bbox:continue
  tile=Image.new('RGB',(360,170),'#d8d8d8');im.thumbnail((340,120));tile.paste(im,((360-im.width)//2,8),im);ImageDraw.Draw(tile).text((6,140),row['id']+f' / {i}',fill='black');tiles.append(tile)
  review.append({'id':row['id'],'name_ko':row['name_ko'],'candidate':i,'source_page':row.get('official_source_page'),'source_url':d['url'],'original':d['file'],'svg':str(svg.relative_to(R)),'png':str(png.relative_to(R)),'review':'pending'})
Image.new('RGB',(1,1))
sheet=Image.new('RGB',(360*4,170*((len(tiles)+3)//4)),'white')
for n,t in enumerate(tiles):sheet.paste(t,((n%4)*360,(n//4)*170))
sheet.save(O/'contact.jpg');(O/'review-candidates.json').write_text(json.dumps(review,ensure_ascii=False,indent=2));print(len(review),'vector candidates')

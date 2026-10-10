"""Inspect official PDF-compatible AI originals without publishing."""
from pathlib import Path
import json,fitz
from PIL import Image,ImageDraw
from lxml import etree as E
import cairosvg
R=Path(__file__).resolve().parents[1];O=R/'marketing/assets/png-recollection-ai-reviewed-20261010';O.mkdir(exist_ok=True)
rows=json.loads((R/'marketing/assets/png-recollection-20261010/results.json').read_text());a=[];tiles=[]
for row in rows:
 for d in row.get('downloads',[]):
  if not d.get('file','').endswith('.ai'):continue
  f=R/d['file']
  if not f.read_bytes().startswith(b'%PDF-'):continue
  doc=fitz.open(f)
  for pn in range(min(2,len(doc))):
   p=doc[pn];r=E.fromstring(p.get_svg_image(text_as_path=True).encode())
   if r.xpath('//*[local-name()="image"]'):continue
   dest=O/row['id'];dest.mkdir(exist_ok=True);key=f.stem+'-page-'+str(pn);svg=dest/(key+'.svg');svg.write_bytes(E.tostring(r));png=svg.with_suffix('.png')
   try:cairosvg.svg2png(url=str(svg),write_to=str(png),output_width=1200)
   except Exception:continue
   im=Image.open(png).convert('RGBA');im.thumbnail((360,150));tile=Image.new('RGB',(400,190),'#cccccc');tile.paste(im,((400-im.width)//2,4),im);ImageDraw.Draw(tile).text((6,165),row['id']+' '+key,fill='black');tiles.append(tile)
   a.append({'id':row['id'],'name_ko':row['name_ko'],'key':key,'source_page':row.get('official_source_page'),'source_url':d['url'],'original':d['file'],'svg':str(svg.relative_to(R)),'png':str(png.relative_to(R)),'checked_at':'2026-10-10','review':'pending'})
 if len(a)>=40:break
sheet=Image.new('RGB',(1600,190*((len(a)+3)//4)),'white')
for n,t in enumerate(tiles):sheet.paste(t,((n%4)*400,(n//4)*190))
sheet.save(O/'contact.jpg');(O/'candidates.json').write_text(json.dumps(a,ensure_ascii=False,indent=2));print(len(a),'AI-vector candidate pages')

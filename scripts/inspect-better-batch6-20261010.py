"""Frozen-name review contact sheets; no catalog mutations."""
from pathlib import Path
from lxml import etree as E
from PIL import Image,ImageDraw
import json,re,subprocess,concurrent.futures,zipfile,io
ROOT=Path(__file__).resolve().parents[1];SRC=ROOT/'marketing/assets/figma-better-collection-20261010';OUT=ROOT/'marketing/assets/figma-better-batch6-20261010';OUT.mkdir(exist_ok=True);members=json.loads((SRC/'batch6-ownership.json').read_text())['members'];meta={r['file']:r for r in json.loads((SRC/'component-inspection.json').read_text())};INK='/Applications/Inkscape.app/Contents/MacOS/inkscape'
def work(pair):
 i,m=pair;files=m['files'];file=next((f for f in files if f.endswith('.svg') and '(' not in f),next((f for f in files if f.endswith('.svg')),files[0]));src=SRC/'source'/file;folder=OUT/'intake';folder.mkdir(exist_ok=True);png=folder/(str(i)+'.png')
 if file.endswith('.svg'):
  root=E.parse(str(src)).getroot();assert not root.xpath('//*[local-name()="image" or local-name()="script" or local-name()="foreignObject"]');vb=list(map(float,root.get('viewBox').split()));w,h=vb[2:];removed=0
  for el in list(root):
   if E.QName(el).localname=='rect' and el.get('fill','').lower() in ['white','#fff','#ffffff'] and float(el.get('x','0'))==0 and float(el.get('y','0'))==0 and el.get('width') and el.get('height') and float(el.get('width'))==w and float(el.get('height'))==h:root.remove(el);removed+=1
  svg=folder/(str(i)+'.svg');svg.write_bytes(E.tostring(root));subprocess.run([INK,str(svg),'--export-area-page','--export-width='+str(round(640*w/max(w,h))),'--export-filename='+str(png)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 else:
  if src.exists():im=Image.open(src)
  else:
   archive=json.loads((SRC/'intake.json').read_text())['source']
   with zipfile.ZipFile(archive) as z:im=Image.open(io.BytesIO(z.read(file)));im.load()
  im.save(png);removed=0
 im=Image.open(png).convert('RGBA');im.thumbnail((320,130));white='(white)' in file;tile=Image.new('RGB',(360,180),'#222' if white else '#ddd');tile.paste(im,((360-im.width)//2,15),im);ImageDraw.Draw(tile).text((8,151),str(i)+' '+m['name'],fill='white' if white else 'black');return i,m,file,tile,removed
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(work,enumerate(members)))
for offset in range(0,len(results),30):
 sheet=Image.new('RGB',(1800,1080),'white')
 for j,(_,_,_,tile,_) in enumerate(results[offset:offset+30]):sheet.paste(tile,(j%5*360,j//5*180))
 sheet.save(OUT/('identity-contact-'+str(offset//30+1)+'.jpg'))
(OUT/'intake-review.json').write_text(json.dumps([{'index':i,**m,'representative_source':file,'removed_full_canvas_white_rects':removed} for i,m,file,_,removed in results],ensure_ascii=False,indent=2));print('Prepared',len(results),'frozen-name previews in four sheets')

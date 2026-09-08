"""Collect upstream SVG assets and split outlined Illustrator artwork without tracing."""
import argparse, copy, hashlib, json, re, shutil, unicodedata
from pathlib import Path
import fitz
from lxml import etree as E
from PIL import Image, ImageDraw
def main():
 ROOT=Path(__file__).resolve().parents[1]
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--source-ai',type=Path,required=True)
 parser.add_argument('--upstream',type=Path,required=True)
 parser.add_argument('--output',type=Path,required=True)
 args=parser.parse_args()
 OUT=args.output
 OUT.mkdir(parents=True,exist_ok=True)
 def digest(b): return hashlib.sha256(b).hexdigest()
 def norm(s): return re.sub(r'[^a-z0-9가-힣]','',unicodedata.normalize('NFC',s).lower())
 brands=json.loads(Path('/Volumes/Untitled/brand-logos/_clients/brands-slim.json').read_text())
 index={}
 for b in brands:
  for s in [b['id'],b.get('name_en',''),b.get('name_ko','')]+b.get('aliases',[]):
   if s:index.setdefault(norm(s),set()).add(b['id'])
 up=args.upstream
 su=OUT/'supertiny';su.mkdir(exist_ok=True)
 shutil.copy2(up/'LICENSE',su/'LICENSE')
 rows=[]
 for f in sorted((up/'images/svg').glob('*.svg')):
  raw=f.read_bytes();r=E.fromstring(raw)
  if r.xpath('//*[local-name()="image" or local-name()="script" or local-name()="foreignObject"]'):
   print('Excluded unsafe/non-vector asset:',f.name);continue
  titles=r.xpath('//*[local-name()="title"]/text()');title=titles[0] if titles else f.stem
  matches=sorted(index.get(norm(f.stem),set())|index.get(norm(title),set()))
  shutil.copy2(f,su/f.name)
  rows.append(dict(file=f.name,title=title,sha256=digest(raw),existing_candidates=matches,status='existing_candidate' if matches else 'needs_identity_review'))
 (su/'manifest.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
 app=OUT/'apparel';app.mkdir(exist_ok=True)
 src=args.source_ai
 doc=fitz.open(src);p=doc[0];drawings=p.get_drawings();root=E.fromstring(p.get_svg_image().encode())
 paths=root.xpath('//*[local-name()="path" and not(ancestor::*[local-name()="defs"])]')
 # Measure each exported SVG path independently; fill/stroke may be emitted separately.
 measure=copy.deepcopy(root)
 measure_paths=measure.xpath('//*[local-name()="path" and not(ancestor::*[local-name()="defs"])]')
 parent=measure_paths[0].getparent()
 for node in measure_paths: parent.remove(node)
 drawings=[]
 for node in paths:
  one=copy.deepcopy(node);parent.append(one)
  sd=fitz.open(stream=E.tostring(measure),filetype='svg')
  pd=fitz.open(stream=sd.convert_to_pdf(),filetype='pdf')
  ds=pd[0].get_drawings();assert ds
  bound=fitz.Rect(ds[0]['rect'])
  for d in ds:bound|=d['rect']
  drawings.append({'rect':bound})
  parent.remove(one)
 mp=[[i] for i in range(len(paths))]
 boxes=json.loads((ROOT/'scripts/apparel-logo-regions.json').read_text());shutil.copy2(ROOT/'scripts/apparel-logo-regions.json',app/'crop-regions.json')
 assign=[[] for _ in boxes];unassigned=[]
 for i,d in enumerate(drawings):
  r=d['rect'];center=( (r.x0+r.x1)/2,(r.y0+r.y1)/2 )
  candidates=[k for k,(_,b) in enumerate(boxes) if fitz.Rect(b).contains(fitz.Point(*center))]
  # Overlapping wordmarks: choose region that fully contains the drawing, then smallest area.
  full=[k for k in candidates if fitz.Rect(boxes[k][1]).contains(r)]
  if full:candidates=full
  if not candidates:unassigned.append(i);continue
  k=min(candidates,key=lambda k:fitz.Rect(boxes[k][1]).get_area());assign[k].append(i)
 assert not unassigned,unassigned
 records=[];thumbs=[]
 for (name,box),ids in zip(boxes,assign):
  assert ids,name
  keep={q for i in ids for q in mp[i]};r=copy.deepcopy(root)
  ps=r.xpath('//*[local-name()="path" and not(ancestor::*[local-name()="defs"])]')
  for k,node in enumerate(ps):
   if k not in keep:node.getparent().remove(node)
  bounds=fitz.Rect(drawings[ids[0]]['rect'])
  for i in ids:bounds|=drawings[i]['rect']
  pad=1.5;bounds+=(-pad,-pad,pad,pad)
  r.set('viewBox',f'{bounds.x0} {bounds.y0} {bounds.width} {bounds.height}');r.set('width',str(bounds.width));r.set('height',str(bounds.height))
  raw=E.tostring(r,xml_declaration=True,encoding='UTF-8');(app/f'{name}.svg').write_bytes(raw)
  svg=fitz.open(stream=raw,filetype='svg');pdf=fitz.open(stream=svg.convert_to_pdf(),filetype='pdf');page=pdf[0]
  assert not page.get_images() and len(page.get_drawings())>0
  page.get_pixmap(matrix=fitz.Matrix(4,4),alpha=True).save(app/f'{name}.png')
  pdf.save(app/f'{name}.pdf')
  records.append(dict(id=name,files=[f'{name}.{x}' for x in ['svg','png','pdf']],source_bounds=list(bounds),drawing_count=len(ids),sha256=digest(raw),status='unidentified' if name.startswith('unidentified') else 'extracted'))
  thumbs.append((name,app/f'{name}.png'))
 (app/'manifest.json').write_text(json.dumps(dict(source=src.name,source_sha256=digest(src.read_bytes()),source_drawings=len(p.get_drawings()),svg_paths=len(drawings),assigned_svg_paths=sum(map(len,assign)),logos=records),ensure_ascii=False,indent=2))
 sheet=Image.new('RGB',(1200,((len(thumbs)+5)//6)*150),'#eeeeee');dr=ImageDraw.Draw(sheet)
 for i,(name,f) in enumerate(thumbs):
  x=i%6*200;y=i//6*150;im=Image.open(f);im.thumbnail((180,112));sheet.paste(im,(x+(200-im.width)//2,y+(115-im.height)//2),im);dr.text((x+8,y+126),name,fill='black')
 sheet.save(app/'contact-sheet.jpg')
 print(json.dumps(dict(supertiny=len(rows),matched=sum(bool(r['existing_candidates']) for r in rows),unmatched=sum(not r['existing_candidates'] for r in rows),apparel=len(records),drawings=sum(map(len,assign))),ensure_ascii=False))

if __name__ == "__main__":
 main()

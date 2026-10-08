"""Find explicit full-canvas white rectangles; preserve originals and require visual review."""
import argparse,copy,hashlib,json,re,time,subprocess,tarfile
from pathlib import Path
from lxml import etree as E
import fitz
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'marketing/assets/svg-background-review-20261008'
NS='http://www.w3.org/2000/svg'
def rectangle(el):
 tag=E.QName(el).localname
 try:
  if tag=='rect':
   if float(el.get('rx','0')) or float(el.get('ry','0')):return
   x=float(el.get('x','0'));y=float(el.get('y','0'));w=float(el.get('width'));h=float(el.get('height'));return x,y,x+w,y+h
  if tag!='path':return
  d=el.get('d','');tokens=re.findall(r'[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?',d)
  if re.search(r'[^MmLlHhVvZz0-9eE+.,\s-]',d):return
  points=[];i=0;cmd=None;x=y=0
  while i<len(tokens):
   if tokens[i].isalpha():
    cmd=tokens[i];i+=1
    if cmd in 'Zz':break
   if cmd in 'MmLl':
    a,b=float(tokens[i]),float(tokens[i+1]);i+=2
    x,y=(x+a,y+b) if cmd.islower() else (a,b);points.append((x,y))
    if cmd in 'Mm':cmd='l' if cmd=='m' else 'L'
   elif cmd in 'Hh':a=float(tokens[i]);i+=1;x=x+a if cmd=='h' else a;points.append((x,y))
   elif cmd in 'Vv':a=float(tokens[i]);i+=1;y=y+a if cmd=='v' else a;points.append((x,y))
   else:return
  if len(points)>1 and points[-1]==points[0]:points.pop()
  if len(points)!=4:return
  xs=sorted(set(x for x,y in points));ys=sorted(set(y for x,y in points))
  if len(xs)!=2 or len(ys)!=2 or set(points)!={(x,y) for x in xs for y in ys}:return
  if any(a[0]!=b[0] and a[1]!=b[1] for a,b in zip(points,points[1:]+points[:1])):return
  return xs[0],ys[0],xs[1],ys[1]
 except (TypeError,ValueError,IndexError):return
def candidates(raw):
 if len(raw)>1500000 or b'<image' in raw or b'data:image' in raw or b'<!ENTITY' in raw:return None,[]
 try:x=E.fromstring(raw,E.XMLParser(resolve_entities=False,no_network=True))
 except E.XMLSyntaxError:return None,[]
 try:
  box=[float(v) for v in re.split(r'[,\s]+',x.get('viewBox','').strip())]
  if len(box)!=4:return x,[]
  vx,vy,w,h=box;found=[]
  for el in x.iter():
   if not isinstance(el.tag,str):continue
   if any(E.QName(p).localname in ['defs','clipPath','mask','pattern','symbol'] for p in el.iterancestors()):continue
   if any(p.get('transform') or p.get('clip-path') or p.get('mask') for p in [el,*el.iterancestors()]):continue
   fill=None
   for p in [el,*el.iterancestors()]:
    st=dict(re.findall(r'([\w-]+)\s*:\s*([^;]+)',p.get('style','')))
    fill=st.get('fill',p.get('fill'))
    if fill:break
   if not fill or fill.strip().lower().replace(' ','') not in ['#fff','#ffffff','white','rgb(255,255,255)']:continue
   b=rectangle(el)
   if b and max(abs(b[0]-vx),abs(b[1]-vy),abs(b[2]-vx-w),abs(b[3]-vy-h))<max(w,h)*.001:found.append(el)
  return x,found
 except (ValueError,TypeError):return x,[]
def render(raw,size=400):
 doc=fitz.open(stream=raw,filetype='svg');pdf=fitz.open(stream=doc.convert_to_pdf(),filetype='pdf');p=pdf[0];pix=p.get_pixmap(matrix=fitz.Matrix(size/max(p.rect.width,p.rect.height),size/max(p.rect.width,p.rect.height)),alpha=True);return Image.frombytes('RGBA',[pix.width,pix.height],pix.samples)
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--base',default='/Volumes/Untitled/brand-logos/_clients');ap.add_argument('--prepare',type=int,default=48);a=ap.parse_args();OUT.mkdir(exist_ok=True);found=[];count=0
 proc=subprocess.Popen(['git','-C','/Volumes/Untitled/brand-logos','archive','HEAD','_clients'],stdout=subprocess.PIPE)
 archive=tarfile.open(fileobj=proc.stdout,mode='r|')
 for entry in archive:
  if not entry.isfile() or not re.fullmatch(r'_clients/[^/]+/logo.svg',entry.name):continue
  count+=1
  raw=archive.extractfile(entry).read();x,els=candidates(raw)
  if els:
   brand=entry.name.split('/')[1];folder=OUT/brand;folder.mkdir(exist_ok=True);f=folder/'original.svg';f.write_bytes(raw)
   found.append({'id':brand,'file':str(f),'bytes':len(raw),'background_elements':len(els),'sha256':hashlib.sha256(raw).hexdigest()})
  if count%20000==0:print('Scanned',count,'candidates',len(found),flush=True)
 archive.close();assert proc.wait()==0
 hyper=Path('/Volumes/HDD-1TB/semologo-migration/hypernix-original.svg')
 if hyper.exists() and not any(r['id']=='hypernix' for r in found):
  raw=hyper.read_bytes();x,els=candidates(raw)
  if els:found.append({'id':'hypernix','file':str(hyper),'bytes':len(raw),'background_elements':len(els),'sha256':hashlib.sha256(raw).hexdigest()})
 found.sort(key=lambda r:(r['id']!='hypernix',r['bytes']))
 (OUT/'audit.json').write_text(json.dumps({'scanned':count,'candidates':found,'policy':'Exact full-viewBox white rectangles only; artwork whites preserved. Visual review required.'},ensure_ascii=False,indent=2))
 prepared=[]
 for r in found[:a.prepare]:
  try:
   raw=Path(r['file']).read_bytes();x,els=candidates(raw)
   for el in els:el.getparent().remove(el)
   clean=E.tostring(x);before=render(raw);after=render(clean)
   assert after.getbbox() and after.getextrema()[3][0]==0
   folder=OUT/r['id'];folder.mkdir(exist_ok=True);(folder/'original.svg').write_bytes(raw);(folder/'transparent.svg').write_bytes(clean);before.save(folder/'before.png');after.save(folder/'after.png');r['status']='awaiting-visual-review';prepared.append(r)
  except Exception as e:r['error']=str(e)
 (OUT/'prepared.json').write_text(json.dumps(prepared,ensure_ascii=False,indent=2))
 for start in range(0,len(prepared),24):
  sheet=Image.new('RGB',(1500,((min(24,len(prepared)-start)+3)//4)*200),'#d3d3d3');draw=ImageDraw.Draw(sheet)
  for j,r in enumerate(prepared[start:start+24]):
   x=j%4*375;y=j//4*200
   for k,n in enumerate(['before','after']):
    im=Image.open(OUT/r['id']/(n+'.png'));im.thumbnail((175,160));bg=Image.new('RGBA',(180,165),'#191919');bg.alpha_composite(im,((180-im.width)//2,(165-im.height)//2));sheet.paste(bg.convert('RGB'),(x+k*185,y))
   draw.text((x+4,y+170),str(start+j)+' '+r['id'],fill='black')
  sheet.save(OUT/f'sheet-{start//24+1}.jpg')
 print('PASS scanned',count,'full-canvas candidates',len(found),'prepared',len(prepared),flush=True)
if __name__=='__main__':main()

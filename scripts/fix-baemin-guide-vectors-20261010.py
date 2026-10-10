"""Preserve original PDF SVG path commands/subpaths; select artwork without reconstructing paths."""
from pathlib import Path
from lxml import etree as E
import fitz,cairosvg,json,hashlib,copy,subprocess
import numpy as np
from PIL import Image,ImageDraw
from scipy.ndimage import binary_dilation
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'marketing/assets/baemin-guide-fix-20261010';OLD=ROOT/'marketing/assets/baemin-guide-20261010';OUT.mkdir(exist_ok=True)
SRC=Path('/Users/juuuno/Downloads/[배달의민족]로고사용가이드_꼭 읽어보세요.pdf');DOC=fitz.open(SRC)
RELEASE=json.loads((ROOT/'src/lib/reviewed-baemin-guide-20261010.json').read_text());UPLOADS=[];PROOF=[];TILES=[];ZOOMS=[]
CONFIG=[('baemin','wordmark-black',9,(265,200,565,282)),('baemin','wordmark-white',10,(270,270,390,310)),('baemin','wordmark-mint',10,(455,270,575,310)),('baemin-riders','horizontal',17,(150,220,435,315)),('baemin-riders','vertical',17,(510,160,700,350))]
def object_file(brand,f):
 raw=f.read_bytes();h=hashlib.sha256(raw).hexdigest();rel=f'sources/baemin-guide-fix-20261010/{h[:16]}{f.suffix}';UPLOADS.append({'id':brand,'file':str(f.relative_to(ROOT)),'key':f'_clients/{brand}/{rel}','sha256':h});return rel

def foreground(im,key,original=False):
 a=np.array(im.convert('RGBA'));rgb=a[:,:,:3]
 if key in ('horizontal','vertical'):
  m=(rgb[:,:,1]>rgb[:,:,0]*1.25)&(rgb[:,:,2]>rgb[:,:,0]*1.25)&(rgb[:,:,1]>80)&(a[:,:,3]>127)
 elif original and key=='wordmark-white': m=rgb.min(axis=2)>230
 elif original and key=='wordmark-mint':m=(rgb[:,:,1]>rgb[:,:,0]*1.25)&(rgb[:,:,2]>rgb[:,:,0]*1.25)&(rgb[:,:,1]>80)
 else:m=a[:,:,3]>127
 return m

def normalize(mask):
 ys,xs=np.where(mask);mask=mask[ys.min():ys.max()+1,xs.min():xs.max()+1];im=Image.fromarray(mask.astype('uint8')*255);im=im.resize((1600,round(1600*im.height/im.width)),Image.Resampling.NEAREST);return np.array(im)>127

def compare(original,new,key):
 a=normalize(foreground(original,key,True));b=normalize(foreground(new,key))
 if a.shape!=b.shape:b=np.array(Image.fromarray(b).resize((a.shape[1],a.shape[0]),Image.Resampling.NEAREST))
 # Allow two output-pixel edge variation between PDF and SVG rasterizers.
 missed=(a&~binary_dilation(b,iterations=2)).sum();extra=(b&~binary_dilation(a,iterations=2)).sum();return round(float((missed+extra)/max(1,(a|b).sum())),6)

def main():
 for brand,key,page,zone in CONFIG:
  source=OUT/f'page-{page}.svg';root=E.fromstring(DOC[page-1].get_svg_image(text_as_path=True).encode())
  for i,el in enumerate(root):
   if E.QName(el).localname!='defs':el.set('id',f'art-{i}')
  source.write_bytes(E.tostring(root));query=subprocess.check_output(['inkscape','--query-all',str(source)],text=True)
  bounds={a[0]:tuple(map(float,a[1:])) for line in query.splitlines() if len(a:=line.split(','))==5};selected=[];boxes=[]
  for el in root:
   b=bounds.get(el.get('id'))
   if b and zone[0]<=b[0] and zone[1]<=b[1] and b[0]+b[2]<=zone[2] and b[1]+b[3]<=zone[3]:selected.append(copy.deepcopy(el));boxes.append(b)
  assert selected
  x=min(b[0] for b in boxes);y=min(b[1] for b in boxes);w=max(b[0]+b[2] for b in boxes)-x;h=max(b[1]+b[3] for b in boxes)-y
  result=E.Element(root.tag,nsmap=root.nsmap,viewBox=f'{x} {y} {w} {h}',width=str(w),height=str(h))
  # Original d/fill-rule/transform are copied verbatim, including all M/Z subpaths.
  for el in root:
   if E.QName(el).localname=='defs':result.append(copy.deepcopy(el))
  result.extend(selected);raw=E.tostring(result);assert b'<image' not in raw
  folder=OUT/brand;folder.mkdir(exist_ok=True);svg=folder/(key+'.svg');svg.write_bytes(raw);png=svg.with_suffix('.png');cairosvg.svg2png(bytestring=raw,write_to=str(png),output_width=round(2000*w/max(w,h)),output_height=round(2000*h/max(w,h)))
  im=Image.open(png).convert('RGBA');newfiles={'svg':object_file(brand,svg),'png':object_file(brand,png)};variant=next(v for v in RELEASE['variants'][brand]['variants'] if v['key']==key);variant['files']=newfiles;variant['aspect']=w/h;variant['provider']='사용자 제공 공식 PDF · 원본 경로 보존 검수 (2019.01.04)'
  pix=DOC[page-1].get_pixmap(matrix=fitz.Matrix(8,8),clip=fitz.Rect(x,y,x+w,y+h),alpha=True);original=Image.frombytes('RGBA',[pix.width,pix.height],pix.samples);original.save(folder/(key+'-original-crop.png'))
  old=Image.open(OLD/brand/(key+'.png')).convert('RGBA');before=compare(original,old,key);after=compare(original,im,key);assert after<.01,(key,before,after)
  PROOF.append({'id':brand,'key':key,'page':page,'selected_paths':len(selected),'path_commands_preserved':True,'old_geometry_mismatch':before,'new_geometry_mismatch':after,'comparison':'foreground silhouette mismatch outside 2px rasterizer tolerance at width1600','crop':[x,y,w,h]})
  tile=Image.new('RGBA',(500,290),'#222' if key=='wordmark-white' else '#eee');thumb=im.copy();thumb.thumbnail((480,250));tile.alpha_composite(thumb,((500-thumb.width)//2,5));tile=tile.convert('RGB');ImageDraw.Draw(tile).text((8,270),brand+'/'+key,fill='white' if key=='wordmark-white' else 'black');TILES.append(tile)
  # Full-size proof contains original PDF, previous bad extraction, corrected extraction.
  proof=Image.new('RGB',(1800,360),'#666');draw=ImageDraw.Draw(proof)
  for j,(label,src) in enumerate([('Original PDF',original),('Previous extraction',old),('Corrected extraction',im)]):
   thumb=src.copy();thumb.thumbnail((570,300));bg=Image.new('RGBA',(590,310),'#222' if key=='wordmark-white' else 'white');bg.alpha_composite(thumb,((590-thumb.width)//2,(310-thumb.height)//2));proof.paste(bg.convert('RGB'),(j*600,0));draw.text((j*600+8,325),label+' / '+key,fill='white')
  proof.save(folder/(key+'-comparison.png'));ZOOMS.append(proof)
 for brand,m in RELEASE['variants'].items():
  primary=next(v for v in m['variants'] if v['key']==m['primary']);p=RELEASE['patches'][brand];p.update(logo_svg=primary['files']['svg'],svg_transparent=primary['files']['svg'],logo_png=primary['files']['png'],preview_png='https://logo.vibers.co.kr/_clients/'+brand+'/'+primary['files']['png'])
  # Preserve other metadata and original publication chronology for a shape correction.
  if p.get('presentation'):p['presentation']['file']=primary['files']['png']
 (OUT/'release.json').write_text(json.dumps(RELEASE,ensure_ascii=False,indent=2)+'\n');(OUT/'uploads.json').write_text(json.dumps(UPLOADS,ensure_ascii=False,indent=2)+'\n');(OUT/'geometry-proof.json').write_text(json.dumps(PROOF,indent=2)+'\n')
 sheet=Image.new('RGB',(1500,580),'white')
 for i,t in enumerate(TILES):sheet.paste(t,((i%3)*500,(i//3)*290))
 sheet.save(OUT/'artwork-contact.jpg');proof=Image.new('RGB',(1800,360*len(ZOOMS)),'white')
 for i,t in enumerate(ZOOMS):proof.paste(t,(0,i*360))
 proof.save(OUT/'original-before-after.png');print(json.dumps(PROOF));print('PASS10objects ready')
if __name__=='__main__':main()

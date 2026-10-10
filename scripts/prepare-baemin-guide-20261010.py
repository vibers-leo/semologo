"""Extract user-provided 2019 Baemin guide artwork; never raster-wrap SVG."""
from pathlib import Path
import fitz,json,hashlib,shutil
from PIL import Image,ImageDraw
import numpy as np
from scipy.ndimage import binary_propagation
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'marketing/assets/baemin-guide-20261010';OUT.mkdir(exist_ok=True)
SRC=Path('/Users/juuuno/Downloads/[배달의민족]로고사용가이드_꼭 읽어보세요.pdf');DOC=fitz.open(SRC)
UPLOADS=[];MAN={};PATCH={};THUMBS=[]
def obj(brand,file):
 raw=file.read_bytes();h=hashlib.sha256(raw).hexdigest();rel=f'sources/baemin-guide-20261010/{h[:16]}{file.suffix}'
 UPLOADS.append({'id':brand,'file':str(file.relative_to(ROOT)),'key':f'_clients/{brand}/{rel}','sha256':h});return rel

def vector(page,zone,dest):
 pg=DOC[page-1];zone=fitz.Rect(zone);selected=[d for d in pg.get_drawings() if zone.contains(d['rect']) and d['rect'].width>0 and d['rect'].height>0]
 assert selected
 new=fitz.open();p=new.new_page(width=842,height=596)
 for d in selected:
  shape=p.new_shape()
  for item in d['items']:
   typ=item[0]
   if typ=='l':shape.draw_line(item[1],item[2])
   elif typ=='c':shape.draw_bezier(*item[1:])
   elif typ=='re':shape.draw_rect(item[1])
   elif typ=='qu':shape.draw_quad(item[1])
   else:raise ValueError(typ)
  shape.finish(color=d.get('color'),fill=d.get('fill'),width=d.get('width') or 0,closePath=d.get('closePath',False),even_odd=d.get('even_odd',False),fill_opacity=d.get('fill_opacity') if d.get('fill_opacity') is not None else 1,stroke_opacity=d.get('stroke_opacity') if d.get('stroke_opacity') is not None else 1);shape.commit()
 bounds=selected[0]['rect']
 for d in selected[1:]:bounds|=d['rect']
 p.set_cropbox(bounds)
 raw=p.get_svg_image(text_as_path=True).encode();assert b'<image' not in raw;dest.write_bytes(raw)
 pix=p.get_pixmap(matrix=fitz.Matrix(2000/max(p.rect.width,p.rect.height),2000/max(p.rect.width,p.rect.height)),alpha=True);pix.save(dest.with_suffix('.png'))
 return bounds

def raster(xref,dest,region=None):
 data=DOC.extract_image(xref);tmp=OUT/'embedded-source.jpg';tmp.write_bytes(data['image']);im=Image.open(tmp).convert('RGBA')
 # Remove only the edge-connected near-white JPEG surround; interior artwork whites remain.
 a=np.array(im);mask=(a[:,:,:3].min(axis=2)>=245);seed=np.zeros(mask.shape,dtype=bool);seed[0]=mask[0];seed[-1]=mask[-1];seed[:,0]=mask[:,0];seed[:,-1]=mask[:,-1];outside=binary_propagation(seed,mask=mask);a[outside,3]=0;im=Image.fromarray(a);im=im.crop(im.getbbox());im.save(dest,optimize=True)
 return im

def add(brand,key,label,form,page,zone=None,xref=None,color='original'):
 folder=OUT/brand;folder.mkdir(exist_ok=True);png=folder/(key+'.png');files={}
 if zone:
  svg=folder/(key+'.svg');vector(page,zone,svg);files['svg']=obj(brand,svg)
 else:raster(xref,png)
 files['png']=obj(brand,png);im=Image.open(png).convert('RGBA');w,h=im.size
 m=MAN.setdefault(brand,{'schema':1,'algo_v':1,'id':brand,'primary':key,'variants':[]})
 m['variants'].append({'key':key,'label':label,'form':form,'lockup':form if form in ['symbol','horizontal','vertical','wordmark'] else 'unknown','lang':'ko' if form!='mascot' else 'none','color':color,'files':files,'aspect':w/h,'origin':'manual','provider':'사용자 제공 공식 PDF · 2019.01.04 가이드','derived_from':SRC.name+f' · p.{page}','order':len(m['variants']),'asset_group':'mascot' if form=='mascot' else 'symbol' if form=='symbol' else 'logotype','source_resolution':None if zone else f'{w}×{h} (PDF 내장 비트맵, 확대 없음)'})
 tile=Image.new('RGBA',(440,265),'#202020' if color=='white' else '#eeeeee');im.thumbnail((410,220));tile.alpha_composite(im,((440-im.width)//2,8));tile=tile.convert('RGB');ImageDraw.Draw(tile).text((8,242),brand+' / '+key,fill='white' if color=='white' else 'black');THUMBS.append(tile)
 return files

def main():
 add('baemin','wordmark-black','로고타입 · 검정','wordmark',9,(265,200,565,282),color='black')
 add('baemin','wordmark-white','로고타입 · 흰색','wordmark',10,(270,270,390,310),color='white')
 add('baemin','wordmark-mint','로고타입 · 민트','wordmark',10,(455,270,575,310),color='mint')
 add('baemin','app-icon-2019','앱 아이콘 · 2019 가이드','symbol',12,xref=145)
 add('baemin','character-2019','캐릭터 · 기본형 (2019 가이드)','mascot',14,xref=155)
 # Riders are independent brand artwork with original endorsement retained.
 add('baemin-riders','horizontal','배민라이더스 · 가로조합','horizontal',17,(150,220,435,315))
 add('baemin-riders','vertical','배민라이더스 · 세로조합','vertical',17,(510,160,700,350))
 pdf=OUT/'brand-manual-2019.pdf';shutil.copyfile(SRC,pdf)
 for brand,m in MAN.items():
  p=m['variants'][0]['files'];PATCH[brand]={'id':brand,'has_svg':True,'has_png':True,'logo_svg':p['svg'],'svg_transparent':p['svg'],'logo_png':p['png'],'preview_png':'https://logo.vibers.co.kr/_clients/'+brand+'/'+p['png'],'brand_manual':obj(brand,pdf),'asset_review_status':'verified','variants_n':len(m['variants']),'asset_origin':'사용자 제공 배달의민족 공식 로고 사용가이드 (2019.01.04)','light':False,'light_logo':False,'dark_variant':False,'logo_published_at':'2026-10-10T08:00:00Z','rejected_asset_files':['logo-icon.png','logo-800.png','logo-transparent.png','logo-white.png']}
 PATCH['baemin']['icon_png']=next(v['files']['png'] for v in MAN['baemin']['variants'] if v['key']=='app-icon-2019')
 PATCH['baemin-riders'].update(name_ko='배민라이더스',name_en='Baemin Riders',origin='KR',category='물류·교통',aliases=['배달의민족 라이더스','Baemin Riders'],added_at='2026-10-10')
 (OUT/'release.json').write_text(json.dumps({'patches':PATCH,'variants':MAN},ensure_ascii=False,indent=2)+'\n');(OUT/'uploads.json').write_text(json.dumps(UPLOADS,ensure_ascii=False,indent=2)+'\n')
 sheet=Image.new('RGB',(1760,((len(THUMBS)+3)//4)*265),'white')
 for i,tile in enumerate(THUMBS):sheet.paste(tile,((i%4)*440,(i//4)*265))
 sheet.save(OUT/'artwork-contact.jpg');print('prepared',len(UPLOADS),'objects',[(k,len(v['variants'])) for k,v in MAN.items()])
if __name__=='__main__':main()

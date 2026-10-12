"""Extract front-view vector canvases from official mascot AI artboards."""
from pathlib import Path
import fitz,json,hashlib,subprocess,xml.etree.ElementTree as ET
import numpy as np
import cairosvg
from PIL import Image,ImageDraw
R=Path(__file__).resolve().parents[1];D=R/'marketing/assets/baseball-official-20261012';O=D/'release-mascot';O.mkdir(exist_ok=True);P=D/'ssg/fronts';P.mkdir(exist_ok=True);id='ssglanders'
r=subprocess.run(['curl','--http1.1','-fsSL','--retry','2','--max-time','30','https://logo.vibers.co.kr/_clients/ssglanders/variants.json'],capture_output=True,check=True);m=json.loads(r.stdout)
# Preserve JSONB file order from the current CMS manifest.
s="const{Pool}=require('pg');const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});p.query(\"SELECT asset_manifest FROM semologo.logo_versions WHERE brand_id='ssglanders' AND is_current\").then(r=>console.log(JSON.stringify(r.rows[0].asset_manifest.variants))).finally(()=>p.end());";r=subprocess.run(['ssh','vibers','docker exec -i semologo node -'],input=s,text=True,capture_output=True,check=True);cms=json.loads(r.stdout)
for v in cms['variants']:
 idx=next((i for i,n in enumerate(m['variants'])if n['key']==v['key']),None)
 if idx is None:m['variants'].append(v)
 else:assert m['variants'][idx]['files']==v['files'];m['variants'][idx]=v
uploads=[];sheet=Image.new('RGB',(900,420),'#ddd');draw=ImageDraw.Draw(sheet)
for i,(stem,name) in enumerate([('Landy','랜디'),('Poorie','푸리'),('Batty','배티')]):
 ai=next((D/'ssg').rglob('Mascot_'+stem+'.ai'));page=fitz.open(ai)[0]
 # Locate the four separated vector silhouettes using alpha projection; crop
 # the SVG viewport, never pixels or artwork paths.
 pix=page.get_pixmap(alpha=True);alpha=np.frombuffer(pix.samples,dtype=np.uint8).reshape(pix.height,pix.width,pix.n)[:,:,-1];xs=np.flatnonzero(alpha.max(axis=0)>0);groups=np.split(xs,np.where(np.diff(xs)>5)[0]+1);assert len(groups)==4
 x0,x1=int(groups[0][0]),int(groups[0][-1]);ys=np.flatnonzero(alpha[:,x0:x1+1].max(axis=1)>0);box=fitz.Rect(x0-5,int(ys[0])-5,x1+6,int(ys[-1])+6)
 root=ET.fromstring(page.get_svg_image(text_as_path=True));root.set('viewBox',f'{box.x0} {box.y0} {box.width} {box.height}');root.set('width',str(box.width));root.set('height',str(box.height));svg=P/(stem.lower()+'.svg');ET.ElementTree(root).write(svg,encoding='utf-8',xml_declaration=True);png=svg.with_suffix('.png');scale=2000/max(box.width,box.height);cairosvg.svg2png(url=str(svg),write_to=str(png),output_width=round(box.width*scale),output_height=round(box.height*scale));im=Image.open(png).convert('RGBA');assert im.getbbox();im.thumbnail((640,640));prev=P/(stem.lower()+'-preview.png');im.save(prev);files={}
 for ext,p in [('svg',svg),('png',png),('preview',prev)]:
  sha=hashlib.sha256(p.read_bytes()).hexdigest();file='sources/official-baseball-20261012/'+sha[:20]+p.suffix;files[ext]=file;uploads.append({'id':id,'file':str(p.relative_to(R)),'key':'_clients/'+id+'/'+file,'sha256':sha})
 key='official-ssg-'+stem.lower()+'-front-20261012';assert not any(v['key']==key for v in m['variants']);m['variants'].append({'key':key,'label':name+' 마스코트 · 정면','form':'mascot','lang':'none','color':'original','files':{'svg':files['svg'],'png':files['png']},'preview_png':files['preview'],'origin':'official','official_distribution':True,'source_url':'https://www.ssglanders.com/landers/emblem','order':len(m['variants'])});im.thumbnail((260,340));sheet.paste(im,(i*300+(300-im.width)//2,40),im);draw.text((i*300+20,12),stem+' front',fill='black')
sheet.save(P/'review.jpg');release={'patches':{id:{'variants_n':len(m['variants'])}},'variants':{id:m}}
for name,d in [('release',release),('uploads',uploads)]: (O/(name+'.json')).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
print('READY three mascot front views; requires visual review')

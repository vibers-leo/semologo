"""Restore display PNGs without misrepresenting raster-wrapper SVGs as vector."""
from pathlib import Path
import json,subprocess,hashlib,collections,urllib.request
import numpy as np
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'marketing/assets/quality-followup-20261010';REL=OUT/'recovery-release';REL.mkdir(exist_ok=True)
ids=['no-verca','noordned','paddington','westerveld']
js='const {Pool}=require("pg");(async()=>{let p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL});let b=await p.query("SELECT id,payload,status FROM semologo.logo_posts WHERE id=ANY($1)",['+json.dumps(ids)+']);let v=await p.query("SELECT brand_id,asset_manifest FROM semologo.logo_versions WHERE brand_id=ANY($1) AND is_current",['+json.dumps(ids)+']);console.log(JSON.stringify({brands:b.rows,versions:v.rows}));await p.end()})()'
res=subprocess.run(['ssh','vibers','docker exec -i semologo node -'],input=js,text=True,capture_output=True,check=True);db=json.loads(res.stdout);(REL/'cms-before.json').write_text(json.dumps(db,ensure_ascii=False,indent=2));brands={b['id']:b['payload'] for b in db['brands']};versions={v['brand_id']:v['asset_manifest'] for v in db['versions']}
UP=[];PATCH={};VAR={};ROWS=[]
def obj(id,f):
 h=hashlib.sha256(f.read_bytes()).hexdigest();rel='sources/raster-recovery-20261010/'+h[:16]+f.suffix;UP.append(dict(id=id,file=str(f.relative_to(ROOT)),key='_clients/'+id+'/'+rel,sha256=h));return rel
def connected_white(im):
 # Remove only near-white canvas connected to an outer edge. Internal whites stay intact.
 im=im.convert('RGBA');p=im.load();w,h=im.size;seen=set();q=collections.deque([(x,0) for x in range(w)]+[(x,h-1) for x in range(w)]+[(0,y) for y in range(h)]+[(w-1,y) for y in range(h)])
 while q:
  x,y=q.popleft()
  if (x,y) in seen or x<0 or y<0 or x>=w or y>=h:continue
  seen.add((x,y));r,g,b,a=p[x,y]
  if min(r,g,b)<250:continue
  p[x,y]=(r,g,b,0);q.extend([(x-1,y),(x+1,y),(x,y-1),(x,y+1)])
 # Undo the white matte only at antialiased edges of the two visually verified
 # green/blue components. Internal white regions are not traversed or recolored.
 a=np.array(im,dtype=float);rgb=a[:,:,:3];flat=rgb[a[:,:,3]>0].astype(np.uint8);colors,counts=np.unique(flat,axis=0,return_counts=True);palette=colors[np.argsort(counts)[-2:]].astype(float)
 best=np.full(rgb.shape[:2],1e9);chosen=np.zeros(rgb.shape);opacity=np.ones(rgb.shape[:2])
 for color in palette:
  delta=255-color;den=float(np.dot(delta,delta));alpha=np.clip(np.sum((255-rgb)*delta,axis=2)/den,0,1);pred=255-alpha[:,:,None]*delta;err=np.max(np.abs(pred-rgb),axis=2);mask=err<best;best[mask]=err[mask];chosen[mask]=color;opacity[mask]=alpha[mask]
 edge=(a[:,:,3]>0)&(opacity<.995)&(best<12);a[:,:,:3][edge]=chosen[edge];a[:,:,3][edge]=opacity[edge]*255
 # This reviewed logo contains only blue and green artwork; the white counters
 # and isolated JPEG-white specks belong to the same canvas, not white artwork.
 a[:,:,3][np.min(rgb,axis=2)>245]=0
 return Image.fromarray(np.clip(a,0,255).astype(np.uint8),'RGBA')
for id,src in [('no-verca','no-verca-native.png'),('noordned','noordned-embedded-0.png'),('paddington','paddington-page.png')]:
 manifest=versions.get(id)
 if not isinstance(manifest,dict) or not manifest.get('variants'):
  try:manifest=json.load(urllib.request.urlopen(urllib.request.Request('https://logo.vibers.co.kr/_clients/'+id+'/variants.json',headers={'Referer':'https://semologo.com/','Origin':'https://semologo.com'}),timeout=20))
  except Exception:manifest={'id':id,'variants':[]}
 manifest['id']=id;manifest.setdefault('variants',[])
 f=OUT/'original-retry'/src;im=Image.open(f).convert('RGBA');originalsize=im.size
 if id=='noordned':im=connected_white(im)
 bbox=im.getchannel('A').getbbox();assert bbox;im=im.crop(bbox);png=REL/(id+'.png');im.save(png,optimize=True);prev=REL/(id+'-preview.png');small=im.copy();small.thumbnail((640,640),Image.Resampling.LANCZOS);small.save(prev,optimize=True)
 files={'png':obj(id,png)};preview=obj(id,prev);key='reviewed-raster-recovery-20261010';variant=dict(key=key,label='투명 PNG · 원본 래스터 품질 복구',files=files,preview_png=preview,provider='wikimedia',official_distribution=False,source_note='원 SVG 내 래스터를 원해상도 보존해 복구. Paddington은 원 SVG 페이지 영역만 렌더. SVG 다운로드로 서비스하지 않음.',order=1)
 manifest['variants']=[v for v in manifest['variants'] if v.get('key')!=key]+[variant];VAR[id]=manifest
 PATCH[id]=dict(has_png=True,has_svg=False,logo_svg=None,svg_transparent=None,logo_png=files['png'],preview_png='https://logo.vibers.co.kr/_clients/'+id+'/'+preview,icon_png=None,dark_png=None,light=False,light_logo=False,dark_variant=False,presentation={'file':files['png'],'bg':'light'},variants_n=len(manifest['variants']),metadata={**(brands[id].get('metadata') or {}),'has_png':True,'has_svg':False})
 ROWS.append(dict(id=id,source_size=originalsize,output_size=im.size,preview_size=small.size,svg_service=False,png=png.name))
if brands['westerveld'].get('category')!='공공·기관':PATCH['westerveld']={'category':'공공·기관'}
release=dict(patches=PATCH,variants=VAR,review={'original_SVGs_preserved':True,'raster_wrapper_SVG_not_served':True,'no_upscale_for_raster_sources':True,'westerveld_kind':'municipality wordmark, not flag','rows':ROWS})
(REL/'release.json').write_text(json.dumps(release,ensure_ascii=False,indent=2)+'\n');(REL/'uploads.json').write_text(json.dumps(list({u['key']:u for u in UP}.values()),indent=2)+'\n')
sheet=Image.new('RGB',(1200,460),'#ccc');d=ImageDraw.Draw(sheet)
for i,r in enumerate(ROWS):
 im=Image.open(REL/r['png']);im.thumbnail((380,380));sheet.paste(im,(i*400+10,45),im);d.text((i*400+10,10),r['id']+' '+str(r['output_size']),fill='black')
sheet.save(REL/'review-contact.jpg');print('Prepared',len(ROWS),'PNG recoveries; Westerveld category',brands['westerveld'].get('category'),'->',PATCH.get('westerveld'))

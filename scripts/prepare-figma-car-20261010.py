"""Append reviewed raster community logos without inventing vector artwork."""
from pathlib import Path
import json,hashlib,subprocess,concurrent.futures
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'marketing/assets/figma-car-collection-20261010'
SELECT={'abarth':2,'acura':5,'alfa-romeo':7,'aston-martin':19,'audi':25,'bentley':35,'bmw':44,'brabus':42,'bugatti':54,'buick':50,'byd':51,'cadillac':52,'chevrolet':63,'citroen':61,'dacia':65,'daihatsu':79}
current={r['brand_id']:(r['asset_manifest'] or {}).get('variants') for r in json.loads((OUT/'cms-current-manifests.json').read_text())}
UP=[];PATCH={};VAR={};REPORT=[]
def obj(id,file):
 h=hashlib.sha256(file.read_bytes()).hexdigest();rel=f'sources/figma-car-community-20261010/{h[:16]}{file.suffix}'
 UP.append({'id':id,'file':str(file.relative_to(ROOT)),'key':f'_clients/{id}/{rel}','sha256':h});return rel
def fetch(id):
 dest=OUT/'existing'/id;dest.mkdir(parents=True,exist_ok=True)
 f=dest/'variants.json'
 r=subprocess.run(['curl','--fail','--silent','--show-error','--max-time','30',f'https://logo.vibers.co.kr/_clients/{id}/variants.json'],capture_output=True)
 if r.returncode==0:
  try:json.loads(r.stdout);f.write_bytes(r.stdout)
  except json.JSONDecodeError:pass
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:list(pool.map(fetch,SELECT))
for id,num in SELECT.items():
 source=OUT/'embedded'/f'image{num}_2_3.png';im=Image.open(source).convert('RGBA');assert im.getextrema()[3][0]==0
 bbox=im.getchannel('A').getbbox();assert bbox
 folder=OUT/'release'/id;folder.mkdir(parents=True,exist_ok=True)
 crop=im.crop(bbox);png=folder/'alpha-crop.png';crop.save(png,optimize=True)
 preview=folder/'preview-640.png';small=crop.copy();small.thumbnail((640,640),Image.Resampling.LANCZOS);small.save(preview,optimize=True)
 # Preserve all RGB/RGBA artwork; only fully transparent outside margins are cropped.
 assert crop.tobytes()==im.crop(bbox).tobytes()
 files={'png':obj(id,png)};original=obj(id,source);prev=obj(id,preview)
 prior=current.get(id)
 if not prior:
  try:prior=json.loads((OUT/'existing'/id/'variants.json').read_text())
  except (FileNotFoundError,json.JSONDecodeError):prior=None
 manifest=prior or {'schema':1,'algo_v':1,'id':id,'primary':'figma-car-community-raster','variants':[]}
 assert manifest['id']==id
 variant={'key':'figma-car-community-raster','label':'PNG · 커뮤니티 수록본 · 사용 시기 미확인','form':'logo','lang':'unknown','color':'color','files':files,'preview_png':prev,'original_png':original,'original_download_url':f'https://logo.vibers.co.kr/_clients/{id}/{original}','aspect':round(crop.width/crop.height,4),'provider':'figma-community','origin':'collected','order':95,'official_distribution':False,'source_note':'사용자 제공 Car Logo Figma Community 내보내기의 내장 PNG 원본. 실제 벡터가 아닌 래스터 이미지이며 투명 여백만 자름. 원래 해상도를 보존하고 확대하지 않음. 사용 시기는 확인되지 않음.'}
 manifest['variants']=[v for v in manifest['variants'] if v['key']!=variant['key']]+[variant]
 VAR[id]=manifest;PATCH[id]={'variants_n':len(manifest['variants'])}
 REPORT.append({'id':id,'source':str(source.relative_to(ROOT)),'original_size':im.size,'alpha_bbox':bbox,'crop_size':crop.size,'preview_size':small.size,'pixels_preserved':True})
(OUT/'release.json').write_text(json.dumps({'patches':PATCH,'variants':VAR,'review':{'source_kind':'Figma Community embedded raster','vector_assets':0,'upscaling':False,'existing_representatives_preserved':True,'dates_unknown':True}},ensure_ascii=False,indent=2)+'\n')
(OUT/'uploads.json').write_text(json.dumps(UP,indent=2)+'\n');(OUT/'validation.json').write_text(json.dumps(REPORT,indent=2)+'\n')
sheet=Image.new('RGB',(1200,200*4),'#e8e8e8');d=ImageDraw.Draw(sheet)
for i,id in enumerate(SELECT):
 x=i%4*300;y=i//4*200;d.text((x+8,y+5),id,fill='black');im=Image.open(OUT/'release'/id/'alpha-crop.png');im.thumbnail((280,165));sheet.paste(im,(x+10,y+28),im)
sheet.save(OUT/'release-contact.jpg')
names=sorted({f.stem.removesuffix('-1') for f in (OUT/'originals').glob('*.png')},key=str.casefold)
(OUT/'collection-roster.json').write_text(json.dumps({'source':'user-provided Figma Community car collection','names':names,'count':len(names),'reviewed_published_candidates':list(SELECT),'unreviewed_names_are_not_catalog_seeds':True},ensure_ascii=False,indent=2)+'\n')
print('Prepared',len(VAR),'PNG-only brands,',len(UP),'objects; roster',len(names))

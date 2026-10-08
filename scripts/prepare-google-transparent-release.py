"""Re-render reviewed Google family SVGs with alpha; preserve gradients and artwork whites."""
import copy,hashlib,io,json,subprocess
from pathlib import Path
from lxml import etree as E
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'marketing/assets/google-background-review-20261009';CDN='https://logo.vibers.co.kr/_clients'
IDS=['deepmind','google-cloud','google','google-search-console','google-photos','google-optimize','google-meet','google-fit','google-developers','google-calendar','google-analytics','fuchsia','google-play']
def render(raw):
 x=E.fromstring(raw);box=[float(v) for v in x.get('viewBox').replace(',',' ').split()];w,h=box[2:];x.set('width',str(round(800*w/max(w,h))));x.set('height',str(round(800*h/max(w,h))));raw=E.tostring(x)
 code="const sharp=require('sharp');const a=[];process.stdin.on('data',d=>a.push(d));process.stdin.on('end',async()=>{try{process.stdout.write(await sharp(Buffer.concat(a),{density:72}).resize({width:800,height:800,fit:'inside'}).trim({background:'#00000000'}).png().toBuffer());}catch(e){console.error(e.message);process.exitCode=1;}});"
 return subprocess.check_output(['node','-e',code],input=raw,cwd=ROOT)
def main():
 patches={};variants={};uploads=[];decisions=[]
 def save(id,raw):
  sha=hashlib.sha256(raw).hexdigest();prefix='sources/reviewed-transparent-20261009/'+sha[:16];files={}
  for ext,body in [('svg',raw),('png',render(raw))]:
   rel=prefix+'.'+ext;f=OUT/'release'/id/rel;f.parent.mkdir(parents=True,exist_ok=True);f.write_bytes(body);files[ext]=rel
   uploads.append({'id':id,'file':str(f.relative_to(ROOT)),'key':'_clients/'+id+'/'+rel,'sha256':hashlib.sha256(body).hexdigest()})
  return files
 for id in IDS:
  d=OUT/id;original=(d/'logo.svg').read_bytes();raw=original
  if id=='google':
   # Existing display is the black monochrome variant. Keep its vector shape and preserve blue original separately.
   im=Image.open(d/'logo.png').convert('RGB');assert all(max(px)-min(px)<3 for px in im.getdata())
   x=E.fromstring(raw);x.set('fill','#000000');raw=E.tostring(x)
  elif id=='google-cloud':
   # The existing collected wide logo contains four original color symbol paths followed by a wordmark.
   wide=E.parse(str(d/'sources/vlz/wide.svg')).getroot();assert len(wide)==5
   x=E.Element('{http://www.w3.org/2000/svg}svg',nsmap={None:'http://www.w3.org/2000/svg'},viewBox='42 3.5 36 29')
   for path in list(wide)[:4]:x.append(copy.deepcopy(path))
   raw=E.tostring(x)
  files=save(id,raw);Image.open(ROOT/uploads[-1]['file']).save(d/'reviewed.png')
  label='블랙 심볼마크' if id=='google' else '컬러 심볼마크' if id=='google-cloud' else '투명 배경 로고'
  patches[id]={'has_svg':True,'has_png':True,'logo_svg':True,'logo_png':files['png'],'preview_png':f"{CDN}/{id}/{files['png']}",'svg_transparent':files['svg'],'light':False,'light_logo':False,'dark_variant':False,'asset_review_status':'verified','rejected_asset_files':['logo.png','logo-800.png','logo-transparent.png','logo-icon.png','logo-white.png']}
  old=json.loads((d/'variants.json').read_text()) if (d/'variants.json').exists() else {'schema':1,'algo_v':1,'id':id,'variants':[]}
  kept=[]
  for v in old['variants']:
   if v.get('files',{}).get('svg')=='logo.svg':
    if id in ['google','google-cloud']:
     v['files']=save(id,original);v['label']='블루 심볼마크';v['color']='blue';v['order']=20;kept.append(v)
    continue
   kept.append(v)
  primary={'key':'reviewed-transparent','form':'symbol','lang':'none','color':'black' if id=='google' else 'original','label':label,'files':files,'provider':'보유 벡터 원본 · 투명 PNG 재생성','origin':'derived','order':0}
  variants[id]={**old,'primary':primary['key'],'variants':[primary,*kept]}
  decisions.append({'id':id,'source_sha256':hashlib.sha256(original).hexdigest(),'original_svg_already_transparent':True,'opaque_legacy_png':True,'preserved_internal_white':id in ['google-calendar','google-search-console'],'source_note':'Preserved existing displayed monochrome black variant; blue SVG retained' if id=='google' else 'Extracted four unchanged symbol paths from collected wide vector; blue SVG retained' if id=='google-cloud' else 'SVG unchanged; Sharp alpha render preserves gradients and internal white'})
 release={'patches':patches,'variants':variants};(OUT/'release.json').write_text(json.dumps(release,ensure_ascii=False,indent=2));(OUT/'uploads.json').write_text(json.dumps(uploads,indent=2));(OUT/'decisions.json').write_text(json.dumps(decisions,indent=2));(ROOT/'src/lib/reviewed-google-transparent-20261009.json').write_text(json.dumps(release,ensure_ascii=False,indent=2)+'\n')
 sheet=Image.new('RGB',(1200,7*180),'#ddd');draw=ImageDraw.Draw(sheet)
 for i,id in enumerate(IDS):
  x=(i%2)*600;y=(i//2)*180
  for j,name in enumerate(['logo.png','reviewed.png']):
   im=Image.open(OUT/id/name).convert('RGBA');im.thumbnail((155,145));bg=Image.new('RGBA',(160,150),'#242424');bg.alpha_composite(im,((160-im.width)//2,(150-im.height)//2));sheet.paste(bg.convert('RGB'),(x+j*170,y))
   if j==1:
    bg=Image.new('RGBA',(160,150),'#c8c8c8');bg.alpha_composite(im,((160-im.width)//2,(150-im.height)//2));sheet.paste(bg.convert('RGB'),(x+340,y))
  draw.text((x,y+155),id,fill='black')
 sheet.save(OUT/'comparison-sharp.jpg');print('PASS prepared',len(patches),'brands;',len(uploads),'objects')
if __name__=='__main__':main()

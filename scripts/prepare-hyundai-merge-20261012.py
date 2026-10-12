from pathlib import Path
import json,hashlib,xml.etree.ElementTree as E,io,subprocess
import cairosvg
from PIL import Image
R=Path(__file__).resolve().parents[1];D=R/'marketing/assets/hyundai-merge-20261012';D.mkdir(exist_ok=True)
sources=['hyundai-motor-company','hyundai-motor-company-2','hyundai-automobiles-1']
m=json.loads((R/'src/lib/reviewed-community-20261010.json').read_text())['variants']['hyundai'];m=json.loads(json.dumps(m));
if (D/'cms-before.json').exists():
 before=json.loads((D/'cms-before.json').read_text());m=next(b for b in before if b['id']=='hyundai')['asset_manifest']['variants']
uploads=[]
labels={'hyundai':'심볼 · 기존 수집본','hyundai-motor-company':'가로 조합 · 기존 수집본','hyundai-motor-company-2':'세로 조합 · 기존 수집본','hyundai-automobiles-1':'세로 조합 · 색상 변형 수집본'}
for id in ['hyundai']+sources:
 raw=(D/(id+'.svg')).read_bytes();t=E.fromstring(raw);assert not any(el.tag.split('}')[-1] in ['image','script','foreignObject'] for el in t.iter());original=raw
 for parent in t.iter():
  for el in list(parent):
   if el.tag.split('}')[-1]=='path' and el.get('fill')=='#fff' and el.get('d')=='M0 0h192.756v192.756H0V0z':parent.remove(el)
 raw=E.tostring(t);png=cairosvg.svg2png(bytestring=raw,output_width=2000);im=Image.open(io.BytesIO(png));box=im.getbbox();assert box
 # Trim only empty alpha margins; the vector viewBox follows the same artwork bounds.
 vb=list(map(float,t.get('viewBox').replace(',',' ').split()));x,y,x2,y2=box;pad=10;x=max(0,x-pad);y=max(0,y-pad);x2=min(im.width,x2+pad);y2=min(im.height,y2+pad);t.set('viewBox',f'{vb[0]+x/im.width*vb[2]} {vb[1]+y/im.height*vb[3]} {(x2-x)/im.width*vb[2]} {(y2-y)/im.height*vb[3]}');t.set('width',str(x2-x));t.set('height',str(y2-y));raw=E.tostring(t);png=cairosvg.svg2png(bytestring=raw,output_width=2000)
 files={}
 for ext,b in [('svg',raw),('png',png),('original.svg',original)]:
  f='sources/identity-merge-20261012/'+hashlib.sha256(b).hexdigest()[:20]+'.'+ext;p=D/'release'/f;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b);uploads.append({'id':'hyundai','file':str(p.relative_to(R)),'key':'_clients/hyundai/'+f,'sha256':hashlib.sha256(b).hexdigest()});files[ext]=f
 m['variants'].append({'key':'merged-'+id,'label':labels[id],'form':'symbol' if id=='hyundai' else 'horizontal' if id=='hyundai-motor-company' else 'vertical','lang':'none' if id=='hyundai' else 'en','color':'original','files':{k:files[k] for k in ['svg','png']},'original_svg':files['original.svg'],'origin':'collected','provider':'기존 보유 SVG · 동일 브랜드 시각 검수','source_brand_id':id,'order':len(m['variants'])})
primary=m['variants'][0];m['primary']=primary['key'];file=primary['files']['png'];patch={'variants_n':len(m['variants']),'aliases':['Hyundai','Hyundai Motor','Hyundai Motor Company','현대자동차','현대차']+sources,'presentation':{'file':file,'bg':'light'},'preview_png':'https://logo.vibers.co.kr/_clients/hyundai/'+file,'logo_png':file,'has_png':True}
patches={'hyundai':patch,**{id:{'hidden':True,'merged_into':'hyundai','variant_of':'hyundai','hidden_reason':'동일 현대자동차 로고를 가로·세로·심볼 베리에이션으로 통합'} for id in sources}}
release={'patches':patches,'variants':{'hyundai':m}};(D/'release.json').write_text(json.dumps(release,ensure_ascii=False,indent=2));(D/'uploads.json').write_text(json.dumps(uploads,indent=2));
cyber=json.loads((R/'marketing/assets/cyberpixie-transparent-20261012/release.json').read_text());release['patches']['cyberpixie']=cyber['patch'];release['variants']['cyberpixie']=cyber['manifest'];(R/'src/lib/reviewed-identity-merges-20261012.json').write_text(json.dumps(release,ensure_ascii=False,indent=2)+'\n');print('Prepared',len(m['variants']),'Hyundai variants,',len(sources),'duplicate merges')

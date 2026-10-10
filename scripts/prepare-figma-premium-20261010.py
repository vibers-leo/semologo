"""Prepare verified real-company vector cells; preserve existing official assets."""
from pathlib import Path
import json,hashlib,shutil,concurrent.futures,xml.etree.ElementTree as ET
import cairosvg
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'marketing/assets/figma-premium-collection-20261010'
UP=[];PATCH={};VAR={}
canonical=json.loads((OUT/'canonical-candidates.json').read_text());canonical.pop('Carta');canonical['Outreach']='outreach-io'
for name in ['Airwallex','Attentive','Hopin','Pendo']:canonical[name]=name.lower()
new={'airwallex','attentive','hopin','pendo','outreach-io'}
current={r['brand_id']:(r['asset_manifest'] or {}).get('variants') for r in json.loads((OUT/'cms-current-manifests.json').read_text())}
matches={r['company']:r['candidates'][0] for r in json.loads((OUT/'matches.json').read_text())}
def obj(id,f):
 h=hashlib.sha256(f.read_bytes()).hexdigest();rel=f'sources/untitled-ui-community-20261010/{h[:16]}{f.suffix}'
 UP.append({'id':id,'file':str(f.relative_to(ROOT)),'key':f'_clients/{id}/{rel}','sha256':h});return rel
source=OUT/'source-collection.zip';shutil.copyfile('/Users/juuuno/Downloads/❖ Premium company logos UI kit – Untitled UI (Community).zip',source)
source_url='https://logo.vibers.co.kr/_clients/active-campaign/'+obj('active-campaign',source)
def render(pair):
 name,id=pair;folder=OUT/'release'/id;folder.mkdir(parents=True,exist_ok=True)
 svg=folder/'lockup.svg';shutil.copyfile(OUT/'candidates'/(matches[name]['key']+'.svg'),svg)
 tree=ET.parse(svg);tags=[e.tag.split('}')[-1] for e in tree.iter()]
 assert not set(tags)&{'image','foreignObject','script','a','use'}
 for e in tree.iter():
  assert not any(k.split('}')[-1].startswith('on') for k in e.attrib)
  assert not any(k.split('}')[-1]=='href' and not v.startswith('#') for k,v in e.attrib.items())
 box=list(map(float,tree.getroot().attrib['viewBox'].split()));w,h=box[2:];pw=2000 if w>=h else round(2000*w/h);ph=round(2000*h/w) if w>=h else 2000
 png=folder/'lockup-2000.png';cairosvg.svg2png(url=str(svg),write_to=str(png),output_width=pw,output_height=ph)
 im=Image.open(png).convert('RGBA');assert im.getextrema()[3][0]==0;im.thumbnail((640,640),Image.Resampling.LANCZOS);im.save(folder/'preview-640.png',optimize=True)
 return name,id,folder,w/h
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(render,canonical.items()))
for name,id,folder,aspect in results:
 files={'svg':obj(id,folder/'lockup.svg'),'png':obj(id,folder/'lockup-2000.png')};preview=obj(id,folder/'preview-640.png')
 prior=current.get(id)
 if not prior:
  try:prior=json.loads((OUT/'existing'/id/'variants.json').read_text())
  except (FileNotFoundError,json.JSONDecodeError):prior=None
 manifest=prior or {'schema':1,'algo_v':1,'id':id,'primary':'untitled-ui-community-lockup','variants':[]}
 assert manifest['id']==id
 variant={'key':'untitled-ui-community-lockup','label':'가로조합 · Untitled UI 커뮤니티 수록본','form':'horizontal','lang':'en','color':'color','files':files,'preview_png':preview,'aspect':round(aspect,4),'provider':'figma-community','origin':'collected','order':90,'official_distribution':False,'source_archive_url':source_url,'source_note':'사용자 제공 Untitled UI (Community) 내보내기. 공식 브랜드 배포 파일이 아닌 커뮤니티 수록본. 원본 벡터 경로를 보존하여 추출.'}
 manifest['variants']=[v for v in manifest['variants'] if v['key']!=variant['key']]+[variant];VAR[id]=manifest
 PATCH[id]={'variants_n':len(manifest['variants'])}
 if id in new:
  PATCH[id].update({'id':id,'name_en':name,'name_ko':name,'category':'금융·결제' if id=='airwallex' else 'IT·테크','origin':'GLOBAL','has_svg':True,'has_png':True,'logo_svg':files['svg'],'svg_transparent':files['svg'],'logo_png':files['png'],'preview_png':'https://logo.vibers.co.kr/_clients/'+id+'/'+preview,'asset_origin':None,'asset_review_status':'verified','sources':['figma-community'],'collected_originals_url':source_url,'presentation':{'file':files['png'],'bg':'light'},'metadata':{'has_svg':True,'has_png':True,'added_at':'2026-10-10'},'aliases':[name]})
release={'patches':PATCH,'variants':VAR,'review':{'existing':31,'new':sorted(new),'held':['Carta: existing carta-badge identity not established'],'identity_collisions':['outreach is unrelated red human-shaped logo; new SaaS content uses outreach-io'],'source_kind':'Figma Community user-provided export','official_representatives_preserved':True}}
(OUT/'release.json').write_text(json.dumps(release,ensure_ascii=False,indent=2)+'\n');(OUT/'uploads.json').write_text(json.dumps(UP,indent=2)+'\n')
sheet=Image.new('RGB',(1200,120*12),'#e8e8e8');d=ImageDraw.Draw(sheet)
for i,(name,id,folder,_) in enumerate(results):
 x=i%3*400;y=i//3*120;d.text((x+8,y+5),name+' / '+id,fill='black');im=Image.open(folder/'preview-640.png');im.thumbnail((370,85));sheet.paste(im,(x+12,y+28),im)
sheet.save(OUT/'release-contact.jpg');print('Prepared',len(VAR),'brands',len(UP),'immutable objects; five new,31 existing; Carta held')

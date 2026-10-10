"""Package visually approved AI extracts and preserve byte-identical originals."""
from pathlib import Path
import json,hashlib
from PIL import Image
R=Path(__file__).resolve().parents[1];O=R/'marketing/assets/png-recollection-ai-batch3-20261010';a=json.loads((O/'extracted.json').read_text());uploads=[];manifests={};patches={};originals={}
def obj(b,p):
 h=hashlib.sha256(p.read_bytes()).hexdigest();rel=f'sources/official-ai-batch3-20261010/{h[:20]}{p.suffix}';u={'id':b,'file':str(p.relative_to(R)),'key':f'_clients/{b}/{rel}','sha256':h}
 if u not in uploads:uploads.append(u)
 return rel
for x in a:
 b=x['id'];f=R/x['svg'];p=R/x['png'];im=Image.open(p);assert im.getbbox();original=obj(b,R/x['original']);originals.setdefault(b,[])
 if original not in originals[b]:originals[b].append(original)
 files={'svg':obj(b,f),'png':obj(b,p)};m=manifests.setdefault(b,{'schema':1,'algo_v':1,'id':b,'primary':x['key'],'variants':[]})
 m['variants'].append({'key':x['key'],'label':x['label'],'form':x['form'],'lockup':x['form'],'lang':'unknown','color':'original','files':files,'aspect':im.width/im.height,'origin':'official','provider':'공식 AI · 레이아웃 제거 검수','derived_from':x['source_url'],'original_ai':original,'order':len(m['variants']),'asset_group':'symbol' if x['form']=='symbol' else 'logotype'})
 x['review']='verified-vector-extract'
for b,m in manifests.items():
 if b=='gongu-ci-1747':m['primary']=next(v['key'] for v in m['variants'] if v['form']=='horizontal')

 v=next(v for v in m['variants'] if v['key']==m['primary']);f=v['files'];prefix='https://logo.vibers.co.kr/_clients/'+b+'/'
 patches[b]={'has_svg':True,'has_png':True,'logo_svg':f['svg'],'svg_transparent':f['svg'],'logo_png':f['png'],'preview_png':prefix+f['png'],'original_ai_url':prefix+v['original_ai'],'variants_n':len(m['variants']),'asset_review_status':'verified','asset_origin':'공식 AI 원본 재수집 · 가이드 및 레이아웃 제거','asset_checked_at':'2026-10-10','logo_published_at':'2026-10-10T11:00:00Z','light':False,'light_logo':False,'presentation':{'file':f['png'],'bg':'light'},'rejected_asset_files':['logo-icon.png','logo-800.png','logo-transparent.png','logo-white.png']}
(O/'release.json').write_text(json.dumps({'schema':1,'reviewed':a,'uploads':uploads,'patches':patches,'manifests':manifests,'original_files':originals},ensure_ascii=False,indent=2));print(len(manifests),'brands',len(a),'SVG + PNG',len(uploads),'objects',sum(len(v) for v in originals.values()),'actual official AI originals')

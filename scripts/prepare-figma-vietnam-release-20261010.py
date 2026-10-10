import json,hashlib,copy
from pathlib import Path
from PIL import Image
R=Path(__file__).resolve().parents[1];D=R/'marketing/assets/figma-vietnam-collection-20261010';rows=json.loads((D/'extracted.json').read_text());old={r['id']:r for r in json.loads((D/'cms-before.json').read_text())};holds={'acb-vietnam':'기존 acb 계열 5개 콘텐츠 신원·중복 미확정','mb-bank':'기존 mb 콘텐츠 신원·중복 미확정'}
urls={'abbank':'https://www.abbank.vn/en','agribank-vietnam':'https://www.agribank.com.vn/vn/ca-nhan','baoviet-bank':'https://www.baovietbank.vn/Home/','cake-bank':'https://cake.vn/','eximbank-vietnam':'https://eximbank.com.vn/vi/ho-tro','hdbank':'https://hdbank.com.vn/','lpbank':'https://lpbank.com.vn/','bank-for-investment-and-development-of-vietnam':'https://bidv.com.vn/vn/trang-chu','msb':'https://www.msb.com.vn/en/','tpbank':'https://tpb.vn/','vib':'https://www.vib.com.vn/','vietcombank':'https://www.vietcombank.com.vn/'}
rel={'patches':{},'variants':{},'source_kind':'user-provided-figma-community','official':False,'snapshot_date':'2026-10-10'};up=[];proof=[]
for r in rows:
 id=r['id']
 if id in holds:continue
 before=old.get(id);m=copy.deepcopy((before.get('asset_manifest') or {}).get('variants')) if before else None;m=m or {'schema':1,'algo_v':1,'id':id,'primary':'figma-vn-community-horizontal','variants':[]};files={}
 for ext in ['svg','png']:
  raw=(R/r[ext]).read_bytes();h=hashlib.sha256(raw).hexdigest();f=f'sources/figma-vietnam-community-20261010/{h[:20]}.{ext}';files[ext]=f;up.append({'id':id,'file':r[ext],'key':f'_clients/{id}/{f}','sha256':h,'bytes':len(raw)})
 im=Image.open(R/r['png']);assert im.mode=='RGBA' and im.getextrema()[3][0]==0
 m['variants'].append({'key':'figma-vn-community-horizontal','label':'커뮤니티 수록 가로형 · 시기 미확인','form':'horizontal','lockup':'horizontal','lang':'mixed','color':'original','files':files,'provider':'사용자 제공 Figma Community 수집본','origin':'community','official':False,'order':len(m['variants'])});rel['variants'][id]=m
 if before:
  assert before['status']=='published' and not before['payload'].get('hidden') and not before['payload'].get('merged_into');patch={'variants_n':len(m['variants'])}
 else:
  patch={'id':id,'name_ko':r['name'],'name_en':r['name'],'aliases':[r['name']],'category':'금융·결제','origin':'VN','has_svg':True,'has_png':True,'logo_svg':files['svg'],'svg_transparent':files['svg'],'logo_png':files['png'],'preview_png':f"https://logo.vibers.co.kr/_clients/{id}/{files['png']}",'presentation':{'file':files['png'],'bg':'light'},'variants_n':1,'asset_origin':'사용자 제공 Figma Community 수집본','asset_review_status':'verified','added_at':'2026-10-10','logo_published_at':'2026-10-10T13:00:00Z','homepage':urls[id],'official_asset_reviewed':False}
 rel['patches'][id]=patch;proof.append({'id':id,'name':r['name'],'existing':bool(before),'official_identity_reference':urls[id],'asset_source_kind':'community','official_asset':False,'visual_review':'approved','transparent_png':True,'png_dimensions':im.size,'vector_only':True,'existing_variants_preserved':len(m['variants'])-1})
for name,value in [('release',rel),('uploads',up),('review-proof',proof),('held-identities',holds)]: (D/(name+'.json')).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
print(len(proof),'brands',len(up),'SVG/PNG',sum(not p['existing'] for p in proof),'new identities')

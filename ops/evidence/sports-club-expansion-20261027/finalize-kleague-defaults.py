import runpy,json,copy
from pathlib import Path
h=runpy.run_path('/root/ops/kbo-complete-20261027/publish-helpers.py');globals().update({k:v for k,v in h.items()if not k.startswith('__')});B=Path('/root/ops/sports-expansion-20261027');receipt=[]
choices={'dhcfc':'공식 대전 단독 엠블럼 · 컬러','jejuskfc':'공식 제주 엠블럼','gimcheonfc':'공식 김천 상무 엠블럼','gwangjufc':'공식 광주 엠블럼'}
for ident,label in choices.items():
 old=p['current'](c['node'],ident);payload=old['payload'];meta=payload.get('metadata')or{}
 if payload.get('presentation')or payload.get('presentation_locked')or meta.get('presentation')or meta.get('presentation_locked'):receipt.append({'id':ident,'manual_representative_preserved':True});continue
 mf=copy.deepcopy(old['asset_manifest']['variants']);v=next(v for v in mf['variants']if v['label']==label);mf['primary']=v['key'];f=v['files'];patch={'logo_svg':f['svg'],'svg_transparent':f['svg'],'logo_png':f['png'],'preview_png':'https://logo.vibers.co.kr/_clients/'+ident+'/'+f['png'],'presentation':{'file':f['png'],'svgFile':f['svg'],'bg':'light'},'asset_review_status':'verified','asset_origin':'구단 공식 AI 원본 벡터','has_svg':True,'has_png':True};receipt.append(commit(ident,old,mf,patch));after=p['current'](c['node'],ident);assert after['payload'].get('metadata',{}).get('hidden')==meta.get('hidden');assert after['payload'].get('hidden')==payload.get('hidden')
(B/'kleague-defaults-receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2));print(receipt)

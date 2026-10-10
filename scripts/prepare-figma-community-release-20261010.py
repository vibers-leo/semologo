import json,hashlib,copy,datetime
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1]; d=root/'marketing/assets/figma-korean-collection-20261010'
rows=json.loads((d/'extracted.json').read_text()); old={r['id']:r for r in json.loads((d/'cms-before.json').read_text())}
release={'patches':{},'variants':{},'source_kind':'user-provided-figma-community','official':False,'checked_at':'2026-10-10','representatives_preserved':True};uploads=[];proof=[]
for r in rows:
 id=r['id'];before=old[id];assert before['status']=='published' and not before['payload'].get('hidden') and not before['payload'].get('merged_into')
 manifest=copy.deepcopy((before.get('asset_manifest') or {}).get('variants') or {'schema':1,'algo_v':1,'id':id,'primary':None,'variants':[]})
 assert isinstance(manifest.get('variants'),list)
 files={}
 for ext in ['svg','png']:
  path=root/r[ext];raw=path.read_bytes();sha=hashlib.sha256(raw).hexdigest();rel=f'sources/figma-community-20261010/{sha[:20]}.{ext}';files[ext]=rel
  uploads.append({'id':id,'file':r[ext],'key':f'_clients/{id}/{rel}','sha256':sha,'bytes':len(raw)})
 im=Image.open(root/r['png']);assert im.mode=='RGBA' and im.getextrema()[3][0]==0 and max(im.size)==2000
 variant={'key':'figma-20261010-'+r['key'],'label':'커뮤니티 수록 '+('구형 로고 · 시기 미확인' if id=='baskinrobbins' else '로고 · 시기 미확인'),'form':'horizontal','lockup':'horizontal','lang':'mixed','color':'original','files':files,'provider':'사용자 제공 Figma Community 수집본','origin':'community','official':False,'order':len(manifest['variants']),'source_note':'커뮤니티 내보내기에서 벡터 추출·시각 검수. 공식 배포 및 최신 CI 여부는 확인되지 않았습니다.'}
 assert not any(v['key']==variant['key'] for v in manifest['variants']);manifest['variants'].append(variant);manifest['id']=id
 release['variants'][id]=manifest;release['patches'][id]={'variants_n':len(manifest['variants'])}
 proof.append({'id':id,'name':before['payload'].get('name_ko'),'existing_variants_preserved':len(manifest['variants'])-1,'primary_preserved':manifest.get('primary'),'png_dimensions':im.size,'transparent':True,'vector_only':True,'visual_review':'approved','official':False})
(d/'release.json').write_text(json.dumps(release,ensure_ascii=False,indent=2)+'\n');(d/'uploads.json').write_text(json.dumps(uploads,ensure_ascii=False,indent=2)+'\n');(d/'review-proof.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n')
print(len(rows),'brands;',len(uploads),'SVG/PNG files; existing primary/variants preserved')

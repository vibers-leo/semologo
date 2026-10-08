"""Package explicitly reviewed canvas removals, checking the current source before release."""
import concurrent.futures,hashlib,io,json,subprocess,importlib.util
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'marketing/assets/background-merge-review-20261008'
CDN='https://logo.vibers.co.kr/_clients'
def main():
 spec=importlib.util.spec_from_file_location('renderer',ROOT/'scripts/prepare-reviewed-asset-release.py');renderer=importlib.util.module_from_spec(spec);spec.loader.exec_module(renderer)
 rows=[]
 for r in json.loads((OUT/'prepared.json').read_text()):
  if r['background_elements'] or r['id'] in ['cj-logo','cj-logo-1']:
   rows.append({**r,'directory':str(OUT/r['id']),'original':str(OUT/r['id']/'original.svg')})
 for r in json.loads((OUT/'remaining/approved.json').read_text()):
  rows.append({**r,'directory':str(OUT/'remaining'/r['id']),'original':r['file'],'mixed':False})
 def check(r):
  raw=subprocess.check_output(['curl','-fsS','--max-time','35',f"{CDN}/{r['id']}/logo.svg"])
  return r if raw==Path(r['original']).read_bytes() else None
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:checked=list(pool.map(check,rows))
 held=[r['id'] for r,c in zip(rows,checked) if c is None]
 patches={};variants={};uploads=[];decisions=[]
 for r in filter(None,checked):
  id=r['id'];d=Path(r['directory']);keep=id.startswith('agencja-budowy-autostrad')
  raw=Path(r['original']).read_bytes() if keep else (d/'transparent.svg').read_bytes()
  im=renderer.png(raw);sha=hashlib.sha256(raw).hexdigest();prefix='sources/reviewed-background-merge-20261008/'+sha[:16]
  files={};b=io.BytesIO();im.save(b,format='PNG')
  for ext,body in [('png',b.getvalue())]+([] if r['mixed'] else [('svg',raw)]):
   rel=prefix+'.'+ext;f=OUT/'release'/id/rel;f.parent.mkdir(parents=True,exist_ok=True);f.write_bytes(body)
   files[ext]=rel;uploads.append({'id':id,'file':str(f.relative_to(ROOT)),'key':'_clients/'+id+'/'+rel,'sha256':hashlib.sha256(body).hexdigest()})
  opaque=[p for p in im.getdata() if p[3]>100];light=sum(min(p[:3])>190 for p in opaque)/len(opaque)>.65
  patch={'has_png':True,'has_svg':not r['mixed'],'logo_svg':not r['mixed'],'logo_png':files['png'],'preview_png':f"{CDN}/{id}/{files['png']}",'svg_transparent':files.get('svg'),'light':light,'light_logo':light,'dark_variant':False,'asset_review_status':'verified','rejected_asset_files':['logo-800.png','logo-icon.png','logo-transparent.png','logo-white.png']}
  if r['mixed']:patch['rejected_asset_files']+=['logo.svg','logo-en.svg']
  if id.startswith('cj-logo'):patch['presentation']={'file':files['png'],'bg':'light'}
  patches[id]=patch
  label='원본 로고' if keep else '투명 배경 로고'
  variants[id]={'schema':1,'algo_v':1,'id':id,'primary':'reviewed','variants':[{'key':'reviewed','form':'unknown','lang':'unknown','color':'original','label':label,'files':files,'provider':'보유 원본 · 배경과 흰색 도형 검수','origin':'collected' if keep else 'derived','order':0,'light':light}]}
  decisions.append({'id':id,'source_sha256':hashlib.sha256(Path(r['original']).read_bytes()).hexdigest(),'canvas_removed':bool(r['background_elements']) and not keep,'png_only':r['mixed'],'white_art_preserved':keep or id in ['cjrw','agencja-zarzadu','agencja-zarzadu-14870']})
 proofs=json.loads((OUT/'merge-proofs.json').read_text());intake={r['id']:r['payload'] for r in json.loads((OUT/'cms-intake.json').read_text())}
 for pair in proofs:
  source,target=pair['source'],pair['target'];assert source in patches and target in patches
  patches[source].update({'variant_of':target,'merged_into':target,'hidden':True,'hidden_reason':'같은 로고 원본을 대표 콘텐츠로 통합'})
  patches[target]['aliases']=list(dict.fromkeys((intake[target].get('aliases') or [])+[source,intake[source]['name_ko'],intake[source]['name_en']]))
 release={'patches':patches,'variants':variants};(OUT/'release.json').write_text(json.dumps(release,ensure_ascii=False,indent=2));(OUT/'uploads.json').write_text(json.dumps(uploads,indent=2));(OUT/'decisions.json').write_text(json.dumps({'reviewed':decisions,'held_changed_source':held,'merges':proofs},indent=2))
 (ROOT/'src/lib/reviewed-background-merge-20261008.json').write_text(json.dumps(release,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'brands':len(patches),'objects':len(uploads),'canvas_removed':sum(r['canvas_removed'] for r in decisions),'png_only':sum(r['png_only'] for r in decisions),'held_changed_source':held,'merges':len(proofs)}))
if __name__=='__main__':main()

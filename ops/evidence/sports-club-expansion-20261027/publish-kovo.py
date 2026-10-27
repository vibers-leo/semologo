import runpy,json,copy,io,zipfile,hashlib
from pathlib import Path
h=runpy.run_path('/root/ops/kbo-complete-20261027/publish-helpers.py');globals().update({k:v for k,v in h.items() if not k.startswith('__')});B=Path('/root/ops/sports-expansion-20261027');A=json.loads((B/'kovo-selected.json').read_text());C=json.loads((B/'kovo-clubs.json').read_text())['payload'];M={'1001':'kaljumbos','1005':'hyundai-capital-skywalkers','1009':'wooriwon-volleyball','1004':'kbstarsvc','1006':'kepco-vixtorm','1008':'okfinancialsports','1002':'samsung-fire-bluefangs','2005':'gsvolleyball','2002':'korea-expressway-hi-pass','2001':'hillstatehdec','2004':'pinkspiders','2006':'sportsibk','2003':'kgc','2008':'aipeppers'};receipts=[]
for club in C:
 code=club['tcode'];ident=M[code];old=p['current'](c['node'],ident);assert old;(B/(ident+'-before-kovo.json')).write_text(json.dumps(old,ensure_ascii=False,indent=2));mf=copy.deepcopy((old['asset_manifest']or{}).get('variants')or json.loads(p['get'](s,'_clients/'+ident+'/variants.json')or b'{"schema":1,"variants":[]}'));vs=mf.get('variants',[]);keys={v['key']for v in vs};added=[];merged=[];selected=[a for a in A if a['tcode']==code];page='https://'+club['hostname']
 # Preserve selected original source assets without unrelated player photos, uniforms, courts or palettes.
 buf=io.BytesIO()
 with zipfile.ZipFile(buf,'w',compression=zipfile.ZIP_DEFLATED) as z:
  z.writestr('provenance.json',json.dumps(selected,ensure_ascii=False,indent=2))
  for file in sorted(set(a['file']for a in selected)):z.write(B/file,Path(file).name)
 raw=buf.getvalue();zp='sources/official-kovo-20261027/originals-'+sha(raw)[:24]+'.zip';p['put'](s,'_clients/'+ident+'/'+zp,raw,'application/zip',sha)
 svg_hashes={}
 for v in vs:
  file=v.get('files',{}).get('svg')
  if isinstance(file,str):
   body=p['get'](s,'_clients/'+ident+'/'+file)
   if body:svg_hashes[sha(body)]=v
 for a in selected:
  key='official-kovo-20261027-'+a['key']
  if key in keys:continue
  if a['vector']:
   raw=(B/'kovo-selected'/(a['key']+'.svg')).read_bytes();same=svg_hashes.get(sha(raw))
   if same:
    alts=same.setdefault('alts',[])
    if not any(x.get('source_url')==a['url']for x in alts):alts.append({'provider':'KOVO 공식 구단 사이트 · 동일 원본','source_url':a['url'],'source_sha256':sha(raw)})
    merged.append(a['key']);continue
  files={'zip':zp}
  for ext,mime in [('png','image/png')]+([('svg','image/svg+xml')]if a['vector']else[]):
   raw=(B/'kovo-selected'/(a['key']+'.'+ext)).read_bytes()
   if ext=='svg':assert b'<svg'in raw and b'<image'not in raw and b'data:image/'not in raw
   path='sources/official-kovo-20261027/'+sha(raw)[:24]+'.'+ext;p['put'](s,'_clients/'+ident+'/'+path,raw,mime,sha);p['cdn_check'](ident,path,raw);files[ext]=path
  v={'key':key,'label':a['label'],'form':a['form'],'lockup':a['form'],'asset_group':'mascot'if a['form']=='mascot'else'logo','lang':'unknown','color':'white'if a['dark']else'original','light':a['dark'],'files':files,'preview_png':files['png'],'provider':'KOVO 공식 구단 CI 공개 자료','origin':'collected','source_url':a['url'],'official_source_page':a['page'],'review_status':'verified','official_distribution':True,'order':300+len(added),'dimensions':a['selected_size'],'source_note':'2026-10-27 KOVO 공식 구단 명부·구단 코드와 CI 콘텐츠 대조. 원본 PNG의 배경·원래 해상도를 보존하며 SVG가 없는 이미지는 벡터로 표시하지 않음. 동물 사진·선수 사진·유니폼·경기장 안내·색상표는 구성에서 제외.'}
  if a.get('campaign'):v['campaign']=True;v['source_note']+=' 슬로건의 적용 시즌은 미확인.'
  vs.append(v);added.append(key)
 mf.update(schema=1,algo_v=1,id=ident,variants=vs,kovo_reviewed_at=now)
 if not mf.get('primary') and vs:mf['primary']=vs[0]['key']
 payload=old['payload'];patch={'catalog_override':True,'variants_n':len(vs),'official_source_page':payload.get('official_source_page')or page,'kovo_assets_reviewed_at':now,'category':'스포츠','origin':'KR','has_svg':any(v.get('files',{}).get('svg')for v in vs),'has_png':True,'aliases':list(dict.fromkeys((payload.get('aliases')or[])+(payload.get('metadata',{}).get('aliases')or[])))}
 result=commit(ident,old,mf,patch);after=p['current'](c['node'],ident);assert after['payload'].get('presentation')==payload.get('presentation');assert after['payload'].get('hidden')==payload.get('hidden');assert after['payload'].get('metadata',{}).get('hidden')==payload.get('metadata',{}).get('hidden');receipts.append({**result,'tcode':code,'added':len(added),'merged_exact_duplicates':len(merged),'total':len(vs),'representative_preserved':True,'hidden_state_preserved':True});(B/'kovo-receipt.json').write_text(json.dumps(receipts,ensure_ascii=False,indent=2));print(json.dumps(receipts[-1],ensure_ascii=False),flush=True)

import runpy,json,copy,zipfile,io,datetime
from pathlib import Path
h=runpy.run_path('/root/ops/kbo-complete-20261027/publish-helpers.py');globals().update({k:v for k,v in h.items() if not k.startswith('__')});B=Path('/root/ops/sports-expansion-20261027');A=json.loads((B/'kbl-selected.json').read_text());D=json.loads((B/'kbl-downloads.json').read_text());M={'db':('promykbl','promy'),'hd':('phoebuskbl','phoebus'),'kcc':('kccegis','egis'),'kgc':('kgckbl','kgc'),'kt':('sonicboomkbl','sonicboom'),'lg':('sakerskbl','sakers'),'pega':('pegasuskbl','pegasus'),'sk':('sksports','knights'),'sono':('skygunnerskbl','skygunners'),'ss':('thunderskbl','thunders')};receipts=[]
for code,(ident,host) in M.items():
 old=p['current'](c['node'],ident);assert old;(B/(ident+'-before-kbl.json')).write_text(json.dumps(old,ensure_ascii=False,indent=2));mf=copy.deepcopy((old['asset_manifest']or{}).get('variants')or json.loads(p['get'](s,'_clients/'+ident+'/variants.json')or b'{"schema":1,"variants":[]}'));vs=mf.get('variants',[]);keys={v['key']for v in vs};added=[];sourcepage='https://'+host+'.kbl.or.kr/team/emblem';buf=io.BytesIO()
 with zipfile.ZipFile(buf,'w',compression=zipfile.ZIP_DEFLATED) as z:
  originals=[x for x in D if x['code']==code and 'held'not in x];z.writestr('provenance.json',json.dumps(originals,ensure_ascii=False,indent=2))
  for x in originals:z.write(B/x['file'],x['name'])
 raw=buf.getvalue();zp='sources/official-kbl-20261027/originals-'+sha(raw)[:24]+'.zip';p['put'](s,'_clients/'+ident+'/'+zp,raw,'application/zip',sha)
 for a in [x for x in A if x['code']==code]:
  key='official-kbl-20261027-'+a['key']
  if key in keys:continue
  files={'zip':zp}
  for ext,mime in [('png','image/png')]+([('svg','image/svg+xml')]if a['vector']else[]):
   raw=(B/'kbl-selected'/(a['key']+'.'+ext)).read_bytes()
   if ext=='svg':assert b'<image'not in raw and b'data:image/'not in raw
   path='sources/official-kbl-20261027/'+sha(raw)[:24]+'.'+ext;p['put'](s,'_clients/'+ident+'/'+path,raw,mime,sha);p['cdn_check'](ident,path,raw);files[ext]=path
  v={'key':key,'label':a['label'],'form':a['form'],'lockup':a['form'],'asset_group':'mascot'if a['form']=='mascot'else'logo','lang':'unknown','color':'white'if a['dark']else'original','light':a['dark'],'files':files,'preview_png':files['png'],'provider':'KBL 구단 공식 BI 공개 자료','origin':'collected','source_url':a['url'],'official_source_page':sourcepage,'source_member':a['name'],'source_sha256':a['sha256'],'review_status':'verified','official_distribution':True,'historical':a['historical'],'order':200+len(added),'dimensions':a['selected_size'],'source_note':'2026-10-27 KBL 구단 공통 플랫폼의 공식 BI 구성 및 구단 코드 대조. 기본 엠블럼 중복·유니폼·차량 안내는 추가 구성에서 제외. 원본 PNG의 의도된 배경과 원래 해상도 보존. PNG 전용 자료는 SVG로 표시하지 않음.'}
  if 'FANTASTIC' in a['label'] or 'ONE TEAM' in a['label']:v['campaign']=True;v['source_note']+=' 슬로건 적용 시즌은 미확인.'
  vs.append(v);added.append(key)
 mf.update(schema=1,algo_v=1,id=ident,variants=vs,kbl_reviewed_at=now)
 if not mf.get('primary'):mf['primary']=vs[0]['key']
 payload=old['payload'];patch={'catalog_override':True,'variants_n':len(vs),'official_source_page':sourcepage,'kbl_assets_reviewed_at':now,'category':'스포츠','origin':'KR','aliases':list(dict.fromkeys((payload.get('aliases')or[])+(payload.get('metadata',{}).get('aliases')or[]))), 'has_svg':any(v.get('files',{}).get('svg')for v in vs),'has_png':True}
 result=commit(ident,old,mf,patch);after=p['current'](c['node'],ident);assert after['payload'].get('presentation')==payload.get('presentation');receipts.append({**result,'code':code,'added':len(added),'total':len(vs),'representative_preserved':True});(B/'kbl-receipt.json').write_text(json.dumps(receipts,ensure_ascii=False,indent=2));print(json.dumps(receipts[-1],ensure_ascii=False),flush=True)

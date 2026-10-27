import runpy,json,copy,io,zipfile
from pathlib import Path
h=runpy.run_path('/root/ops/kbo-complete-20261027/publish-helpers.py');globals().update({k:v for k,v in h.items()if not k.startswith('__')});B=Path('/root/ops/sports-expansion-20261027/football-followup');A=json.loads((B/'kleague-selected.json').read_text());D=json.loads((B/'kleague-packages.json').read_text());M={'K27':'fcanyang','K09':'fcseoul','K18':'incheonutd'};receipts=[]
for code,ident in M.items():
 old=p['current'](c['node'],ident);assert old;(B/(ident+'-before-kleague.json')).write_text(json.dumps(old,ensure_ascii=False,indent=2));mf=copy.deepcopy((old['asset_manifest']or{}).get('variants')or json.loads(p['get'](s,'_clients/'+ident+'/variants.json')or b'{"schema":1,"variants":[]}'));vs=mf.get('variants',[]);keys={v['key']for v in vs};selected=[a for a in A if a['team']==code];added=[];buf=io.BytesIO()
 with zipfile.ZipFile(buf,'w',compression=zipfile.ZIP_DEFLATED) as z:
  originals=[x for x in D if x['team']==code and 'file'in x];z.writestr('provenance.json',json.dumps({'packages':originals,'selected':selected},ensure_ascii=False,indent=2))
  files=set(x['file']for x in originals)|set(x['file']for x in selected if'kleague-mascot-originals/'in x.get('file',''))
  for f in sorted(files):z.write(B/f,Path(f).name)
 raw=buf.getvalue();zp='sources/official-kleague-20261027/originals-'+sha(raw)[:24]+'.zip';p['put'](s,'_clients/'+ident+'/'+zp,raw,'application/zip',sha)
 for a in selected:
  key='official-kleague-20261027-'+a['key']
  if key in keys:continue
  files={'zip':zp}
  for ext,mime in [('png','image/png')]+([('svg','image/svg+xml')]if a['vector']else[]):
   raw=(B/'kleague-selected'/(a['key']+'.'+ext)).read_bytes()
   if ext=='svg':assert b'<svg'in raw and b'<image'not in raw and b'data:image/'not in raw
   path='sources/official-kleague-20261027/'+sha(raw)[:24]+'.'+ext;p['put'](s,'_clients/'+ident+'/'+path,raw,mime,sha);p['cdn_check'](ident,path,raw);files[ext]=path
  v={'key':key,'label':a['label'],'form':a['form'],'lockup':a['form'],'asset_group':'mascot'if a['form']=='mascot'else'logo','lang':'unknown','color':'white'if a['dark']else'original','light':a['dark'],'files':files,'preview_png':files['png'],'provider':'구단 공식 BI 공개 자료','origin':'collected','source_url':a['url'],'official_source_page':a['page'],'source_member':a.get('member',Path(a['file']).name),'source_sha256':a.get('source_sha256',a.get('sha256')),'review_status':'verified','official_distribution':True,'historical':a['historical'],'order':400+len(added),'dimensions':a['selected_size'],'source_note':'2026-10-27 K리그 공식 구단 명부와 구단 배포 자료 대조. 안내문·색상표·이벤트 사진을 제외하고 여백을 정리. AI 내 실제 벡터만 SVG 제공. 공식 래스터 이미지의 원래 배경과 해상도 보존. 같은 구성의 PNG/AI 및 통합 AI 중복은 추가 구성에서 제외.'}
  if '슬로건'in a['label']:v['campaign']=True;v['source_note']+=' 슬로건 적용 시즌 미확인.'
  vs.append(v);added.append(key)
 mf.update(schema=1,algo_v=1,id=ident,variants=vs,kleague_reviewed_at=now)
 if not mf.get('primary')and vs:mf['primary']=vs[0]['key']
 payload=old['payload'];patch={'catalog_override':True,'variants_n':len(vs),'kleague_assets_reviewed_at':now,'category':'스포츠','origin':'KR','has_svg':any(v.get('files',{}).get('svg')for v in vs),'has_png':True,'aliases':list(dict.fromkeys((payload.get('aliases')or[])+(payload.get('metadata',{}).get('aliases')or[])))}
 result=commit(ident,old,mf,patch);after=p['current'](c['node'],ident);assert after['payload'].get('presentation')==payload.get('presentation');assert after['payload'].get('hidden')==payload.get('hidden');assert after['payload'].get('metadata',{}).get('hidden')==payload.get('metadata',{}).get('hidden');receipts.append({**result,'team':code,'added':len(added),'total':len(vs),'representative_preserved':True,'hidden_state_preserved':True});(B/'kleague-receipt.json').write_text(json.dumps(receipts,ensure_ascii=False,indent=2));print(json.dumps(receipts[-1],ensure_ascii=False),flush=True)

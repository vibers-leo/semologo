import runpy,json,copy,io,zipfile,hashlib,datetime
from pathlib import Path
h=runpy.run_path('/root/ops/kbo-complete-20261027/publish-helpers.py');globals().update({k:v for k,v in h.items() if not k.startswith('__')});B=Path('/root/ops/sports-expansion-20261027');selected=json.loads((B/'selected.json').read_text());receipts=[]
for team,ident,ko,en,website in [('jeonbuk','jeonbuk-fc','전북 현대 모터스','Jeonbuk Hyundai Motors','https://hyundai-motorsfc.com/club'),('pohang','steelers','포항 스틸러스','Pohang Steelers','https://www.steelers.co.kr/club/emblem')]:
 old=p['current'](c['node'],ident);assert old;(B/(ident+'-before.json')).write_text(json.dumps(old,ensure_ascii=False,indent=2));mf=copy.deepcopy((old['asset_manifest']or{}).get('variants')or json.loads(p['get'](s,'_clients/'+ident+'/variants.json')or b'{"schema":1,"variants":[]}'));variants=mf.get('variants',[]);keys={v['key']for v in variants};added=[]
 if team=='jeonbuk':
  # Existing logo was visually matched to the club's 2013 history image. Preserve its native SVG.
  raw=(B/'jeonbuk-existing.png').read_bytes();path='sources/official-sports-20261027/'+sha(raw)[:24]+'.png';p['put'](s,'_clients/'+ident+'/'+path,raw,'image/png',sha);p['cdn_check'](ident,path,raw)
  legacy=next((v for v in variants if v.get('files',{}).get('svg')=='logo.svg'),None)
  if not legacy:legacy={'key':'preserved-legacy-2013','files':{'svg':'logo.svg'}};variants.append(legacy) # gitleaks:allow — public variant identifier
  legacy.update(label='역대 BI · 2013형 · 기존 보유 벡터',form='emblem',lockup='emblem',historical=True,preview_png=path,provider='기존 보유 벡터 · 공식 구단 연혁 대조',source_url='https://hyundai-motorsfc.com/club',review_status='verified');legacy['files']['png']=path
 buf=io.BytesIO();source_rows=[a for a in selected if a['team']==team]
 with zipfile.ZipFile(buf,'w',compression=zipfile.ZIP_DEFLATED) as z:
  z.writestr('provenance.json',json.dumps(source_rows,ensure_ascii=False,indent=2))
  paths=sorted(set(a['package'] for a in source_rows if a.get('package')))
  if team=='jeonbuk':paths+=sorted(set(a['file'] for a in json.loads((B/'jeonbuk-png.json').read_text())))
  for f in paths:z.write(B/f,Path(f).name)
 archive=buf.getvalue();zp='sources/official-sports-20261027/originals-'+sha(archive)[:24]+'.zip';p['put'](s,'_clients/'+ident+'/'+zp,archive,'application/zip',sha)
 for a in source_rows:
  if team=='jeonbuk' and a['member'].startswith('emblem_2013.'):continue
  key='official-sports-20261027-'+a['key']
  if key in keys:continue
  files={'zip':zp}
  for ext,mime in [('png','image/png')]+([('svg','image/svg+xml')]if a['vector']else[]):
   raw=(B/'selected'/(a['key']+'.'+ext)).read_bytes()
   if ext=='svg':assert b'<image' not in raw and b'data:image/' not in raw
   path='sources/official-sports-20261027/'+sha(raw)[:24]+'.'+ext;p['put'](s,'_clients/'+ident+'/'+path,raw,mime,sha);p['cdn_check'](ident,path,raw);files[ext]=path
  v={'key':key,'label':a['label'],'form':a['form'],'lockup':a['form'],'asset_group':'mascot' if a['form']=='mascot' else 'logo','lang':'unknown','color':'white' if a['dark']else'original','light':a['dark'],'files':files,'preview_png':files['png'],'provider':'구단 공식 BI 공개 자료','origin':'collected','source_url':a['source_url'],'official_source_page':a['source_page'],'source_member':a['member'],'source_sha256':a['source_sha256'],'review_status':'verified','official_distribution':True,'historical':a['historical'],'order':100+len(added),'dimensions':a['size'],'source_note':'2026-10-27 공식 구단 페이지 및 직접 배포 파일 확인. 연혁 도안의 연도는 공식 페이지 파일 표기 기준. 내부에 래스터가 포함된 AI 도안은 PNG로만 제공. 원본 패키지는 ZIP에 보존.'}
  variants.append(v);added.append(key)
 mf.update(schema=1,algo_v=1,id=ident,variants=variants,official_sports_reviewed_at=now)
 patch={'catalog_override':True,'name_ko':ko,'name_en':en,'category':'스포츠','origin':'KR','website':website,'official_source_page':website,'variants_n':len(variants),'has_svg':True,'has_png':True,'aliases':list(dict.fromkeys((old['payload'].get('aliases')or[])+[ko,en,ident,'K리그','축구']))}
 if team=='jeonbuk' and not old['payload'].get('presentation') and not old['payload'].get('presentation_locked'):
  v=next(v for v in variants if v['key'] in added and v['label']=='공식 기본 컬러 엠블럼');patch.update(logo_svg=v['files']['svg'],svg_transparent=v['files']['svg'],logo_png=v['files']['png'],preview_png='https://logo.vibers.co.kr/_clients/'+ident+'/'+v['files']['png'],presentation={'file':v['files']['png'],'svgFile':v['files']['svg'],'bg':'light'},asset_review_status='verified',logo_published_at=now);mf['primary']=v['key']
 elif not mf.get('primary'):mf['primary']=variants[0]['key']
 result=commit(ident,old,mf,patch);receipts.append({**result,'added':len(added),'total':len(variants),'representative_preserved':team!='jeonbuk' or bool(old['payload'].get('presentation')),'canonical_reused':True});(B/'receipt.json').write_text(json.dumps(receipts,ensure_ascii=False,indent=2));print(json.dumps(receipts[-1],ensure_ascii=False),flush=True)

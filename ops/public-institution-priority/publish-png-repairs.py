"""Publish visually reviewed unchanged first-party transparent PNG replacements."""
import hashlib,io,json,runpy,subprocess,sys
from pathlib import Path
from urllib.parse import urlsplit
from PIL import Image
BASE=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(__file__).resolve().parent
runner=runpy.run_path('/root/projects/semologo-publisher/run.py');runner['credentials']()
core=runpy.run_path('/root/projects/semologo-publisher/scripts/fleet-auto-core.py')
publish=runpy.run_path('/root/projects/semologo-publisher/scripts/fleet-auto-publish.py')
s3=core['s3_client']();sha=lambda raw:hashlib.sha256(raw).hexdigest()
plan=json.loads((BASE/'reviewed-png-plan.json').read_text())
receipts=[]
for entry in plan:
 assert entry['identity_reviewed'] and (entry.get('visual_reviewed') or entry.get('ocr_reviewed'))
 ident=entry['id'];raw=(BASE/'reviewed-png'/entry['filename']).read_bytes()
 manual=entry.get('visual_reviewed') is True
 method='기관 동일성·밝은/어두운 배경 시각 검수' if manual else '공식 기관명 전체 한글·영문 OCR 일치 및 투명도 확인'
 vector=entry.get('svg_filename')
 if vector:method='공식 AI·PDF 벡터의 해당 조합형 추출 및 시각 검수'
 assert sha(raw)==entry['sha256']
 try:
  live=subprocess.check_output(['curl','-fsSL','--max-time','30','--max-redirs','8',
   '-A','Mozilla/5.0','-e',entry['sourcePage'],entry['sourceUrl']],stderr=subprocess.DEVNULL)
 except subprocess.CalledProcessError:
  receipts.append({'id':ident,'status':'held','reason':'official-source-recheck-unavailable'})
  (BASE/'png-repair-receipts.json').write_text(json.dumps(receipts,ensure_ascii=False,indent=2))
  continue
 proof=(BASE/entry['original_filename']).read_bytes() if vector else raw
 if vector:assert sha(proof)==entry['source_original_sha256']
 assert live==proof,'Official source changed: '+ident
 image=Image.open(io.BytesIO(raw));image.load()
 assert image.format=='PNG' and image.convert('RGBA').getchannel('A').getextrema()[0]==0
 assert publish['png_surface'](raw)['transparent'],'Opaque candidate '+ident
 old=publish['current'](core['node'],ident);assert old,'Existing identity required'
 payload=old['payload'];assert payload['name_ko']==entry['name']
 assert not payload.get('hidden') and not payload.get('merged_into')
 selected=(payload.get('presentation') or {}).get('file') or payload.get('logo_png') or 'logo.png'
 newfile='sources/official-transparent-20261025/'+sha(raw)[:20]+'.png'
 if selected==newfile:
  manifest=(old.get('asset_manifest') or {}).get('variants')
  if manifest:publish['put'](s3,'_clients/'+ident+'/variants.json',(json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+'\n').encode(),'application/json',sha,True)
  receipts.append({'id':ident,'status':'already-applied'});continue
 original=publish['get'](s3,'_clients/'+ident+'/'+selected)
 assert original,'Current asset missing: '+ident
 oldimage=Image.open(io.BytesIO(original)).convert('RGBA')
 box=oldimage.getchannel('A').getbbox();cropped=io.BytesIO()
 oldimage.crop(box).save(cropped,format='PNG')
 crop=oldimage.crop(box);w,h=crop.size
 edge=[crop.getpixel((x,y)) for y in [0,h-1] for x in range(w)]+[crop.getpixel((x,y)) for x in [0,w-1] for y in range(h)]
 nearwhite=sum(p[3]>=250 and min(p[:3])>=245 for p in edge)/len(edge)>=.97
 assert publish['png_surface'](original)['white_canvas'] or publish['png_surface'](cropped.getvalue())['white_canvas'] or nearwhite or (manual and vector and entry.get('vector_upgrade')),'Current asset is not white: '+ident
 publish['put'](s3,'_clients/'+ident+'/'+newfile,raw,'image/png',sha)
 publish['cdn_check'](ident,newfile,raw)
 source={'provider':'official-site','file':newfile,'source_url':entry['sourceUrl'],
  'official_source_page':entry['sourcePage'],'sha256':sha(raw),'width':image.width,'height':image.height,
  'label':'공식 투명 PNG · '+method}
 patch={'logo_png':newfile,'preview_png':'https://logo.vibers.co.kr/_clients/'+ident+'/'+newfile,
  'has_png':True,'presentation':{'file':newfile,'bg':'dark' if publish['light_artwork'](raw) else 'light'},
  'presentation_locked':True,'dark_png':None,'official_source_page':entry['sourcePage'],
  'light':publish['light_artwork'](raw),'light_logo':publish['light_artwork'](raw),
  'dark_variant':'white' if publish['light_artwork'](raw) else 'transparent',
  'quality_hold':False,'quality_replacement':False,
  'sources':(payload.get('sources') or [])+[source],'asset_review_status':('verified' if manual else 'auto-screened')+'-first-party-transparent-png',
  'asset_origin':'공식 홈페이지 투명 PNG 원본 · '+method+' · '+str(image.width)+'×'+str(image.height)}
 if vector:
  import xml.etree.ElementTree as E
  svg=(BASE/vector).read_bytes();assert sha(svg)==entry['svg_sha256'];root=E.fromstring(svg)
  assert not any(e.tag.split('}')[-1] in ('image','script','foreignObject') for e in root.iter())
  assert not any(not v.startswith('#') for e in root.iter() for k,v in e.attrib.items() if k.split('}')[-1]=='href')
  svgfile=newfile[:-4]+'.svg';zipfile='sources/official-ai-20261025/'+sha(proof)[:20]+'.zip'
  for path,body,mime in [(svgfile,svg,'image/svg+xml'),(zipfile,proof,'application/zip')]:
   publish['put'](s3,'_clients/'+ident+'/'+path,body,mime,sha);publish['cdn_check'](ident,path,body)
  patch.update(has_svg=True,logo_svg=svgfile,svg_transparent=svgfile,source_zip=zipfile,
    source_original_label='공식 AI·PDF 원본 ZIP',asset_review_status='verified-official-native-vector')
  patch['presentation']['svgFile']=svgfile
 if not payload.get('website'):patch['website']=entry['sourcePage']
 if not payload.get('domain'):patch['domain']=urlsplit(entry['sourcePage']).hostname.removeprefix('www.')
 variant={'schema':1,'id':ident,'primary':'official-transparent','variants':[
  {'key':'official-transparent','form':'horizontal','lockup':'horizontal','lang':'ko',
   'color':'reverse' if patch['presentation']['bg']=='dark' else 'original','label':'공식 투명 PNG',
   'files':{'png':newfile},'preview_png':newfile,'source_url':entry['sourceUrl'],
   'source_sha256':sha(raw),'visual_sha256':sha(raw),'review_status':'verified' if manual else 'auto-screened','order':0}]}
 if vector:variant['variants'][0]['files']['svg']=svgfile
 vote=subprocess.check_output(['curl','-sSL','--max-time','15','-w','\n%{http_code}',
  'https://firestore.googleapis.com/v1/projects/ai-recipe-lab/databases/(default)/documents/logo_quality/'+ident])
 body,_,status=vote.rpartition(b'\n');assert status in (b'200',b'404'),'Vote read unavailable'
 fields=json.loads(body).get('fields',{}) if status==b'200' else {}
 down=int(fields.get('down',{}).get('integerValue','0'))
 data={'id':ident,'before':payload,'patch':patch,'oldManifest':old['asset_manifest'],'variant':variant,
  'review':{'status':'repaired','down_at_review':down,'reason':'공식 사이트 투명 PNG로 흰 배경 교체; '+method,
   'reviewed_at':'2026-10-25','source_url':entry['sourceUrl'],'preview_file':newfile,'vector_followup':True,
   'method':method,'ocr':entry.get('ocr')},'vote':fields}
 (BASE/('before-'+ident+'-'+sha(raw)[:12]+'.json')).write_text(json.dumps(old,ensure_ascii=False,indent=2))
 code='const x='+json.dumps(data,ensure_ascii=False)+';'+r'''const{Pool}=require('pg');const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});(async()=>{const c=await p.connect();try{await c.query('BEGIN');const b=await c.query('SELECT payload FROM semologo.logo_posts WHERE id=$1 FOR UPDATE',[x.id]);if(b.rowCount!==1||JSON.stringify(b.rows[0].payload)!==JSON.stringify(x.before))throw Error('Concurrent source change');await c.query('UPDATE semologo.logo_posts SET payload=payload||$2::jsonb,updated_at=now() WHERE id=$1',[x.id,JSON.stringify(x.patch)]);const v=await c.query('SELECT id FROM semologo.logo_versions WHERE brand_id=$1 AND is_current FOR UPDATE',[x.id]);if(v.rowCount!==1)throw Error('Current version missing');await c.query("UPDATE semologo.logo_versions SET asset_manifest=$2::jsonb,review_status='verified',verified_at=now(),source_url=$3 WHERE id=$1",[v.rows[0].id,JSON.stringify({variants:x.variant,archived_white_background_manifest:x.oldManifest}),x.patch.official_source_page]);await c.query("INSERT INTO semologo.logo_quality_reviews(brand_id,status,review,vote_snapshot) VALUES($1,'repaired',$2::jsonb,$3::jsonb) ON CONFLICT(brand_id) DO UPDATE SET status='repaired',review=excluded.review,vote_snapshot=excluded.vote_snapshot,reviewed_at=now()",[x.id,JSON.stringify(x.review),JSON.stringify(x.vote)]);await c.query('COMMIT');console.log(JSON.stringify({id:x.id,status:'transparent-replacement-published',file:x.patch.logo_png}))}catch(e){await c.query('ROLLBACK');throw e}finally{c.release();await p.end()}})().catch(e=>{console.error(e.message);process.exit(1)})'''
 result=core['node']('semologo',code)
 publish['put'](s3,'_clients/'+ident+'/variants.json',(json.dumps(variant,ensure_ascii=False,separators=(',',':'))+'\n').encode(),'application/json',sha,True)
 receipts.append({**result,'source':entry['sourceUrl'],'sha256':sha(raw),'dimensions':image.size})
 (BASE/'png-repair-receipts.json').write_text(json.dumps(receipts,ensure_ascii=False,indent=2))
 print(json.dumps(receipts[-1],ensure_ascii=False),flush=True)

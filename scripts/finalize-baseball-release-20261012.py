from pathlib import Path
import json,subprocess,hashlib,datetime
R=Path(__file__).resolve().parents[1];D=R/'marketing/assets/baseball-official-20261012';O=D/'release-png';release={'patches':{},'variants':{}};uploads=[]
id='yokohama-dena-baystars';r=subprocess.run(['curl','--http1.1','-fsSL','--retry','2','--max-time','30','https://logo.vibers.co.kr/_clients/'+id+'/variants.json'],capture_output=True,check=True);m=json.loads(r.stdout);p=D/'kbo/DB.png';raw=p.read_bytes();sha=hashlib.sha256(raw).hexdigest();file='sources/official-baseball-20261012/'+sha[:20]+'.png';uploads.append({'id':id,'file':str(p.relative_to(R)),'key':'_clients/'+id+'/'+file,'sha256':sha});m['variants'].append({'key':'official-baystars-20261012','label':'구단 공식 엠블럼 PNG · 원본 290×274','form':'symbol','lang':'en','color':'original','files':{'png':file},'origin':'official','source_url':'https://asset.baystars.co.jp/images/common/logo.png','order':len(m['variants'])});release['variants'][id]=m;release['patches'][id]={'variants_n':len(m['variants']),'logo_published_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'aliases':['요코하마 DeNA 베이스타스','Yokohama DeNA BayStars','NPB','일본 프로야구']};(O/'release.json').write_text(json.dumps(release,ensure_ascii=False,indent=2)+'\n');(O/'uploads.json').write_text(json.dumps(uploads,indent=2)+'\n')
all={'patches':{},'variants':{}}
for f in ['release','release-next','release-png']:
 d=json.loads((D/f/'release.json').read_text())
 for k in all:all[k].update(d[k])
(R/'src/lib/reviewed-baseball-20261012.json').write_text(json.dumps(all,ensure_ascii=False,indent=2)+'\n')
p=R/'src/lib/reviewed-logo-assets.ts';s=p.read_text();a="import identityMerges from './reviewed-identity-merges-20261012.json';";assert a in s;s=s if "import baseballRelease from" in s else s.replace(a,a+"\nimport baseballRelease from './reviewed-baseball-20261012.json';");s=s if 'identityMerges.patches, baseballRelease.patches' in s else s.replace('suppliedIdentities.patches, identityMerges.patches','suppliedIdentities.patches, identityMerges.patches, baseballRelease.patches');a='  ...identityMerges.variants as unknown as Record<string, VariantManifest>,';assert a in s;s=s if '...baseballRelease.variants' in s else s.replace(a,a+'\n  ...baseballRelease.variants as unknown as Record<string, VariantManifest>,');p.write_text(s)
proof=json.loads((D/'release/identity-proof.json').read_text());npb=[]
for id,p in json.loads((D/'release-next/release.json').read_text())['patches'].items():
 if id=='ssglanders':continue
 v=all['variants'][id]['variants'][-1];npb.append({'name':p['aliases'][0],'brand_id':id,'identity_reviewed':True,'png_verified':True,'png_file':v['files']['png']})
npb.append({'name':'요코하마 DeNA 베이스타스','brand_id':'yokohama-dena-baystars','identity_reviewed':True,'png_verified':True,'png_file':file})
collections=[]
for country,league,members,url in [('us','mlb',proof,'https://www.mlb.com/team'),('jp','npb',npb,'https://npb.jp/teams/')]:
 for v in members:v['member_key']=hashlib.sha256(v['brand_id'].encode()).hexdigest()[:20]
 collections.append({'id':f'sports-{country}-{league}-2026','name':league.upper()+' 2026 구단','country':country.upper(),'sector':'sports','sport':'baseball','league':league.upper(),'season':'2026','roster_status':'official','scope_note':'공식 명부와 대조한 현역 구단. 로고 제작 시기와 명부 기준연도는 별개.','as_of':'2026-10-12','source_kind':'official','source_url':url,'source_revision':'checked-20261012','count_unit':'entity','total':len(members),'verified':len(members),'members':members})
(D/'coverage.json').write_text(json.dumps({'checked_at':'2026-10-12','collections':collections},ensure_ascii=False,indent=2)+'\n');print('PREPARED',len(all['variants']),'brands',sum(len(v['variants'])for v in all['variants'].values()),'total retained variants')

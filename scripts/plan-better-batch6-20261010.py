"""Identity decisions for all 120 frozen names; no automatic same-name merges."""
from pathlib import Path
import json,re,urllib.request,concurrent.futures,html
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'marketing/assets/figma-better-batch6-20261010';SRC=ROOT/'marketing/assets/figma-better-collection-20261010'
existing={'LendUp':'lendup','Maqeta':'marqeta','Medium':'medium','MIT':'massachusetts-institute-of-technology','Mural':'mural','NASA':'nasa','Nerdwallet':'nerdwallet-com','Nextdoor':'nextdoor','Northflank':'northflank','Polywork':'polywork','Quip':'quip','Revue':'revue','Shopify':'shopify','Stack Overflow':'stack-overflow','Stanford':'stanford-university','Stoke Space':'stoke-space','SuperHi':'superhi','Teleport':'teleport','The Weather Channel':'theweatherchannel','Thrive Capital':'thrive-capital','Tiger Global':'tigerglobal','UserTesting':'user-testing','Toll':'toll-brothers','PulteGroup':'pulte-homes','Travelers':'the-travelers-companies','Oscar Insurance':'oscar-health-1'}
# Each URL identifies the company, not an assertion that the exported artwork is current.
new={
'Lakestar Advisors':('lakestar','https://lakestar.com/','금융·결제'),
'LegalZoom':('legalzoom','https://www.legalzoom.com/','서비스·기업'),
'Little Spoon':('little-spoon','https://www.littlespoon.com/','식품·음료'),
'Lose It!':('lose-it','https://www.loseit.com/','의료·바이오'),
'Meter':('meter-networking','https://www.meter.com/','IT·테크'),
'Modern Treasury':('modern-treasury','https://www.moderntreasury.com/','금융·결제'),
'MoonPay':('moonpay','https://www.moonpay.com/','금융·결제'),
'Mosaic Building Group':('mosaic-building-group','https://www.mosaic.us/','서비스·기업'),
'MoveSpring':('movespring','https://movespring.com/','의료·바이오'),
'N49P':('n49p','https://www.n49p.com/','금융·결제'),
'Nearpod':('nearpod','https://nearpod.com/','교육'),
'NewView Capital':('newview-capital','https://www.nvc.vc/','금융·결제'),
'Night Ventures':('night-ventures','https://www.nightventures.com/','금융·결제'),
'Northeastern University':('northeastern-university','https://www.northeastern.edu/','교육'),
'Nova Credit':('nova-credit','https://www.novacredit.com/','금융·결제'),
'NUGGS':('nuggs','https://simulate.com/','식품·음료'),
'Octant Bio':('octant-bio','https://www.octant.bio/','의료·바이오'),
'ODEKO':('odeko','https://www.odeko.com/','IT·테크'),
'Opendoor':('opendoor','https://www.opendoor.com/','서비스·기업'),
'OpenSpace':('openspace-ai','https://www.openspace.ai/','IT·테크'),
'Osedea':('osedea','https://www.osedea.com/','IT·테크'),
'Outdoor Voices':('outdoor-voices','https://www.outdoorvoices.com/','유통·쇼핑'),
'Outsystems':('outsystems','https://www.outsystems.com/','IT·테크'),
'Owner':('owner-com','https://www.owner.com/','IT·테크'),
'Pie Insurance':('pie-insurance','https://www.pieinsurance.com/','금융·결제'),
'Pipe':('pipe-fintech','https://pipe.com/','금융·결제'),
'Public.com':('public-com','https://public.com/','금융·결제'),
'Qapital':('qapital','https://www.qapital.com/','금융·결제'),
'Qatalog':('qatalog','https://qatalog.com/','IT·테크'),
'QED Investors':('qed-investors','https://www.qedinvestors.com/','금융·결제'),
'Quiet Capital':('quiet-capital','https://www.quiet.com/','금융·결제'),
'Remix':('remix-by-via','https://ridewithvia.com/remix/','IT·테크'),
'Replicant':('replicant-ai','https://www.replicant.com/','IT·테크'),
'Rocketplace':('rocketplace','https://www.rocketplace.com/','금융·결제'),
'Roofr':('roofr','https://roofr.com/','IT·테크'),
'Routable':('routable','https://www.routable.com/','금융·결제'),
'Routific':('routific','https://www.routific.com/','IT·테크'),
'Safely':('safely-insurance','https://safely.com/','금융·결제'),
'Scratch':('scratchpay','https://scratchpay.com/','금융·결제'),
'Shuttlerock':('shuttlerock','https://www.shuttlerock.com/','IT·테크'),
'SignalFire':('signalfire','https://www.signalfire.com/','금융·결제'),
'Simulate':('simulate-foods','https://simulate.com/','식품·음료'),
'Stanford Graduate School of Business':('stanford-graduate-school-of-business','https://www.gsb.stanford.edu/','교육'),
'Starface':('starface','https://starface.world/','유통·쇼핑'),
'Step':('step-fintech','https://step.com/','금융·결제'),
'Superhuman':('superhuman-email','https://superhuman.com/','IT·테크'),
'TakeShape':('takeshape','https://www.takeshape.io/','IT·테크'),
'Tella':('tella','https://www.tella.tv/','IT·테크'),
'Tenovos':('tenovos','https://tenovos.com/','IT·테크'),
'Terminal':('terminal-io','https://www.terminal.io/','IT·테크'),
'Tractor Supply Company':('tractor-supply-company','https://www.tractorsupply.com/','유통·쇼핑'),
'Treasury Prime':('treasury-prime','https://www.treasuryprime.com/','금융·결제'),
'Trinity Ventures':('trinity-ventures','https://www.trinityventures.com/','금융·결제'),
'True Link':('true-link-financial','https://www.truelinkfinancial.com/','금융·결제'),
'Underscore VC':('underscore-vc','https://underscore.vc/','금융·결제'),
'University of Winchester':('university-of-winchester','https://www.winchester.ac.uk/','교육'),
'Uploadcare':('uploadcare','https://uploadcare.com/','IT·테크'),
'ustwo':('ustwo','https://ustwo.com/','IT·테크'),
'Vanta':('vanta','https://www.vanta.com/','IT·테크'),
'Vergesense':('vergesense','https://www.vergesense.com/','IT·테크'),
'Vestwell':('vestwell','https://www.vestwell.com/','금융·결제'),
'Vise':('vise','https://www.vise.com/','금융·결제'),
'VMG':('vmg-partners','https://www.vmgpartners.com/','금융·결제'),
'WestCap':('westcap','https://www.westcap.com/','금융·결제'),
'Wethos':('wethos','https://www.wethos.co/','IT·테크'),
'Wheel':('wheel-health','https://www.wheel.com/','의료·바이오'),
'Workpath':('workpath','https://www.workpath.com/','IT·테크'),
'xentral':('xentral','https://xentral.com/','IT·테크'),
'Zoopla':('zoopla','https://www.zoopla.co.uk/','서비스·기업')}
members=json.loads((SRC/'batch6-ownership.json').read_text())['members']
def check(item):
 name,(id,url,category)=item
 try:
  req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'});r=urllib.request.urlopen(req,timeout=18);raw=r.read(3000000).decode('utf-8','replace');title=re.search(r'<title[^>]*>(.*?)</title>',raw,re.S|re.I);title=html.unescape(re.sub('<[^>]+>','',title.group(1))).strip() if title else '';text=re.sub('<[^>]+>',' ',raw);needle=re.sub('[^a-z0-9]','',name.lower());hay=re.sub('[^a-z0-9]','',text.lower());words=[w.lower() for w in re.findall('[A-Za-z]{4,}',name)];matched=needle in hay or any(w in text.lower() for w in words);return name,dict(id=id,url=url,final_url=r.url,title=title,matched_name=matched,http_status=r.status,category=category)
 except Exception as e:return name,dict(id=id,url=url,category=category,error=type(e).__name__)
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:evidence=dict(pool.map(check,new.items()))
for name,url in json.loads((OUT/'manual-web-evidence.json').read_text()).items():evidence[name].update(matched_name=True,primary_source_manually_verified=url)
(OUT/'new-identity-web-evidence.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+'\n');decisions=[]
for m in members:
 name=m['name'];row={**m,'status':'held','reason':'기관 신원·동명이인 및 실제 브랜드 조합 추가 검증 필요'}
 if name in existing:row.update(id=existing[name],existing=True,status='approved-identity',reason='기존 로고와 커뮤니티 워드마크·기업 실체 비교. 대표 보존, 시기 미확인 변형 추가')
 elif name in new:
  ev=evidence[name];row.update(id=ev['id'],existing=False,website=ev['url'],category=ev['category'],web_evidence=ev)
  if any(f.endswith('.svg') for f in m['files']) and ev.get('matched_name'):row.update(status='approved-identity',reason='공식 사이트에서 회사 실체 확인, 원본 워드마크 시각 검수. 커뮤니티 시기 미확인 SVG 신규 후보')
  else:row['reason']='공식 사이트 신원 조회 실패 또는 PNG-only 신규: 추가 검증 보류'
 if name=='Vector':row['reason']='파일명 오표기: 실제 Square 로고. Vector에 연결 금지; 전반 Square 담당과 중복 조정'
 if name=='Toll':row['reason']='실제 Toll Brothers 로고, 물류 Toll과 분리해 기존 toll-brothers로만 추가'
 if name=='PulteGroup':row['reason']='실제 Pulte Homes 브랜드, 모회사 PulteGroup으로 오연결하지 않고 기존 pulte-homes로 추가'
 if name=='Maqeta':row['reason']='파일명 오타, 실제 Marqeta 워드마크 및 기존 marqeta 심볼 동일성 확인'
 if name in ['Magneto','Replicant','Scratch','Step','Terminal','Meter','Remix']:row['collision_note']='동명 기존 로고가 다른 회사/제품인 것을 시각 확인. 기존 동명ID에 합치지 않음.'
 decisions.append(row)
(OUT/'decisions.json').write_text(json.dumps(decisions,ensure_ascii=False,indent=2)+'\n');print('Frozen120; identity approved',sum(r['status']=='approved-identity' for r in decisions),'held',sum(r['status']=='held' for r in decisions))

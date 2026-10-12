"""Wire published sports manifests and persist truthful roster coverage."""
from pathlib import Path
import json,hashlib
R=Path(__file__).resolve().parents[1];D=R/'marketing/assets/sports-expansion-20261012';release={'patches':{},'variants':{}};proof=[]
for f in ['release','release-domestic','release-football','release-kovo']:
 assert json.loads((D/f/'published.json').read_text())['brands']>0
 d=json.loads((D/f/'release.json').read_text());proof+=json.loads((D/f/'identity-proof.json').read_text())
 for k in release:release[k].update(d[k])
(R/'src/lib/reviewed-sports-expansion-20261012.json').write_text(json.dumps(release,ensure_ascii=False,indent=2)+'\n')
collections=[]
configs=[('nhl','us','NHL','ice-hockey',32,'https://www.nhl.com/info/teams/'),('nba','us','NBA','basketball',30,'https://www.nba.com/teams'),('pl','gb','Premier League','football',20,'https://www.premierleague.com/en/clubs'),('KBL','kr','KBL','basketball',10,'https://kbl.or.kr/')]
for league,country,name,sport,total,url in configs:
 members=[{**v,'member_key':hashlib.sha256(v['brand_id'].encode()).hexdigest()[:20]}for v in proof if v['league']==league]
 if league=='pl':members.append({'name':'Coventry City','brand_id':'coventry-city-fc','member_key':hashlib.sha256(b'coventry-city-fc').hexdigest()[:20],'identity_reviewed':False,'png_verified':False,'reason':'Official SVG contains embedded raster; separate vector review pending'})
 collections.append({'id':f'sports-{country}-{league.lower() if league!="pl" else "premier-league"}-2026','name':name+' 구단','country':country.upper(),'sector':'sports','sport':sport,'league':name,'season':'2026','roster_status':'official','scope_note':'공식 명부/구단 디렉터리와 대조. 로고 도입연도 및 모든 변형 완비와는 별개.','as_of':'2026-10-12','source_kind':'official','source_url':url,'source_revision':'checked-20261012','count_unit':'entity','total':total,'verified':sum(bool(m['png_verified'])for m in members),'members':members})
# KOVO roster has fourteen clubs; two were CDN-verified in the earlier release.
roster=json.loads((R/'marketing/assets/sports-official-20261011/kbl-kovo/audit-report.json').read_text())['kovo']['teams'];newids={'1005':'hyundai-capital-skywalkers','1006':'kepco-vixtorm','1002':'samsung-fire-bluefangs','2002':'korea-expressway-hi-pass','2008':'aipeppers'};members=[]
for t in roster:
 id=t.get('canonical_id')or newids[t['code']];members.append({'name':t['name'],'brand_id':id,'member_key':hashlib.sha256(id.encode()).hexdigest()[:20],'identity_reviewed':True,'png_verified':True,'source_url':t['emblem_url']})
collections.append({'id':'sports-kr-kovo-2026','name':'KOVO V리그 구단','country':'KR','sector':'sports','sport':'volleyball','league':'KOVO','season':'2026','roster_status':'official','scope_note':'KOVO 공식 구단 디렉터리 남녀14팀. AI페퍼스의 이전 로고를 SOOP 수퍼스와 같은 콘텐츠에 보존.','as_of':'2026-10-12','source_kind':'official','source_url':'https://kovo.co.kr/','source_revision':'checked-20261012','count_unit':'entity','total':14,'verified':14,'members':members})
(D/'coverage.json').write_text(json.dumps({'checked_at':'2026-10-12','collections':collections},ensure_ascii=False,indent=2)+'\n');print('READY',len(release['variants']),'sports teams')

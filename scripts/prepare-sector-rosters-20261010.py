"""Prepare bounded, sourced rosters. Name matches remain unreviewed candidates."""
import json,re,hashlib
from pathlib import Path
from collections import defaultdict
from datetime import datetime, timezone
ROOT=Path(__file__).resolve().parents[1]
ASOF='2026-10-10'
sources=json.loads((ROOT/'data/collection/sector-roster-sources-20261010.json').read_text())
catalog=json.loads((ROOT/'marketing/assets/collection-coverage/catalog.json').read_text())
def norm(s): return re.sub(r'[^a-z0-9가-힣]','',s.lower())
lookup=defaultdict(set)
for row in catalog:
 for name in [row.get('name_ko',''),row.get('name_en',''),row['id'],*row.get('aliases',[])]:
  if name: lookup[norm(name)].add(row['id'])
collections=[]
def add(id,name,country,sector,names,url,league=None,sport=None,season=None,note=''):
 assert len(names)==len(set(names))
 members=[{'member_key':hashlib.sha256(n.encode()).hexdigest()[:20],'name':n,'brand_id':None,'candidates':sorted(lookup.get(norm(n),[])),'identity_reviewed':False,'png_verified':False} for n in names]
 collections.append(dict(id=id,name=name,country=country,sector=sector,league=league,sport=sport,season=season,scope_note=note,roster_status='official_roster_checked',as_of=ASOF,source_kind='official_directory_roster',source_url=url,source_revision=hashlib.sha256('\n'.join(names).encode()).hexdigest(),count_unit='entity',total=len(members),verified=0,candidates=sum(bool(m['candidates']) for m in members),members=members))
add('sports-kr-kleague1-2026','K리그1 · 2026','대한민국','sports','인천 유나이티드|FC 서울|울산 HD|강원 FC|김천 상무|포항 스틸러스|전북 현대 모터스|부천 FC 1995|제주 SK FC|광주 FC|대전 하나 시티즌|FC 안양'.split('|'),'https://www.kleague.com/news_view.do?orderBy=seq&seq=94117','K리그1','축구','2026','2026 개막 일정의 12개 참가 구단 기준이에요.')
add('sports-en-premierleague-2025-26','프리미어리그 · 2025/26','잉글랜드','sports','Arsenal|Aston Villa|AFC Bournemouth|Brentford|Brighton & Hove Albion|Burnley|Chelsea|Crystal Palace|Everton|Fulham|Leeds United|Liverpool|Manchester City|Manchester United|Newcastle United|Nottingham Forest|Sunderland|Tottenham Hotspur|West Ham United|Wolverhampton Wanderers'.split('|'),'https://www.premierleague.com/en/news/4373817/get-to-know-all-the-2025-26-premier-league-clubs-with-video-guides','Premier League','축구','2025/26','2025년 8월 공식 안내의 참가 20개 구단이며 현재 시즌 전체를 뜻하지 않아요.')
add('sports-kr-kbo-2026','KBO · 공식 구단 안내','대한민국','sports','LG Twins|KT Wiz|SSG Landers|NC Dinos|Doosan Bears|KIA Tigers|Lotte Giants|Samsung Lions|Hanwha Eagles|Kiwoom Heroes'.split('|'),'https://eng.koreabaseball.com/Standings/TeamStandings.aspx','KBO','야구','2026','확인일의 공식 구단·순위 안내에 등재된 10개 구단이에요.')
add('sports-us-mlb-2026','MLB · 공식 구단 안내','미국·캐나다','sports','Arizona Diamondbacks|Atlanta Braves|Baltimore Orioles|Boston Red Sox|Chicago Cubs|Chicago White Sox|Cincinnati Reds|Cleveland Guardians|Colorado Rockies|Detroit Tigers|Houston Astros|Kansas City Royals|Los Angeles Angels|Los Angeles Dodgers|Miami Marlins|Milwaukee Brewers|Minnesota Twins|New York Mets|New York Yankees|Athletics|Philadelphia Phillies|Pittsburgh Pirates|San Diego Padres|San Francisco Giants|Seattle Mariners|St. Louis Cardinals|Tampa Bay Rays|Texas Rangers|Toronto Blue Jays|Washington Nationals'.split('|'),'https://www.mlb.com/team','MLB','야구','2026')
add('sports-us-nba-2025-26','NBA · 2025/26','미국·캐나다','sports','Atlanta Hawks|Boston Celtics|Brooklyn Nets|Charlotte Hornets|Chicago Bulls|Cleveland Cavaliers|Dallas Mavericks|Denver Nuggets|Detroit Pistons|Golden State Warriors|Houston Rockets|Indiana Pacers|Los Angeles Clippers|Los Angeles Lakers|Memphis Grizzlies|Miami Heat|Milwaukee Bucks|Minnesota Timberwolves|New Orleans Pelicans|New York Knicks|Oklahoma City Thunder|Orlando Magic|Philadelphia 76ers|Phoenix Suns|Portland Trail Blazers|Sacramento Kings|San Antonio Spurs|Toronto Raptors|Utah Jazz|Washington Wizards'.split('|'),'https://api-hub.nba.com/news/nba-rosters-set-for-2025-26-regular-season','NBA','농구','2025/26')
for sex,names in [('남자부','현대캐피탈 스카이워커스|대한항공 점보스|KB손해보험 스타즈|우리카드 우리WON|삼성화재 블루팡스|한국전력 빅스톰|OK저축은행 읏맨'),('여자부','흥국생명 핑크스파이더스|정관장 레드스파크스|현대건설 힐스테이트|IBK기업은행 알토스|한국도로공사 하이패스|GS칼텍스 KIXX|페퍼저축은행 AI페퍼스')]:
 add('sports-kr-kovo-'+('men' if sex=='남자부' else 'women'),'KOVO · '+sex,'대한민국','sports',names.split('|'),'https://cdn.kovo.co.kr/court-views/index.html','V리그 '+sex,'배구',None,'공식 경기장 안내의 구단 명단이에요. 시즌별 참가 명부 검증과는 구분해요.')
uni=sources['russell_group_universities']
assert len(uni)==24,uni
add('education-uk-russell-group','Russell Group · 회원 대학','영국','education',uni,'https://www.informedchoices.ac.uk/universities',note='공식 협회가 안내하는 회원 대학 24곳이에요. 영국 전체 대학 명부가 아니에요.')
ebu=sources['ebu_directory_entries']
bycountry=defaultdict(list)
for m in ebu: bycountry[m['country']].append(m['name'])
for country,names in sorted(bycountry.items()):
 add('media-ebu-'+norm(country),'EBU 방송 조직 · '+country,country,'media',names,'https://www.ebu.ch/about/members',note='EBU 페이지에 개별 등재된 방송 조직 기준이에요. 국가 전체 방송·신문사 수나 EBU 회원 단위 수와는 달라요.')
report={'checked_at':datetime.now(timezone.utc).isoformat(),'collections':collections}
out=ROOT/'data/collection/sector-rosters-20261010.json';out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('Prepared',len(collections),'bounded rosters;',sum(c['total'] for c in collections),'members; all logo identities pending review')

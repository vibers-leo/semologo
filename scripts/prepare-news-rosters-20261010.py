"""Bounded EANA directory roster, excluding explicitly suspended membership."""
import json,re,hashlib
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parents[1]
source=ROOT/'data/collection/eana-directory-20261010.json'
entries=json.loads(source.read_text())
catalog=json.loads((ROOT/'marketing/assets/collection-coverage/catalog.json').read_text())
def norm(s):return re.sub(r'[^a-z0-9가-힣]','',s.lower())
collections=[]
for entry in entries:
 if entry['suspended']:continue
 name,country=entry['name'],entry['country']
 candidates=[b['id'] for b in catalog if norm(name) in {norm(s) for s in [b.get('name_ko',''),b.get('name_en',''),*b.get('aliases',[])]}]
 member=dict(member_key=hashlib.sha256(name.encode()).hexdigest()[:20],name=name,brand_id=None,candidates=candidates,identity_reviewed=False,png_verified=False)
 collections.append(dict(id='news-eana-'+norm(country),name='EANA 통신사 · '+country,country=country,sector='media',roster_status='official_roster_checked',scope_note='EANA 공식 디렉터리에 등재된 통신사이며 명시적으로 정지된 회원은 제외했어요. 국가 전체 신문·언론사 수가 아니에요.',as_of='2026-10-10',source_kind='official_directory_roster',source_url='https://newsalliance.org/members/',source_revision=hashlib.sha256(source.read_bytes()).hexdigest(),count_unit='entity',total=1,verified=0,candidates=int(bool(candidates)),members=[member]))
assert len(collections)==33
(ROOT/'data/collection/news-rosters-20261010.json').write_text(json.dumps(dict(checked_at=datetime.now(timezone.utc).isoformat(),collections=collections),ensure_ascii=False,indent=2)+'\n')
print('PASS: 33 bounded country rosters; 33 agencies; suspended member excluded; PNG verified 0')

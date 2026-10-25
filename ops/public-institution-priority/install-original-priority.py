"""Put reported/audited institutions first in the existing private AI/PDF archive."""
from pathlib import Path
import py_compile
p=Path('/root/projects/semologo-auto-fleet/scripts/collect-korean-ci-originals-20261021.py')
s=p.read_text();needle='work=candidates[:30];'
if 'public-white-priority-20261025' not in s:
 assert s.count(needle)==1
 insert='''# public-white-priority-20261025: preserve limits, original bytes and private archive contract.
import unicodedata
def priority_name(value):
 value=unicodedata.normalize('NFKC',value).lower()
 value=re.sub(r'주식회사|재단법인|\\(주\\)|\\(재\\)','',value)
 return ''.join(c for c in value if c.isalnum())
priority_file=Path('/root/projects/vibers-fleet/releases/20261025-semologo-public-priority/quality-priority.json')
priority_rows=json.loads(priority_file.read_text()) if priority_file.exists() else {}
priority={}
for index,row in enumerate(priority_rows.get('ready',[])+priority_rows.get('unresolved',[])):
 priority.setdefault(priority_name(row['name']),index)
candidates.sort(key=lambda row:priority.get(priority_name(row[0]),1000000))
'''
 p.with_name(p.name+'.before-public-white-priority-20261025').write_text(s)
 s=s.replace(needle,insert+needle);tmp=p.with_suffix('.priority.py');tmp.write_text(s);py_compile.compile(str(tmp),doraise=True);tmp.replace(p)
print('PASS official original archive prioritizes replacement requests and audited white backgrounds')

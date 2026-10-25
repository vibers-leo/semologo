"""Keep repair cohorts existing-only and revisit vectors after PNG identity enrichment."""
from pathlib import Path
import fcntl,json,py_compile,runpy,sys
ROOT=Path('/root/projects/semologo-publisher')
def install():
 core=ROOT/'scripts/fleet-auto-core.py';pipeline=ROOT/'scripts/run-auto-fleet-pipeline.py'
 a=core.read_text();b=pipeline.read_text()
 if 'allow_known_landing=False' not in a:
  assert a.count('def source_reason(row):')==1
  a=a.replace('def source_reason(row):','def source_reason(row, allow_known_landing=False):')
  needle="if page.path not in ('','/') or page.query:return 'not_homepage'"
  assert a.count(needle)==1
  a=a.replace(needle,"if not allow_known_landing and (page.path not in ('','/') or page.query):return 'not_homepage'")
  needle="        else:\n            reason = CORE['source_reason'](item)"
  assert b.count(needle)==1
  b=b.replace(needle,"        elif priority_lane and not by_domain.get(domain):\n            reason = 'priority-existing-identity-resolution-required'\n        else:\n            reason = CORE['source_reason'](item, allow_known_landing=priority_lane and len(by_domain.get(domain, [])) == 1)")
  for p,s in [(core,a),(pipeline,b)]:
   p.with_name(p.name+'.before-vector-repair-gates-20261025').write_text(p.read_text())
   tmp=p.with_suffix('.repair-gates.py');tmp.write_text(s);py_compile.compile(str(tmp),doraise=True);tmp.replace(p)
 f=runpy.run_path(str(core))['source_reason']
 row={'domain':'example.org','pageUrl':'https://example.org/site/main/home','assetUrl':'https://example.org/images/logo.svg'}
 assert f(row)=='not_homepage' and f(row,True)==''
 assert f({**row,'assetUrl':'https://other.example/logo.svg'},True)=='not_first_party_https'
 assert f({**row,'assetUrl':'https://example.org/logo.png'},True)=='not_canonical_svg'
 print('PASS existing-only repair lane and first-party landing/safety gates')
def replay():
 state=ROOT/'fleet-auto-state';marker=state/'native-vector-replay-after-png-20261025.json'
 if marker.exists():return
 r=runpy.run_path(str(ROOT/'run.py'));r['credentials']()
 c=runpy.run_path(str(ROOT/'scripts/fleet-auto-core.py'))
 query=r'''const{Pool}=require('pg');const p=new Pool({connectionString:process.env.FLEET_DATABASE_URL,max:1});(async()=>{try{const q=await p.query("SELECT count(*)::int n FROM fleet.job WHERE project='semologo' AND input->>'priority'='kr-public-institutions-20261025' AND status IN ('queued','running')");console.log(JSON.stringify(q.rows[0]))}finally{await p.end()}})().catch(e=>{console.error(e.message);process.exit(1)})'''
 if c['node']('vibers-fleet',query)['n']:return
 with (state/'pipeline.lock').open('w') as lock:
  try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  except BlockingIOError:return
  ledger=state/'public-institution-priority-processed.json'
  if not ledger.exists():return
  before=json.loads(ledger.read_text())
  (state/'priority-ledger.before-native-vector-replay-20261025.json').write_text(json.dumps(before))
  tmp=ledger.with_suffix('.tmp');tmp.write_text('[]');tmp.replace(ledger)
  marker.write_text(json.dumps({'reason':'one vector re-review after PNG identity enrichment and Korean OCR','priorReviewedJobs':len(before)}))
  print(json.dumps({'nativeVectorReReviewQueued':len(before)}))
if __name__=='__main__':replay() if '--replay' in sys.argv else install()

"""Audit the requested 1,778 PNG intake records; stage official vectors, never auto-publish."""
import concurrent.futures, importlib.util, json, argparse
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'marketing/assets/png-recollection-20261010'
spec=importlib.util.spec_from_file_location('collector',ROOT/'scripts/collect-public-institution-vectors.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);m.OUT=OUT
ap=argparse.ArgumentParser();ap.add_argument('--limit',type=int);args=ap.parse_args()
q=json.loads((OUT/'queue.json').read_text())['candidates']
ledger=OUT/'results.json';old={x['id']:x for x in json.loads(ledger.read_text())} if ledger.exists() else {}
todo=[dict(x,member_key=x['id']) for x in q if x['id'] not in old]
if args.limit:todo=todo[:args.limit]
def save():
 t=ledger.with_suffix('.tmp');t.write_text(json.dumps(list(old.values()),ensure_ascii=False,indent=2));t.replace(ledger)
 summary={'total':len(q),'checked':len(old),'downloaded_needs_review':sum(x.get('status')=='downloaded-needs-review' for x in old.values()),'remaining':len(q)-len(old)}
 (OUT/'progress.json').write_text(json.dumps(summary,indent=2));print(json.dumps(summary),flush=True)
print('Inspecting',len(todo),flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
 fs={pool.submit(m.inspect,x):x for x in todo}
 for i,f in enumerate(concurrent.futures.as_completed(fs),1):
  x=fs[f]
  try:old[x['id']]=f.result()
  except Exception as e:old[x['id']]={**x,'status':'held','reason':str(e)}
  if i%10==0 or i==len(todo):save()
save()

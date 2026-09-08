"""Record source website availability; this does not assert redesign dates."""
import json,subprocess,concurrent.futures
from pathlib import Path
W=Path(__file__).resolve().parents[1]/'artifacts/ai-svg-collection'
r=json.loads((W/'publish-review.json').read_text());urls=sorted({x['website'] for x in r['approved'] if x['is_new'] and x['website'].startswith('https://')})
def check(u):
 try:
  p=subprocess.run(['curl','-L','-sS','--max-time','18','--max-filesize','4000000','-A','Mozilla/5.0','-o','/dev/null','-w','%{http_code} %{url_effective}',u],capture_output=True,text=True,timeout=20)
  return dict(url=u,result=p.stdout.strip(),ok=p.stdout.startswith('200 '))
 except Exception:return dict(url=u,result='timeout',ok=False)
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:out=list(pool.map(check,urls))
(W/'origin-checks.json').write_text(json.dumps(out,indent=2));print('Origins',len(out),'HTTP 200',sum(x['ok'] for x in out));print([x for x in out if not x['ok']])

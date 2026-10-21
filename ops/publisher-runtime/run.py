#!/usr/bin/env python3
import argparse,os,shlex,subprocess,sys
from pathlib import Path
BASE=Path(__file__).resolve().parent

def credentials():
 allowed={'FLEET_NCP_ACCESS_KEY':'NCP_ACCESS_KEY','FLEET_NCP_SECRET_KEY':'NCP_SECRET_KEY'}
 for line in Path('/root/projects/vibers-fleet/secrets/server.env').read_text().splitlines():
  key,sep,value=line.removeprefix('export ').partition('=')
  if sep and key in allowed:
   words=shlex.split(value,comments=True);os.environ[allowed[key]]=words[0] if words else ''
 if not all(os.environ.get(v) for v in allowed.values()):raise SystemExit('Existing bucket credentials unavailable')
 os.environ['TMPDIR']=str(BASE/'tmp');(BASE/'tmp').mkdir(exist_ok=True)

def main():
 p=argparse.ArgumentParser();p.add_argument('--dry-run',action='store_true');a=p.parse_args();credentials()
 for _ in range(1 if a.dry_run else 2):
  cmd=[sys.executable,str(BASE/'scripts/run-auto-fleet-pipeline.py'),'--limit-jobs','2' if a.dry_run else '200']
  if not a.dry_run:cmd+=['--apply']
  r=subprocess.run(cmd,cwd=BASE)
  if r.returncode:raise SystemExit(r.returncode)
if __name__=='__main__':main()

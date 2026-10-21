#!/usr/bin/env python3
"""Bounded existing-CMS composition planner and existing Windows queue adapter."""
import argparse,fcntl,json,subprocess,datetime,hashlib,sys
from pathlib import Path
BASE=Path(__file__).resolve().parent

def call(container,code,args=[]):
 r=subprocess.run(['docker','exec','-i',container,'node','-',*args],input=code,text=True,capture_output=True,timeout=80)
 if r.returncode:raise RuntimeError(r.stderr.strip()[-700:])
 return json.loads(r.stdout)

def main():
 a=argparse.ArgumentParser();a.add_argument('--init',action='store_true');a.add_argument('--status',action='store_true');a.add_argument('--test',action='store_true');a.add_argument('--dry-run',action='store_true');args=a.parse_args()
 revision=(BASE/'COMMIT').read_text().strip();state=BASE/'state';state.mkdir(exist_ok=True)
 with (state/'run.lock').open('w') as lock:
  try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  except BlockingIOError:print(json.dumps({'status':'already_running'}));return
  policy=(BASE/'policy.cjs').read_text();cms=policy+'\n'+(BASE/'cms.cjs').read_text()
  if args.init:print(json.dumps(call('semologo',cms,['init',revision])));return
  if args.status:print(json.dumps(call('semologo',cms,['report',revision]),ensure_ascii=False));return
  refresh=call('semologo',cms,['refresh',revision]);pending=call('semologo',cms,['pending',revision]);receipt=call('vibers-fleet','const DATA='+json.dumps(pending)+';const DRY_RUN='+json.dumps(args.dry_run)+';\n'+(BASE/'fleet.cjs').read_text())
  sync=None if args.dry_run else call('semologo','const RECEIPT='+json.dumps(receipt)+';const REVISION='+json.dumps(revision)+';\n'+(BASE/'sync.cjs').read_text())
  report=call('semologo',cms,['report',revision]);now=datetime.datetime.now(datetime.timezone.utc);result={'at':now.isoformat(),'codeRevision':revision,'refresh':refresh,'dispatch':receipt,'sync':sync,'report':report}
  folder=state/'runs';folder.mkdir(exist_ok=True);raw=(json.dumps(result,ensure_ascii=False,indent=2)+'\n').encode();path=folder/(now.strftime('%Y%m%dT%H%M%SZ')+'.json');path.write_bytes(raw)
  tmp=state/'latest.tmp';tmp.write_bytes(raw);tmp.replace(state/'latest.json');print(json.dumps({'at':result['at'],'refresh':refresh,'dispatch':receipt,'summary':report['summary'],'reportFile':str(path),'sha256':hashlib.sha256(raw).hexdigest()},ensure_ascii=False))
if __name__=='__main__':main()

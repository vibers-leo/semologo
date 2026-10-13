"""Bound one local audit run to 24h, maintain PID/state, and terminate only its process group."""
from pathlib import Path
import subprocess,json,os,signal,datetime,sys
R=Path(__file__).resolve().parents[1];D=R/'marketing/assets/svg-full-audit-20261013';M=D/'worker.json'
meta=json.loads(M.read_text());cmd=meta['command'];child=subprocess.Popen(cmd,cwd=R,start_new_session=True)
meta.update(pid=os.getpid(),child_pid=child.pid,status='running',started_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),timeout_seconds=86400);M.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
def stop(signum,frame):
 os.killpg(child.pid,signal.SIGTERM)
signal.signal(signal.SIGTERM,stop);signal.signal(signal.SIGINT,stop)
try:rc=child.wait(timeout=86400)
except subprocess.TimeoutExpired:
 os.killpg(child.pid,signal.SIGTERM)
 try:child.wait(timeout=30)
 except subprocess.TimeoutExpired:os.killpg(child.pid,signal.SIGKILL);child.wait()
 rc=124
meta.update(status='complete' if rc==0 else 'failed',exit_code=rc,finished_at=datetime.datetime.now(datetime.timezone.utc).isoformat());M.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n');sys.exit(rc)

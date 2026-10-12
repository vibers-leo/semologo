"""Exercise the real wrapper with isolated commands; never touches a server."""
from pathlib import Path
import tempfile, os, subprocess

root=Path(__file__).resolve().parents[1]
base=Path('/Volumes/HDD-1TB/semologo-migration/task-tmp')
with tempfile.TemporaryDirectory(prefix='deploy-policy-test-',dir=base) as temp:
    d=Path(temp); b=d/'bin';b.mkdir()
    def executable(path,text):
        path.write_text('#!/usr/bin/env bash\n'+text);path.chmod(0o755)
    executable(b/'flock','exit 0\n')
    executable(b/'sleep','exit 0\n')
    executable(b/'awk','case "${@: -1}" in */meminfo) echo 6291456;; */pressure/memory) echo "0 0";; */vmstat) echo 0;; esac\n')
    executable(b/'docker','if [[ "$1" == inspect ]]; then echo "4294967296 4294967296"; else echo "$*" >> "$EVENTS"; fi\n')
    executable(b/'nice','shift 2; exec "$@"\n')
    executable(b/'ionice','shift 4; exec "$@"\n')
    executable(d/'redact.sh','cat\n')
    executable(d/'deploy.sh','echo deploy >> "$EVENTS"; exit "${DEPLOY_RESULT:-0}"\n')
    text=(root/'scripts/vibers-managed-deploy.sh').read_text()
    text=text.replace('/root/scripts/vibers-deploy-resource-check.sh',str(root/'scripts/vibers-deploy-resource-check.sh'))
    text=text.replace('/root/scripts/redact-secrets.sh',str(d/'redact.sh'))
    text=text.replace('/root/scripts/webhook-deploy-generic.sh',str(d/'deploy.sh'))
    text=text.replace('/root/scripts/deploy-${app}.sh',str(d/'absent-${app}.sh'))
    text=text.replace('/root/projects/',str(d)+'/projects/')
    text=text.replace('/var/lock/',str(d)+'/').replace('/tmp/${app}',str(d)+'/${app}')
    wrapper=d/'wrapper.sh';wrapper.write_text(text)
    for result in [0,42]:
        events=d/'events';events.write_text('')
        env={**os.environ,'PATH':str(b)+':'+os.environ['PATH'],'EVENTS':str(events),'DEPLOY_RESULT':str(result)}
        run=subprocess.run(['bash',str(wrapper),'fixture'],env=env,capture_output=True,text=True,timeout=10)
        assert run.returncode==result,(run.returncode,run.stderr)
        assert events.read_text().splitlines()==['deploy','buildx stop vibers-guarded'],events.read_text()
    marker=d/'projects/fixture/.prebuilt-only';marker.parent.mkdir(parents=True);marker.touch()
    events.write_text('')
    run=subprocess.run(['bash',str(wrapper),'fixture'],env=env,capture_output=True,text=True,timeout=10)
    assert run.returncode==0
    assert events.read_text()=='', 'prebuilt project must never start a production build'
    assert (d/'fixture-deploy.status').read_text().strip()=='QUEUED'
    print('PASS prebuilt-only project queues image delivery without running a build')
    print('PASS managed wrapper: builder stops after successful and failed deployment; exit code preserved')

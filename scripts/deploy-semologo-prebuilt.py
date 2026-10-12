"""Verify and deliver a locally built SemoLogo image; rollback on health failure."""
from pathlib import Path
import argparse, json, subprocess, hashlib, re
p=argparse.ArgumentParser();p.add_argument('receipt');a=p.parse_args()
r=json.loads(Path(a.receipt).read_text()); artifact=Path(r['artifact'])
assert re.fullmatch(r'[0-9a-f]{40}',r['revision'])
assert re.fullmatch(r'semologo:local-[0-9a-f]{12}',r['tag'])
assert r['platform']=='linux/amd64'
assert hashlib.file_digest(artifact.open('rb'),'sha256').hexdigest()==r['sha256']
remote='/root/ops/semologo-prebuilt/'+r['revision']
subprocess.run(['ssh','vibers','mkdir','-p',remote],check=True)
subprocess.run(['scp',str(artifact),'vibers:'+remote+'/image.tar'],check=True)
script=r'''set -Eeuo pipefail
revision=$1; tag=$2; digest=$3; dir=/root/ops/semologo-prebuilt/$revision
exec 9>/var/lock/semologo-deploy.lock
flock -w 3600 9
exec 8>/var/lock/vibers-deploy-global.lock
flock -w 3600 8
cd "$dir"
printf '%s  image.tar\n' "$digest" | sha256sum -c -
docker load -i image.tar
[[ "$(docker image inspect "$tag" --format '{{.Os}}/{{.Architecture}}')" == linux/amd64 ]]
[[ "$(docker image inspect "$tag" --format '{{index .Config.Labels "org.opencontainers.image.revision"}}')" == "$revision" ]]
old=$(docker inspect semologo --format '{{.Image}}')
rollback=semologo:rollback-$(date +%Y%m%d%H%M%S)
docker tag "$old" "$rollback"
restore() {
 rc=$?
 if (( rc != 0 )); then
  docker tag "$old" semologo:latest
  docker compose -f /root/projects/semologo/docker-compose.yml up -d --wait
  printf 'FAILED: prebuilt health verification; prior image restored\n' >/tmp/semologo-deploy.status
 fi
 exit "$rc"
}
trap restore EXIT
printf 'RUNNING\n' >/tmp/semologo-deploy.status
docker tag "$tag" semologo:latest
docker compose -f /root/projects/semologo/docker-compose.yml up -d --wait
healthy=0
for i in {1..12}; do
 if [[ "$(curl --max-time 10 -s -o /dev/null -w '%{http_code}' http://localhost:4520/)" == 200 ]]; then healthy=1; break; fi
 sleep 5
done
(( healthy == 1 ))
[[ "$(docker inspect semologo --format '{{.Image}}')" == "$(docker image inspect "$tag" --format '{{.Id}}')" ]]
printf 'SUCCESS\n' >/tmp/semologo-deploy.status
printf 'revision=%s\nrollback=%s\n' "$revision" "$rollback" >deployment.txt
printf 'PREBUILT DEPLOY OK revision=%s rollback=%s\n' "$revision" "$rollback"
'''
subprocess.run(['ssh','vibers','bash','-s','--',r['revision'],r['tag'],r['sha256']],input=script,text=True,check=True)
r['deployed']=True
Path(a.receipt).write_text(json.dumps(r,indent=2)+'\n')

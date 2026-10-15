#!/usr/bin/env bash
# Run on NCP after building the roster-only overlay image. Preserve the
# current fleet image, auth config and other project handlers.
set -Eeuo pipefail
old_image=vibers-fleet:20261015-keyen-r17-spmsisolation3
new_image=vibers-fleet:20261015-semologo-expanded
backup=vibers-fleet-before-semologo-20261015
test "$(docker inspect vibers-fleet --format '{{.Config.Image}}')" = "$old_image"
test "$(docker exec vibers-fleet sha256sum /app/semologo-sources.json | cut -d' ' -f1)" = 6952ab57f670c4326f5b3d5288b0b809155fca0556c529454c1f0311ea32c0f2
test "$(docker run --rm --entrypoint node "$new_image" -e 'console.log(require("/app/semologo-sources.json").sources.length)')" = 49
if docker inspect "$backup" >/dev/null 2>&1; then echo 'Backup name already exists'; exit 1; fi
rollback() {
  result=$?
  trap - EXIT
  if ((result != 0)); then
    docker rm -f vibers-fleet >/dev/null 2>&1 || true
    docker rename "$backup" vibers-fleet
    docker start vibers-fleet >/dev/null
  fi
  exit "$result"
}
trap rollback EXIT
docker stop vibers-fleet >/dev/null
docker rename vibers-fleet "$backup"
docker run -d --name vibers-fleet --network host --restart unless-stopped --user node \
  --env-file /root/projects/vibers-fleet/secrets/server.env \
  --mount type=bind,source=/root/projects/vibers-fleet/secrets/config.json,target=/run/fleet/config.json,readonly \
  "$new_image" >/dev/null
for attempt in {1..20}; do
  code=$(curl --silent --output /dev/null --write-out '%{http_code}' http://127.0.0.1:4781/health || true)
  if [[ "$code" == 401 ]] && [[ "$(docker inspect vibers-fleet --format '{{.State.Running}}')" == true ]]; then
    test "$(docker exec vibers-fleet sha256sum /app/semologo-sources.json | cut -d' ' -f1)" = 69bdbb427269cd244d67ede120b53e029accb73a269768b812b6968cc657f682
    echo 'fleet roster deployment healthy'
    exit 0
  fi
  sleep 1
done
echo 'fleet roster deployment failed health check' >&2
exit 1

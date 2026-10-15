#!/usr/bin/env bash
# Run on NCP only after the roster overlay image has passed its source-count
# and hash checks. Preserve the current fleet container for rollback.
set -Eeuo pipefail
old_image=vibers-fleet:20261015-semologo-expanded
new_image=vibers-fleet:20261015-semologo-cycle-r22
backup=vibers-fleet-before-semologo-cycle-r22
old_hash=69bdbb427269cd244d67ede120b53e029accb73a269768b812b6968cc657f682
new_hash=ee0191384ec798031144c26448b32b0bd187541809ea560acac9f3b3954f10a6
test "$(docker inspect vibers-fleet --format '{{.Config.Image}}')" = "$old_image"
test "$(docker exec vibers-fleet sha256sum /app/semologo-sources.json | cut -d' ' -f1)" = "$old_hash"
test "$(docker run --rm --entrypoint node "$new_image" -e 'console.log(require("/app/semologo-sources.json").sources.length)')" = 68
test "$(docker run --rm --entrypoint sha256sum "$new_image" /app/semologo-sources.json | cut -d' ' -f1)" = "$new_hash"
if docker inspect "$backup" >/dev/null 2>&1; then echo 'Backup name already exists' >&2; exit 1; fi
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
    test "$(docker exec vibers-fleet sha256sum /app/semologo-sources.json | cut -d' ' -f1)" = "$new_hash"
    echo 'fleet cycle roster deployment healthy'
    exit 0
  fi
  sleep 1
done
echo 'fleet cycle roster deployment failed health check' >&2
exit 1

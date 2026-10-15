#!/usr/bin/env bash
set -Eeuo pipefail
old_image=vibers-fleet:20261015-semologo-cycle-r22
new_image=vibers-fleet:20261015-semologo-gzip-r23
backup=vibers-fleet-before-semologo-gzip-r23
test "$(docker inspect vibers-fleet --format '{{.Config.Image}}')" = "$old_image"
test "$(docker exec vibers-fleet sha256sum /app/semologo-sources.json | cut -d' ' -f1)" = ee0191384ec798031144c26448b32b0bd187541809ea560acac9f3b3954f10a6
for pair in 'semologo-sources.json eb0dde51ec3671efb6bf3b23bc4b0e1be8249d93ff37ef7c255c1f8747303ce1' 'semologo-collector.mjs 7f166131bd09a887c7775eeb8c623b89347f3c33f00edb446dd32eb3010c77c9' 'artifacts.mjs ae41dd376942ef72cfefee2dfe6441fe28d09eb2440bbb6dcc4ec4cca4121974'; do
  set -- $pair
  test "$(docker run --rm --entrypoint sha256sum "$new_image" "/app/$1" | cut -d' ' -f1)" = "$2"
done
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
    echo 'fleet gzip collector deployment healthy'
    exit 0
  fi
  sleep 1
done
echo 'fleet gzip collector deployment failed health check' >&2
exit 1

#!/usr/bin/env bash
set -euo pipefail
BASE=/root/projects/vibers-fleet/releases/20261025-semologo-public-priority
# Cache Firestore vote reads for five minutes; retain the previous queue if a read fails.
if [[ ! -f "$BASE/quality-priority.json" ]] || [[ $(find "$BASE/quality-priority.json" -mmin +4 -print) ]]; then
  if docker exec semologo node -e "$(cat "$BASE/quality-sync.cjs")" > "$BASE/quality-priority.json.tmp"; then
    mv "$BASE/quality-priority.json.tmp" "$BASE/quality-priority.json"
  elif [[ ! -f "$BASE/quality-priority.json" ]]; then
    exit 1
  fi
fi
set +e
docker exec -i semologo node -e "$(cat "$BASE/export.cjs")" < "$BASE/quality-priority.json" \
  | docker exec -i vibers-fleet node -e "$(cat "$BASE/queue.cjs")" -- --apply
result=$?
set -e
case "$result" in
  10) exit 0 ;; # Keep the generic foreign feed behind live domestic targets.
  0) exec bash /root/projects/vibers-fleet/releases/20261019-semologo-kr-priority-r51/run-korea-first-domain-feeder.sh ;;
  *) exit "$result" ;;
esac

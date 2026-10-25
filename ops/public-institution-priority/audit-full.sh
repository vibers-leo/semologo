#!/usr/bin/env bash
set -euo pipefail
BASE=/root/projects/vibers-fleet/releases/20261025-semologo-public-priority
export SEMOLOGO_AUDIT_ROOT="$BASE"
PYTHON=/root/projects/semologo-auto-fleet/.venv/bin/python
"$PYTHON" "$BASE/audit-white-range.py"
"$PYTHON" "$BASE/build-repair-sources.py"
cp "$BASE/ops/public-institution-priority/repair-sources.json" "$BASE/repair-sources.json.next"
mv "$BASE/repair-sources.json.next" "$BASE/repair-sources.json"
docker exec -i semologo node -e "$(cat "$BASE/quality-sync.cjs")" < "$BASE/repair-sources.json" > "$BASE/quality-priority.json.next"
mv "$BASE/quality-priority.json.next" "$BASE/quality-priority.json"
systemctl start semologo-domain-discover.service

#!/bin/bash
set -euo pipefail

project=/Volumes/HDD-1TB/semologo-migration/20261005/project
out="$project/marketing/assets/svg-background-publish-20261014"
[ -d "$project/.git" ] || exit 1
[ ! -f "$out/complete.json" ] || exit 0

if ! /usr/bin/nc -z 127.0.0.1 63357 >/dev/null 2>&1; then
  /usr/bin/ssh -f -o BatchMode=yes -o ExitOnForwardFailure=yes -o ConnectTimeout=8 \
    -o ServerAliveInterval=15 -o ServerAliveCountMax=3 -N \
    -L 127.0.0.1:63357:127.0.0.1:5435 vibers
fi

cd "$project"
exec /opt/homebrew/bin/python3 scripts/publish-svg-background-audit-20261014.py --workers 2

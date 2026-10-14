#!/bin/bash
set -euo pipefail

project=/Volumes/HDD-1TB/semologo-migration/20261005/project
[ -d "$project/.git" ] || exit 1

# The queue builder reads the main DB through the same local tunnel as the
# audited SVG publisher. LaunchAgent runs without an interactive shell, so it
# must establish the tunnel itself when a previous session has ended.
if ! /usr/bin/nc -z 127.0.0.1 63357 >/dev/null 2>&1; then
  /usr/bin/ssh -f -o BatchMode=yes -o ExitOnForwardFailure=yes -o ConnectTimeout=8 \
    -o ServerAliveInterval=15 -o ServerAliveCountMax=3 -N \
    -L 127.0.0.1:63357:127.0.0.1:5435 vibers
fi

cd "$project"
exec /opt/homebrew/bin/python3 scripts/build-four-form-recollection-queue.py

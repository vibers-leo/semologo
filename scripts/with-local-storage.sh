#!/bin/bash
set -euo pipefail
volume=/Volumes/HDD-1TB
root="$volume/semologo-migration"
# Fail before creating any path when the external disk is disconnected.
/sbin/mount | /usr/bin/grep -Fq " on $volume (" || { echo '세모로고 1F 디스크를 연결해 주세요.' >&2; exit 1; }
project="$root/20261005/project"
[ -d "$project/.git" ] || { echo '세모로고 작업 폴더를 확인해 주세요.' >&2; exit 1; }
export TMPDIR="$root/task-tmp/runtime/"
export TMP="$TMPDIR" TEMP="$TMPDIR"
export XDG_CACHE_HOME="$root/task-tmp/cache"
export npm_config_cache="$root/task-tmp/npm-cache"
export PIP_CACHE_DIR="$root/task-tmp/pip-cache"
export PYTHONPYCACHEPREFIX="$root/task-tmp/python-cache"
export NODE_COMPILE_CACHE="$root/task-tmp/node-compile-cache"
mkdir -p "$TMPDIR" "$XDG_CACHE_HOME" "$npm_config_cache" "$PIP_CACHE_DIR" "$PYTHONPYCACHEPREFIX" "$NODE_COMPILE_CACHE"
cd "$project"
if [ "$#" -eq 0 ]; then exec /bin/zsh -f; fi
exec "$@"

#!/usr/bin/env bash
set -euo pipefail
base="$(cd "$(dirname "$0")" && pwd)"
pending="$(mktemp)"
updates="$(mktemp)"
trap 'rm -f "$pending" "$updates"' EXIT
docker exec semologo node -e "$(cat "$base/pending.cjs")" > "$pending"
docker exec -i vibers-fleet node -e "$(cat "$base/enqueue.cjs")" < "$pending" > "$updates"
docker exec -i semologo node -e "$(cat "$base/sync.cjs")" < "$updates"

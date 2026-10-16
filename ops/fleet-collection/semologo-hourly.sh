#!/usr/bin/env bash
set -euo pipefail
cd /root/projects/vibers-fleet
docker exec -i -w /app vibers-fleet node --input-type=module - < /root/projects/vibers-fleet/semologo-hourly.mjs \
  | tee -a /root/projects/vibers-fleet/semologo-hourly.jsonl

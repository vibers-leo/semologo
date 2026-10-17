#!/usr/bin/env bash
set -euo pipefail

RELEASE=/root/projects/vibers-fleet/releases/20261017-semologo-korea-wd-r47
GLOBAL=/root/projects/vibers-fleet/releases/20261017-semologo-domain-r45

# The Korean feeder fills the available per-worker slots first. The existing
# global feeder then uses only remaining slots, and resumes fully on exhaustion.
/usr/local/bin/docker exec -i vibers-fleet node - --apply < "$RELEASE/queue-worker-korea-wikidata-r47.cjs"
/usr/local/bin/docker exec -i vibers-fleet node - --apply < "$GLOBAL/queue-worker-domain-shards.cjs"

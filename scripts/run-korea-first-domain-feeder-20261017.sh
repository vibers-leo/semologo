#!/usr/bin/env bash
set -euo pipefail

RANKED=/root/projects/vibers-fleet/releases/20261018-semologo-kr-ranked-r48
RELEASE=/root/projects/vibers-fleet/releases/20261017-semologo-korea-wd-r47
GLOBAL=/root/projects/vibers-fleet/releases/20261017-semologo-domain-r45

# Ranked Korean sites fill available per-worker slots first. Exhausted Korean
# cohorts safely fall through to the existing global discovery feeder.
/usr/local/bin/docker exec -i vibers-fleet node - --apply < "$RANKED/queue-worker-ranked-korea-r48.cjs"
/usr/local/bin/docker exec -i vibers-fleet node - --apply < "$RELEASE/queue-worker-korea-wikidata-r47.cjs"
/usr/local/bin/docker exec -i vibers-fleet node - --apply < "$GLOBAL/queue-worker-domain-shards.cjs"

# Domestic public institutions and reported logo repairs first

Applied on 2026-10-25 to the existing fleet, without changing worker handlers.

- `export.cjs` reads the latest official public-institution snapshots and excludes verified, published PNG memberships. Initial gap: 222 institutions.
- `quality-sync.cjs` reads public replacement votes every five minutes. Known official sites enter source discovery ahead of the institution roster; unresolved official sites remain in the durable `quality-priority.json` report for identity resolution. Votes never approve source artwork.
- `queue.cjs` uses the deployed domain handler at commit `c3373ce494a68dfa96974e91411d93ac00ebd634`. Each job has at most 12 domains; each draining worker has at most two queued/running priority batches. Workers with stale heartbeats or a stalled SemoLogo queue do not receive more batches. Unclaimed priority jobs can move to a draining authorized worker with a recomputed input hash.
- The deployed worker claim sorts by creation time. These priority jobs go ahead of queued foreign discovery work. Already running jobs finish normally. Other projects are not altered.
- `run.sh` is installed through `zz-public-institution-priority.conf` on `semologo-domain-discover.service`. Generic foreign feeds resume only after the available priority targets have been attempted and priority batches finish. Discovery attempts, failed sites, stored candidates, and published logos are different measurements.
- `install-publisher-lane.py` adds a separate ID-based processed ledger for these results. This prevents priority timestamps from falling behind the regular publisher cursor and prevents domestic results from waiting behind older foreign results. Existing source, vector safety, identity and visual review gates remain in place.

Server directory: `/root/projects/vibers-fleet/releases/20261025-semologo-public-priority`.
Publisher ledger: `/root/projects/semologo-publisher/fleet-auto-state/public-institution-priority-processed.json`.
Inspect queue logs with `journalctl -u semologo-domain-discover.service`; publication logs with `journalctl -u semologo-publisher.service`.

The first six completed batches were read from private object storage and their manifest/result hashes and job IDs verified. The first four publication batches were processed with `priorityLane=true`; all 23 source candidates in that review remained held (19 non-SVG files, 3 unsafe SVGs, 1 unsupported content response). This is not a claim of 23 new public logos.

## Yongsan replacement report

`gongu-ci-0778` had one replacement vote and an opaque legacy PNG. `repair-yongsan.py` installs the unchanged transparent PNG from its official homepage under an immutable source path, verifies bucket/CDN bytes, preserves the old asset, and locks the shared representative choice. The official file is 240×37; a larger vector remains a follow-up task. Background cleanup does not change the public listing date.

Official PNG SHA-256: `ad6b24585f4ec9a1c72fb20d5478ce712883a060f70dab557eee8e6e2e146d48`.
Public variants, shared presentation (`locked=true`), and the regenerated detail page were checked after publication.

## Recovery

To remove this priority policy, remove only `zz-public-institution-priority.conf`, reload systemd, and retain existing job/result history. Do not cancel active worker leases. The publisher has `.before-public-priority-20261025` backups; priority jobs must remain readable by the ID-based lane until all such results are reviewed. Do not restore only one publisher file while priority results are outstanding.

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

## Public-category white backgrounds: 2026-10-25 continuation

The user requested all white-background logos between 한국국제보건의료재단 and 한국환경교육네트워크, plus urgent handling of replacement votes. The current public-category popularity order was captured from the internal catalog API: indices 323–6629 inclusive, 6,307 entries. Pixel inspection covered all 6,307 displayed PNG previews: 1,433 suspected opaque white canvases and 11 unavailable files. The PNG-only subset was 2,297. These are audit candidates, not a claim of 1,433 completed repairs.

`snapshot-white-range.cjs`, `audit-white-range.py`, `audit-full.sh`, and the one-shot `semologo-public-white-audit.service` retain that complete snapshot on NCP. `build-repair-sources.py` produces `repair-sources.json` from the audit and official CI directory. `catalog-source-sites.json` supplies additional existing catalog domain candidates; publication still requires fresh first-party asset and identity checks. The source file includes both voted and unvoted white backgrounds. Replacement-vote batches are ranked before unvoted audits, and the PNG publication reader also prioritizes voted jobs. Only unclaimed SemoLogo priority jobs are re-ranked.

`semologo-png-repair.timer` runs one bounded process after a one-minute idle interval, up to six completed worker batches at a time. It verifies private manifests/results, checks the current representative is still opaque white, and accepts only unchanged first-party transparent PNGs with the **full institution name** confirmed by local Korean/English OCR. Ambiguous logos, statistical certification marks, acronyms without full-name evidence, missing sources and connection failures remain held. Existing native SVGs go through the vector lane rather than being downgraded to PNG. The original byte files and publication dates are preserved.

`install-korean-vector-ocr.py` adds strict Korean full-name matching to existing institution vector repairs. It does not permit automatic creation of new Korean identities. Tesseract `kor` data was installed on the server. `install-contrast-background.py` chooses readable light/dark backgrounds for gray artwork too; `verify-repairs.py` respects a later explicit presentation version chosen by the user.

`publish-png-repairs.py` publishes manually reviewed or full-name OCR-screened existing-brand repairs. Objects are immutable, bucket/CDN bytes are verified before the CMS transaction, and the current bucket manifest is reconciled with the authoritative CMS manifest. `verify-repairs.py` writes `verification-current.json`. The initial live verification confirmed 55 transparent replacements, including six with replacement votes. Processing continues; read the latest receipt rather than treating this count as a final total. Thirty-four of those replacements were also inspected in local contact sheets. Source-resolution and held-item reports remain in `quality-priority.json` and `/root/projects/semologo-png-repair/batch-*/held.json`.

The nine manual identities include both requested boundary institutions. KOFIH was upgraded further from its official AI/PDF ZIP to a true path-based SVG and 1200×437 transparent PNG, extracting the unchanged Signature A horizontal composition from PDF page 1. The official ZIP is retained as a download. The Korean Environmental Education Network uses its current official 413×69 transparent PNG. No PNG was wrapped in an SVG.

`sync-manual-coverage.cjs` updates only visually reviewed identities with exact official roster names, candidate-ID evidence and verified current asset hashes. Four newly linked ALIO institutions (eight category/aggregate membership rows) were recorded without changing the 342-institution denominator. It does not promote all automatically screened repairs to manually verified coverage.

`install-original-priority.py` orders the existing private AI/EPS/PDF/ZIP archive by current replacement/audit requests. Archived originals are review material, not public-logo completion. Restore its `.before-public-white-priority-20261025` backup only if removing that ordering is intended.

Next review work: resolve remaining unknown official sites, inspect held originals, and obtain native vectors or larger official artwork where a small transparent header was the only available improvement. Do not mark those follow-ups complete merely because a domain was inspected or a private file was stored.

Replacement vote counts are preserved. The deployed Firestore rules reject unauthenticated flag-reset writes (HTTP 403); no public flag reset is part of this pipeline. Resolved source evidence lives in `semologo.logo_quality_reviews`, which also prevents already-repaired unchanged votes from being requeued. Any legacy Firestore flag cleanup must use the authenticated administrator flow.

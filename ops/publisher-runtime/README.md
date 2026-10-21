# SemoLogo publication recovery — 2026-10-21

The Windows workers were online and still discovering sources. Public updates stopped because the Mac publication LaunchAgent was absent. Re-registering it exposed macOS `Operation not permitted` when launchd tried to read the external HDD script. No privacy protection was disabled.

The existing, tested publication pipeline now runs as the sole scheduled writer on NCP, independently of Mac login and removable-drive permissions. Windows discovery, original-file collection, request priority and composition planning retain their own schedules. This package changes only execution adapters (local Docker on Linux, tesseract discovery, approved runtime path) and retains the existing original-source, SVG safety, identity/OCR, immutable object, public readback, transaction and retry guards.

Runtime: `/root/projects/semologo-publisher/`. Python/dependencies reuse `/root/projects/semologo-auto-fleet/.venv`; OCR uses `/usr/bin/tesseract`. Only existing bucket access-key/secret variables are read from the private fleet server environment inside the root-only runner. Credentials are never logged, copied to Windows, or written into this package.

State transfer preserved the precise Mac cursor and its twelve pending download retries after the Mac process completed. The old Mac LaunchAgent was removed from launchd and archived under 1F `collector-recovery-20261021/disabled-mac-launchagent.plist`. Its previous state and source objects were preserved. The separate old NCP `semologo-auto-fleet/fleet-auto-state` cursor was not substituted or advanced.

The timer waits five minutes after a run finishes, processing two bounded batches of at most 200 jobs each. A single local flock prevents overlap. Memory is capped at 512 MiB, swap disabled and CPU capped at 50% of one core. Publication errors preserve the cursor; transient downloads retain the existing three-attempt retry behavior. A successful fleet job or held candidate is never reported as a newly published logo.

Recovery evidence on 1F: `/Volumes/HDD-1TB/semologo-migration/collector-recovery-20261021/`. The first Mac recovery batch consumed 100 completed jobs, reviewed and published eleven genuinely new brands, held 495 candidates, recorded zero publication errors and retained twelve retry downloads. All eleven public brand pages returned valid HTML. Source-count statistics refer to discovery jobs, not published logos.

Operations:
- `systemctl status semologo-publisher.service`
- `systemctl list-timers semologo-publisher.timer`
- `journalctl -u semologo-publisher.service`
- `fleet-auto-state/cursor.json` and each batch `receipt.json` are the authoritative publication evidence.
- Stop new runs with `systemctl disable --now semologo-publisher.timer`. Allow a running writer to finish before copying its cursor or resuming a manual Mac writer. Do not enable both publishers.

Raw downloaded working files and receipts are retained privately on NCP; published immutable original SVG and PNG bytes remain in `vibers-bucket`. Mac copies and verification artifacts stay on 1F HDD. No external SSD location is introduced.

Tests: the seven existing publication guard/cursor/retry tests pass; Linux dependencies, English OCR and dry-run execution were checked before the scheduled writer started. The reusable improvement is an execution adapter for the existing publisher, not a replacement collection/validation module.

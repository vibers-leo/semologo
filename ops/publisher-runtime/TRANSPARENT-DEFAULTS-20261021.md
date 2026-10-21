# Shared transparent representatives — 2026-10-21

## Incident and DB identity
Representative GET/PATCH failed because node-postgres sent statement_timeout as a PostgreSQL startup parameter, which PgBouncer rejects with 08P01. Same logical database/account before and after the PgBouncer routing change: vibers_main / vibers. No database rollback or migration was performed. The source fix uses query_timeout instead.

## Common serving policy
Shared PostgreSQL values are the source of truth for everyone, including anonymous users. Existing reviewed transparent defaults are read from semologo.logo_background_previews (81,688 records at audit time). Explicit valid CMS presentation choices take precedence; hidden/rejected assets remain excluded. Catalog/search API, home initial render and detail server render resolve these values before sending the page. Client-side fetching remains for live updates. Selected representatives do not fall back to opaque source SVG/PNG if the selected file is unavailable. Downloads retain original available vector assets.

## Existing publisher automation
No second scheduler or independent writer was introduced. The Windows fleet/queue and existing NCP publisher timer remain in place. The publisher already requires first-party SVG safety, transparent alpha, no white backdrop, and identity/OCR validation.
- New approved logos persist presentation in the shared CMS.
- Existing logos with an already-good transparent default keep the same artwork/form; missing shared values are persisted.
- A confirmed white-canvas default can be replaced by the newly verified transparent asset. Immutable uploads and CDN byte readback precede a compare-and-swap CMS update, with source/candidate hashes and auto_presentation evidence.
- Hidden/merged records, concurrent edits, non-owned paths and unverified assets are not promoted.

## Resource recovery
The existing publisher hit its previous 512 MiB cgroup cap. A service-specific drop-in sets MemoryHigh=640M, MemoryMax=768M, MemorySwapMax=0. The next real cycle completed successfully, with 682,393,600-byte peak memory, 2 new published logos plus 1 existing transparent-default persistence, zero publish errors. Receipt: batch-20261021T113822Z-f3e47b9f/receipt.json (2026-10-21T11:41:09Z).

A pre-raster canvas guard now rejects unknown, nonfinite, extreme-aspect or >4M-pixel SVG output before Cairo allocation. The normal real official SVG replay and pathological tall-SVG rejection both passed.

## Validation
- Candidate production build and TypeScript passed.
- Anonymous public representative/catalog requests returned HTTP200 and identical PNG choices for MTM and Cheongju.
- Real DB save/readback tested inside a rolled-back transaction; original value/timestamp preserved.
- Unauthenticated PATCH still returns403.
- Shared-default policy regression checks: valid manual precedence, PNG-only defaults, hidden/rejected exclusion, no opaque fallback.
- 20 stored defaults sampled deterministically by md5(id): 20/20 transparent and nonempty; light/dark contact sheet visually inspected.
- Live auto-published records vdpresearch-de and tredio-io contain presentation; fryazino-net has a persisted existing transparent default. No mass all-corpus image revalidation is claimed.

## Isolation and rollback
The app build branch starts from the exact running revision d39afa52eb3009e68d362c53bf52970a58cf3577 and includes only the task changes. Unrelated dirty/staged work in the original main checkout was preserved. Matching source fixes were also integrated into that main checkout without pushing it to production.
Backups and receipts: /root/ops/semologo-representative-recovery-20261021 and this 1F HDD folder. App rollback: tag semologo:before-shared-defaults-20261021 as semologo:latest and recreate only semologo using its existing compose file; this retains the DB connectivity hotfix. Publisher rollback: restore fleet-auto-publish.before.py and fleet-auto-core.before.py atomically between runs. Remove only transparent-defaults-memory.conf to restore the earlier limit (note that the prior 512MiB cap caused OOM). No original logo or DB record was deleted.

## Remaining scope
Existing transparent defaults are now shared correctly. Remaining historical white-canvas logos still require a verified transparent asset; the pipeline handles them as collection/review succeeds. This change does not mean every historical logo has been revalidated or repaired.

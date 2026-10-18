# Ranked Korean domain feeder — 2026-10-18

The Common Crawl-only global feeder kept both Windows workers busy but its first
11 recovered jobs produced 88 held assets and zero publishable logos. Keep the
first-party SVG, identity OCR and CMS review gates unchanged. Improve discovery
input instead of promoting PNG or unverified assets.

`prepare-ranked-korea-domains-20261018.py` reads the existing, audited
Tranco/Majestic SQLite rank corpus, selects `.kr` hosts present in either
ranked source, removes the completed Korean Wikidata cohort, and prioritizes
public institutions/organizations before other ranked sites. This yielded
4,439 distinct website candidates (2,220 for win-01; 2,219 for win-02).
These are candidate sites, not logos or publication evidence. The compressed
seeds are immutable and checked by SHA-256 before upload and worker scheduling.

The r48 feeder runs before exhausted r47, ranked r49 and the global r45 fallback,
using the existing two queued jobs per worker limit. It adds no new worker
handler, container build or publication permission. The five-minute Mac
publisher continues to accept only verified first-party SVG assets.

The next priority lane, r49, uses the same audited corpus's Tranco ranks
11,000 onward, excluding `.kr` domains assigned to the Korean lane. It adds
984,400 unique website candidates (492,200 per worker) ahead of the
Common Crawl-only fallback. Rank is a discovery order, never identity or logo
evidence; the publication gate is unchanged.

Verification: both seed objects read back from the private bucket with matching
hashes; `node --check`, `bash -n` and Python compilation pass; server dry run
parsed the first shard and proposed a bounded job. After activation, confirm
both worker results, a publisher receipt, and any published brand on the live
site. A zero-publish batch is a discovery yield signal, not grounds to relax
the review gate.

Operational check at 16:51 KST: r48 completed on both Windows workers and
continued to receive jobs. Its first reviewed Korean assets were mostly PNG
or SVGs that failed identity/quality screening, so none were auto-published in
the sampled batches. Three r49 pilot jobs (two win-01, one win-02) completed;
the Mac publisher consumed their results and held the sample candidates with
zero publish errors. The live service remains healthy and the previous
Common Crawl lane can continue after both ranked cohorts are exhausted.

Rollback r49 to the server `.before-tranco-r49` wrapper, or restore the
pre-r48 wrapper from `.before-ranked-r48` to remove both new lanes. Existing
queued jobs can finish; no published data is removed. The global feeder
remains available.

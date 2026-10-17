# Existing-logo enrichment

The Windows domain feeder discovers URLs every 10 seconds; it does not publish artwork. The Mac stages first-party bytes for review. The private catalog audit routes exact-domain matches to an existing-brand update first. Name-only and ambiguous matches require explicit identity review.

The `com.vibers.semologo.enrichment-maintenance` LaunchAgent runs hourly on the Mac. It verifies 1,000 advertised assets per run, using current CMS paths for the bounded window, and rebuilds a private candidate queue. One failed CDN request is marked for recheck, not treated as proof of a broken asset. Its first snapshot contains 183,174 brands from 2026-10-17; after each complete sweep, it refreshes the catalog from the CMS, including newer brands, and starts the next cycle. The agent never publishes logos.

For a visually reviewed exact match, `scripts/publish-reviewed-fleet-enrichment.py` adds immutable source files and variant entries to the existing current CMS version. It keeps the original representative, root `logo.svg`/`logo.png`, and any existing `variants.json` entries. The applied Karur Vysya Bank manifest in `data/collection/` shows the expected review evidence and source hashes. A repeated run is a no-op.

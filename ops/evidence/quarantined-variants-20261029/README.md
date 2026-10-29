# Quarantined composition fallback regression

The current CMS manifest is authoritative even when `variants` is empty. Previously API and logo-wall selection treated empty as absent and restored bundled/CDN compositions. Missing or malformed manifests and API database outages still retain the existing archive fallback.

Changed source: `src/app/api/logo-variants/route.ts`, `src/lib/logo-wall-manifest.ts`, `src/lib/brands.ts`, `src/lib/client-variants.ts`.

Regression command:

```
bash scripts/with-local-storage.sh node scripts/check-quarantined-variants.cjs
```

Result: PASS. The harness transpiles and executes the actual route GET, server/CDN fetcher, client fetcher/cache and logo-wall helper. Only external database/network dependencies are simulated. Cases: CMS empty containing quarantined artwork; CMS nonempty; missing/null/malformed CMS; database outage fallback; invalid ID; repeated client opening; a subsequent network failure preserving cached empty; CDN empty staying distinct from absent.

No database updates, publication, representative-setting writes, staging, commits or deployment performed. Manual representatives are not touched.

Scope limitation: BrandInner still allows independently probed raster derivatives with a valid empty manifest; rejected_asset_files must include quarantined derivatives. This patch prevents stale composition lists returning, and does not globally equate catalog hidden status with invalid artwork.

Type check: `bash scripts/with-local-storage.sh npx tsc --noEmit --incremental false` exited 0.

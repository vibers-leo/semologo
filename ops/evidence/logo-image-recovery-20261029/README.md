# Logo image recovery — 2026-10-29

Observed production preview failures: `planet-computers`, `zurich`, `valtra`, `lets-go` returned HTTP 404 / `unsupported`; their stored SVGs returned 200 and carry embedded JPEG imagery. Browser-direct SVG loading can succeed, so these failures do not establish that every reported card error has the same cause or that R2 objects are missing.

The preview-only normalizer validates SVG structure with the unchanged strict validator, verifies JPEG signatures, bounds image count/decoded pixels/output/time, converts embedded JPEGs to PNG offline, and renders the original layout. No new SVG asset is published or reclassified as native vector. External references, scripts, entities and unsupported formats remain rejected. Actual four production files rendered successfully with the patched helper in the existing Linux runtime; production code was not modified by this test.

Card retries previously ran after 1.5s and 5s, both within the API's 15-second negative cache. Retry timing is now 2s then 16s; each retry uses a fresh cache-busting token. A separate keyed image element prevents events from an old source being attached to a new candidate. Existing manual representative selection remains unchanged.

Validation: offline decode/security tests; actual Linux source/render checks; actual React CardLogo localhost transient-503 recovery fixture; TypeScript; guarded NCP deployment and live API/browser readback when recorded. Full catalogue/error-free service is not inferred from four samples.

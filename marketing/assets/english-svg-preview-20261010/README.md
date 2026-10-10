# English SVG preview preparation — 2026-10-10

Scope: 129,333 GLOBAL SVG brands imported 2026-09-18, original catalog sequence 51,173 through 180,509 (ZZN). 124,059 have no PNG flag. This includes digit/non-Latin names in the same import rather than silently dropping them. Full GLOBAL SVG A–Z initial name scope is 154,401, of which 123,368 have no PNG flag; that wider historical scope is not this manifest.

`scope.json` lists every target in reverse original sequence. No scrolling is needed.

Run from repository with local storage wrapper:

```sh
bash scripts/with-local-storage.sh python3 scripts/prepare-english-svg-previews-20261010.py \
  --source marketing/assets/english-svg-preview-20261010/source-cache \
  --fetch --workers 6 --limit 1000
```

`--limit 0` processes all remaining records. Completed IDs are skipped on restart. `--retry` retries failed/missing records. Source cache, derivatives and append-only progress all remain on HDD. Subprocess renders have a 30-second timeout. Full scope may take many hours; do not run a second writer to the same output directory. Read progress.jsonl while running; summary.json is updated every 100 records and after each run. Source SVG originals are hardlinked where possible and never edited.

Preview long edge is 640 pixels, preserving aspect ratio. Transparent margin is trimmed from the derivative only. No global white-pixel removal occurs. Explicit full-viewBox white rectangle/path candidates produce separate candidate-transparent.svg and PNG for visual review; whites in artwork remain. Opaque logos, filter effects requiring renderer review, active/external SVG and raster wrappers are held for review. Native-alpha-rendered means unchanged vector geometry rendered successfully; verify representative contacts and assets before upload/publication. It does not mean published.

No credentials, CMS writes, uploads or catalog edits occur here. NCP canonical Object Storage sources are read only (the CDN audit was rate limited, so bulk preparation uses the canonical origin). Publish immutable derivatives only after checks, retain source hashes and verify stored/CDN bytes, then update preview metadata. Never import the 129k map into client JavaScript: persist verified preview metadata in server catalog/CMS or a server-only preview table joined into catalog API rows. Keep original SVG download and original source links intact.

Existing audit scanned only 45,656 historical local SVG originals, finding 397 full-canvas white candidates. The much larger import is absent from both local brand-logos worktrees/HEAD trees; fetch mode is required unless an origin archive becomes available. Existing optimize-logo-pngs.py forced both width and height to 320 and therefore can distort artwork; this pipeline does not use that renderer.

White negative-space lettering inside colored badges can depend on the original white canvas. Such logos require semantic review even if only a full-canvas path is removed. The initial release holds Zywiec, Zywiec Lato, ZZM, Zwets Elektro, Zvonche and Zweifel; originals remain served. Never auto-publish background-removal candidates based only on alpha percentage.

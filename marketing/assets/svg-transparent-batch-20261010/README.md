# English SVG preview first batch — 2026-10-10

30 visually reviewed Z entries. Sources are existing collected SVGs; this release makes no new official-source claim.

Each has an immutable original SVG, a cleaned SVG, a cropped PNG preview (at most 640 px), and a PNG download (long edge 1766–2000 px). Remove only the first explicit white canvas path `M0 0h192.756v192.756H0V0z` when the viewBox is exactly `0 0 192.756 192.756`. All other white shapes and colored fields stay untouched. No raster flood fill.

Light/dark contact sheets reviewed. Original SVGs with canvas remain available as variants. Preview PNG sizes: 6.6–126.3 KB, median 17.6 KB.

Excluded: `zzn` has a solid colored rectangular brand panel after canvas removal, so its cropped result is genuinely opaque; `zycie` contains embedded raster artwork and is not passed off as a true vector. Neither source was altered.

`release.json`, `uploads.json`, `decisions.json` are ready for root publishing. No production mutation performed by this agent. `prepare-svg-transparent-batch-20261010.py` regeneration marks candidates awaiting visual review; publish only after review.

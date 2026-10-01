#!/usr/bin/env python3
"""Prepare a reviewable JSON manifest for importing newly collected assets as CMS drafts."""
import json, glob
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
out = ROOT / "data/collection/logo-post-drafts.json"
rows = []
for path in sorted(glob.glob(str(ROOT / "public/submissions/index-candidates/*"))):
    p = Path(path)
    if p.suffix.lower() not in {".svg", ".png"}:
        continue
    ticker = p.stem.upper()
    rows.append({
        "id": f"us-russell-2000-{ticker.lower()}",
        "name_ko": ticker,
        "name_en": ticker,
        "category": "서비스·기업",
        "origin": "GLOBAL",
        "status": "draft",
        "logo_svg": f"/submissions/index-candidates/{p.name}" if p.suffix.lower() == ".svg" else None,
        "logo_png": f"/submissions/index-candidates/{p.name}" if p.suffix.lower() == ".png" else None,
        "asset_origin": "Russell 2000 공식 도메인 후보 · 관리자 검수 대기",
    })
out.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n")
print(f"prepared {len(rows)} CMS drafts: {out}")

#!/usr/bin/env python3
"""Extract 2025 KDB CI compositions from the bank's downloaded Illustrator ZIPs."""

import hashlib
import json
import subprocess
from pathlib import Path

import fitz
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "marketing/assets/official-next-20261013"
SOURCE = ASSETS / "kdb-extracted"
FORMS = {
    "ko-horizontal": ("2025_KDB_CI_SC_Kor_AI-0.ai", (165, 235, 620, 332), 1600),
    "ko-vertical": ("2025_KDB_CI_SC_Kor_AI-1.ai", (9, 10, 214, 139), 1000),
    "symbol": ("2025_KDB_CI_SC_Kor_AI-1.ai", (68, 12, 156, 89), 1000),
    "wordmark": ("2025_KDB_CI_Kor_AI-1.ai", None, 1600),
    "en-horizontal": ("2025_KDB_CI_SC_Eng_AI-0.ai", (165, 225, 620, 332), 1600),
    "en-vertical": ("2025_KDB_CI_SC_Eng_AI-1.ai", (9, 10, 214, 139), 1000),
    "en-wordmark": ("2025_KDB_CI_Eng_AI-0.ai", None, 1600),
}


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    inventory = {row["file"]: row for row in json.loads((SOURCE / "inventory.json").read_text())}
    results = {}
    for name, (filename, crop, width) in FORMS.items():
        original = SOURCE / filename
        assert sha(original) == inventory[filename]["sha256"]
        doc = fitz.open(original)
        page = doc[0]
        if crop:
            page.set_cropbox(fitz.Rect(*crop))
        svg = SOURCE / f"{name}.svg"
        png = SOURCE / f"{name}.png"
        svg.write_text(page.get_svg_image(text_as_path=True))
        doc.close()
        subprocess.run(["inkscape", str(svg), f"--export-filename={png}", f"--export-width={width}"], check=True)
        with Image.open(png) as image:
            assert image.mode == "RGBA" and image.getpixel((0, 0))[3] == 0
            assert image.getbbox(), f"empty: {name}"
            dimensions = image.size
        results[name] = {"source": filename, "source_sha256": sha(original),
                         "crop_points": list(crop) if crop else None,
                         "png_size": list(dimensions), "svg_sha256": sha(svg), "png_sha256": sha(png)}
        print(name, dimensions, flush=True)
    (SOURCE / "forms.json").write_text(json.dumps({"status": "extracted-awaiting-final-visual-review",
                                                 "forms": results}, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Extract reviewed KPTB lockups from its official PDF-compatible AI file."""

import hashlib
import json
import subprocess
from pathlib import Path

import fitz
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "marketing/assets/official-next-20261013"
SOURCE = ASSETS / "kptb-ci.ai"
FORMS = {
    "ko-vertical": ((65, 288, 250, 403), 800),
    "symbol": ((102, 289, 196, 360), 800),
    "wordmark": ((78, 362, 223, 402), 800),
}


def main() -> None:
    source_sha256 = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    results = {}
    for name, (coords, width) in FORMS.items():
        doc = fitz.open(SOURCE)
        page = doc[0]
        page.set_cropbox(fitz.Rect(*coords))
        svg_path = ASSETS / f"{name}.svg"
        png_path = ASSETS / f"{name}.png"
        svg_path.write_text(page.get_svg_image(text_as_path=True))
        doc.close()
        subprocess.run(
            ["inkscape", str(svg_path), f"--export-filename={png_path}", f"--export-width={width}"],
            check=True,
        )
        with Image.open(png_path) as image:
            assert image.mode == "RGBA" and image.getpixel((0, 0))[3] == 0
            assert image.getbbox(), f"empty crop: {name}"
            size = image.size
        results[name] = {
            "crop_points": list(coords),
            "png_size": list(size),
            "svg_sha256": hashlib.sha256(svg_path.read_bytes()).hexdigest(),
            "png_sha256": hashlib.sha256(png_path.read_bytes()).hexdigest(),
        }
    record = {
        "source": SOURCE.name,
        "source_sha256": source_sha256,
        "status": "extracted-and-visually-reviewed-not-published",
        "variants": [
            "ko-horizontal", "ko-horizontal-reverse", "ko-vertical", "ko-vertical-reverse",
            "en-horizontal", "en-horizontal-reverse", "symbol", "wordmark",
        ],
        "corrected_and_added": results,
    }
    (ASSETS / "kptb-extracted.json").write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"source_sha256": source_sha256, "forms": results}, ensure_ascii=False))


if __name__ == "__main__":
    main()

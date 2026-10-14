#!/usr/bin/env python3
"""Extract Korean wordmark paths from reviewed Chungnam horizontal vector."""

import hashlib
import json
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "marketing/assets/user-identities-20261010/south-chungcheong/ko-horizontal.svg"
OUT = ROOT / "marketing/assets/south-chungcheong-wordmark-20261014"
INKSCAPE = "/Applications/Inkscape.app/Contents/MacOS/inkscape"
EXPECTED_SOURCE = "2f0286bd133606f0"


def sha(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    raw = SOURCE.read_bytes()
    assert sha(raw).startswith(EXPECTED_SOURCE), "source variant changed"
    root = ET.fromstring(raw)
    assert len(root) == 25
    ns = "{http://www.w3.org/2000/svg}"
    retained = {f"art{i}" for i in range(269, 278)}
    assert {p.get("id") for p in root if p.get("id") in retained} == retained
    for path in list(root):
        if path.get("id") not in retained:
            root.remove(path)
    # Inkscape object bounds from the reviewed source, plus 3 units of clear space.
    x0, y0, x1, y1 = 109.191, 14.002, 269.118, 63.902
    bx, by = 183.561, 293.002
    root.set("viewBox", f"{bx + x0:.3f} {by + y0:.3f} {x1 - x0:.3f} {y1 - y0:.3f}")
    root.set("width", f"{x1 - x0:.3f}")
    root.set("height", f"{y1 - y0:.3f}")
    ET.register_namespace("", ns[1:-1])
    svg = ET.tostring(root, encoding="utf-8", xml_declaration=True)
    (OUT / "ko-wordmark.svg").write_bytes(svg)
    subprocess.run([INKSCAPE, str(OUT / "ko-wordmark.svg"), "--export-type=png",
                    "--export-width=2400", f"--export-filename={OUT / 'ko-wordmark.png'}"],
                   check=True, capture_output=True)
    from PIL import Image
    with Image.open(OUT / "ko-wordmark.png") as image:
        alpha = image.convert("RGBA").getchannel("A")
        assert image.width == 2400 and alpha.getextrema() == (0, 255)
        size = image.size
    report = {"source_variant": "ko-horizontal", "source_svg_sha256": sha(raw),
              "retained_paths": sorted(retained), "svg_sha256": sha(svg),
              "png_sha256": sha((OUT / "ko-wordmark.png").read_bytes()), "png_size": size,
              "status": "extracted-awaiting-visual-review"}
    (OUT / "extraction.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()

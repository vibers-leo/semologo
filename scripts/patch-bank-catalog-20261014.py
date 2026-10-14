#!/usr/bin/env python3
"""Patch only two reviewed bank objects in backed-up CDN catalogs."""

import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "marketing/assets/catalog-bank-patch-20261014"
PATCHES = {
    "gongu-ci-1395": {"name_ko": "한국공공조직은행", "name_en": "Korea Public Tissue Bank",
                      "has_svg": True, "logo_svg": "logo.svg", "variants_n": 9},
    "gongu-ci-1628": {"name_en": "Korea Development Bank",
                      "has_svg": True, "logo_svg": "logo.svg", "variants_n": 8},
}


def sha(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def object_range(raw: bytes, ident: str) -> tuple[int, int]:
    marker = ('{"id":"' + ident + '"').encode()
    start = raw.find(marker)
    assert start >= 0 and raw.find(marker, start + 1) < 0, f"missing or duplicate: {ident}"
    depth = 0
    quoted = escaped = False
    for i in range(start, len(raw)):
        ch = raw[i]
        if quoted:
            if escaped:
                escaped = False
            elif ch == 92:
                escaped = True
            elif ch == 34:
                quoted = False
        elif ch == 34:
            quoted = True
        elif ch == 123:
            depth += 1
        elif ch == 125:
            depth -= 1
            if depth == 0:
                return start, i + 1
    raise ValueError(f"unterminated object: {ident}")


def main() -> None:
    original = json.loads((WORK / "before.json").read_text())
    report = {}
    for filename in ("brands-slim.json", "brands.json"):
        before = (WORK / (filename + ".before")).read_bytes()
        assert sha(before) == original[filename]["sha256"]
        raw = before
        changes = []
        for ident, patch in PATCHES.items():
            start, end = object_range(raw, ident)
            item = json.loads(raw[start:end])
            assert item["id"] == ident and item.get("has_svg") is False
            assert item.get("has_png") is True
            assert not item.get("logo_svg")
            fields = {key: value for key, value in patch.items()
                      if filename == "brands.json" or key not in ("logo_svg", "variants_n")}
            item.update(fields)
            replacement = json.dumps(item, ensure_ascii=False, separators=(",", ":")).encode()
            changes.append((start, end, replacement, ident))
        for start, end, replacement, _ in sorted(changes, reverse=True):
            raw = raw[:start] + replacement + raw[end:]
        for ident in PATCHES:
            start, end = object_range(raw, ident)
            item = json.loads(raw[start:end])
            assert item["has_svg"] is True and item["name_en"]
            if filename == "brands.json":
                assert item["logo_svg"] == "logo.svg"
        output = WORK / (filename + ".after")
        output.write_bytes(raw)
        report[filename] = {"before_sha256": sha(before), "after_sha256": sha(raw),
                            "before_bytes": len(before), "after_bytes": len(raw),
                            "changed_ids": list(PATCHES)}
        print(filename, report[filename], flush=True)
    (WORK / "patch.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()

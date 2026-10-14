#!/usr/bin/env python3
"""Retry five early SVG-background failures after verifying source artifacts."""

import json
import runpy
from pathlib import Path

import boto3
from botocore.config import Config


ROOT = Path(__file__).resolve().parents[1]
IDS = {"zzgt", "zzsd", "zzn-1", "zygo", "zymetx"}
AUDIT = ROOT / "marketing/assets/svg-full-audit-20261013/progress.jsonl"
OUT = ROOT / "marketing/assets/svg-background-publish-20261014/retry-five.json"


def main() -> None:
    pub = runpy.run_path(str(ROOT / "scripts/publish-svg-background-audit-20261014.py"))
    latest = {}
    for line in AUDIT.open():
        try:
            item = json.loads(line)
        except ValueError:
            continue
        if item.get("id") in IDS:
            latest[item["id"]] = item
    assert set(latest) == IDS
    for item in latest.values():
        assert item["status"] == "background-removal-awaiting-review"
        pub["verify_candidate"](item)

    creds = pub["secrets"]()
    db = pub["database"](creds["DB_VIBERS_MAIN_URL"])
    s3 = boto3.client(
        "s3", endpoint_url="https://kr.object.ncloudstorage.com", region_name="kr-standard",
        aws_access_key_id=creds["NCP_ACCESS_KEY"], aws_secret_access_key=creds["NCP_SECRET_KEY"],
        config=Config(signature_version="s3v4", request_checksum_calculation="when_required",
                      response_checksum_validation="when_required"),
    )
    report = []
    for ident in sorted(IDS):
        item = latest[ident]
        with db.cursor() as cursor:
            cursor.execute("SELECT source_sha256 FROM semologo.logo_background_previews WHERE id=%s", (ident,))
            row = cursor.fetchone()
        if row:
            assert row[0] == item["source_sha256"], ident
            report.append({"id": ident, "status": "already-published"})
            continue
        result = pub["publish"](item, s3)
        with db, db.cursor() as cursor:
            cursor.execute("""INSERT INTO semologo.logo_background_previews
                (id,png_file,svg_file,source_sha256,candidate_sha256)
                VALUES (%s,%s,%s,%s,%s) ON CONFLICT (id) DO NOTHING""", result)
            cursor.execute("SELECT source_sha256 FROM semologo.logo_background_previews WHERE id=%s", (ident,))
            assert cursor.fetchone()[0] == item["source_sha256"]
        report.append({"id": ident, "status": "published", "png_file": result[1]})
        print(ident, "published", flush=True)
    db.close()
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()

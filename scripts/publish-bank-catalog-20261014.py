#!/usr/bin/env python3
"""Upload two narrowly patched, backed-up catalog JSON files to Object Storage."""

import hashlib
import json
import runpy
from pathlib import Path

import boto3
from botocore.config import Config


ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "marketing/assets/catalog-bank-patch-20261014"
BUCKET = "vibers-bucket"


def sha(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def main() -> None:
    assert not (WORK / "published.json").exists(), "already published"
    before = json.loads((WORK / "before.json").read_text())
    patch = json.loads((WORK / "patch.json").read_text())
    publisher = runpy.run_path(str(ROOT / "scripts/publish-svg-background-audit-20261014.py"))
    secrets = publisher["secrets"]()
    s3 = boto3.client("s3", endpoint_url="https://kr.object.ncloudstorage.com", region_name="kr-standard",
        aws_access_key_id=secrets["NCP_ACCESS_KEY"], aws_secret_access_key=secrets["NCP_SECRET_KEY"],
        config=Config(signature_version="s3v4", request_checksum_calculation="when_required",
                      response_checksum_validation="when_required"))
    files = ("brands.json", "brands-slim.json")
    # Check both before the first write, so concurrent catalog publication aborts safely.
    metadata = {}
    for filename in files:
        original = (WORK / (filename + ".before")).read_bytes()
        changed = (WORK / (filename + ".after")).read_bytes()
        assert sha(original) == before[filename]["sha256"] == patch[filename]["before_sha256"]
        assert sha(changed) == patch[filename]["after_sha256"]
        head = s3.head_object(Bucket=BUCKET, Key="_clients/" + filename)
        assert head["ETag"] == before[filename]["etag"], f"catalog changed concurrently: {filename}"
        metadata[filename] = {"etag": head["ETag"], "cache_control": head.get("CacheControl")}

    verified = {}
    for filename in files:
        changed = (WORK / (filename + ".after")).read_bytes()
        s3.put_object(Bucket=BUCKET, Key="_clients/" + filename, Body=changed,
                      ACL="public-read", ContentType="application/json; charset=utf-8",
                      CacheControl=metadata[filename]["cache_control"] or "public,max-age=60")
        saved = s3.get_object(Bucket=BUCKET, Key="_clients/" + filename)["Body"].read()
        assert sha(saved) == sha(changed), f"upload mismatch: {filename}"
        verified[filename] = {"sha256": sha(saved), "bytes": len(saved)}
        print(filename, verified[filename], flush=True)
    (WORK / "published.json").write_text(json.dumps(verified, indent=2) + "\n")


if __name__ == "__main__":
    main()

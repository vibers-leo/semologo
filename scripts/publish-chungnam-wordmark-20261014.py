#!/usr/bin/env python3
"""Merge reviewed Chungnam wordmark into the existing logo composition set."""

import hashlib
import json
import runpy
import subprocess
from pathlib import Path

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from logo_variant_enrichment import coverage


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "marketing/assets/south-chungcheong-wordmark-20261014"
BRAND = "south-chungcheong"
BUCKET = "vibers-bucket"


def sha(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def main() -> None:
    assert not (OUT / "published.json").exists(), "already published"
    extraction = json.loads((OUT / "extraction.json").read_text())
    assert extraction["status"] == "extracted-awaiting-visual-review"
    pub = runpy.run_path(str(ROOT / "scripts/publish-svg-background-audit-20261014.py"))
    secrets = pub["secrets"]()
    db = pub["database"](secrets["DB_VIBERS_MAIN_URL"])
    s3 = boto3.client("s3", endpoint_url="https://kr.object.ncloudstorage.com", region_name="kr-standard",
        aws_access_key_id=secrets["NCP_ACCESS_KEY"], aws_secret_access_key=secrets["NCP_SECRET_KEY"],
        config=Config(signature_version="s3v4", request_checksum_calculation="when_required",
                      response_checksum_validation="when_required"))
    with db.cursor() as cursor:
        cursor.execute("SELECT payload,status FROM semologo.logo_posts WHERE id=%s", (BRAND,))
        post = cursor.fetchone()
        cursor.execute("SELECT id,asset_manifest FROM semologo.logo_versions WHERE brand_id=%s AND is_current", (BRAND,))
        version = cursor.fetchone()
    assert post and post[1] == "published" and post[0]["name_ko"] == "충청남도"
    assert version and isinstance(version[1].get("variants"), dict)
    manifest = version[1]["variants"]
    assert manifest["id"] == BRAND and len(manifest["variants"]) == 27
    assert not any(v["key"] == "ko-wordmark" for v in manifest["variants"])
    existing = s3.get_object(Bucket=BUCKET, Key=f"_clients/{BRAND}/variants.json")["Body"].read()
    assert json.loads(existing) == manifest, "CDN and CMS manifests differ"
    source_file = next(v["files"]["svg"] for v in manifest["variants"] if v["key"] == "ko-horizontal")
    source = s3.get_object(Bucket=BUCKET, Key=f"_clients/{BRAND}/{source_file}")["Body"].read()
    assert sha(source) == extraction["source_svg_sha256"]

    files = {}
    for ext, mime in (("svg", "image/svg+xml"), ("png", "image/png")):
        raw = (OUT / f"ko-wordmark.{ext}").read_bytes()
        assert sha(raw) == extraction[f"{ext}_sha256"]
        relative = f"sources/chungnam-wordmark-20261014/{sha(raw)[:20]}.{ext}"
        key = f"_clients/{BRAND}/{relative}"
        try:
            assert s3.get_object(Bucket=BUCKET, Key=key)["Body"].read() == raw, "immutable conflict"
        except ClientError as error:
            if error.response.get("Error", {}).get("Code") not in ("404", "NoSuchKey", "NotFound"):
                raise
            s3.put_object(Bucket=BUCKET, Key=key, Body=raw, ACL="public-read", ContentType=mime,
                          CacheControl="public,max-age=31536000,immutable", Metadata={"sha256": sha(raw)})
            assert s3.get_object(Bucket=BUCKET, Key=key)["Body"].read() == raw
        public_url = f"https://logo.vibers.co.kr/_clients/{BRAND}/{relative}"
        served = subprocess.run(["curl", "-fsSL", "--max-time", "30", public_url],
                                capture_output=True, check=True).stdout
        assert sha(served) == sha(raw), "public asset mismatch"
        files[ext] = relative

    updated = dict(manifest)
    updated["variants"] = [*manifest["variants"], {
        "key": "ko-wordmark", "label": "국문 글자형 · 공식 CI에서 분리", "form": "wordmark",
        "lockup": "wordmark", "lang": "ko", "color": "original", "light": False,
        "files": files, "origin": "manual", "provider": "사용자 제공 공식 AI · 가로조합에서 분리 검수",
        "derived_from": "BS2-04.ai", "source_file": source_file,
        "source_sha256": extraction["source_svg_sha256"], "visual_sha256": extraction["svg_sha256"],
        "order": len(manifest["variants"]) + 1, "asset_group": "logotype",
    }]
    assert coverage(updated)["complete"]
    (OUT / "publication-before.json").write_text(json.dumps({"post": post[0], "version_id": version[0],
        "asset_manifest": version[1]}, ensure_ascii=False, indent=2) + "\n")
    with db, db.cursor() as cursor:
        cursor.execute("SELECT asset_manifest FROM semologo.logo_versions WHERE id=%s AND is_current FOR UPDATE", (version[0],))
        assert cursor.fetchone()[0] == version[1], "version changed"
        additional_files = [{"id": BRAND, "key": f"_clients/{BRAND}/{relative}",
                             "file": f"marketing/assets/south-chungcheong-wordmark-20261014/ko-wordmark.{ext}",
                             "sha256": extraction[f"{ext}_sha256"]}
                            for ext, relative in files.items()]
        revised_asset_manifest = {**version[1], "files": [*version[1].get("files", []), *additional_files],
                                  "variants": updated}
        cursor.execute("UPDATE semologo.logo_versions SET asset_manifest=%s::jsonb,review_status='verified',verified_at=now() WHERE id=%s",
                       (json.dumps(revised_asset_manifest, ensure_ascii=False), version[0]))
        patch = {"variants_n": len(updated["variants"]), "asset_review_status": "verified"}
        cursor.execute("UPDATE semologo.logo_posts SET payload=payload||%s::jsonb,updated_at=now() WHERE id=%s",
                       (json.dumps(patch, ensure_ascii=False), BRAND))
        cursor.execute("UPDATE semologo.logo_versions SET review_status='verified',verified_at=now() "
                       "WHERE brand_id=%s AND is_current AND asset_manifest->'variants'->'variants' @> %s::jsonb RETURNING id",
                       (BRAND, json.dumps([{"key": "ko-wordmark"}])))
        current = cursor.fetchall()
        assert len(current) == 1
    manifest_raw = (json.dumps(updated, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
    s3.put_object(Bucket=BUCKET, Key=f"_clients/{BRAND}/variants.json", Body=manifest_raw,
                  ACL="public-read", ContentType="application/json", CacheControl="public,max-age=60")
    assert s3.get_object(Bucket=BUCKET, Key=f"_clients/{BRAND}/variants.json")["Body"].read() == manifest_raw
    db.close()
    report = {"brand_id": BRAND, "version_id": current[0][0], "variants": len(updated["variants"]),
              "coverage": coverage(updated), "files": files}
    (OUT / "published.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()

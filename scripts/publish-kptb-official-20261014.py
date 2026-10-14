#!/usr/bin/env python3
"""Publish reviewed KPTB official CI forms into its existing CMS identity."""

import hashlib
import json
import runpy
from pathlib import Path

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from logo_variant_enrichment import coverage


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "marketing/assets/official-next-20261013"
BRAND = "gongu-ci-1395"
BUCKET = "vibers-bucket"
FORMS = (
    ("ko-horizontal", "horizontal", "국문 가로조합", "ko", "original"),
    ("ko-vertical", "vertical", "국문 세로조합", "ko", "original"),
    ("symbol", "symbol", "심볼", "none", "original"),
    ("wordmark", "wordmark", "글자형", "ko", "original"),
    ("en-horizontal", "horizontal", "영문 가로조합", "en", "original"),
    ("ko-horizontal-reverse", "horizontal", "국문 가로조합 반전", "ko", "reverse"),
    ("ko-vertical-reverse", "vertical", "국문 세로조합 반전", "ko", "reverse"),
    ("en-horizontal-reverse", "horizontal", "영문 가로조합 반전", "en", "reverse"),
)


def digest(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def main() -> None:
    assert not (ASSETS / "kptb-published.json").exists(), "already published"
    extraction = json.loads((ASSETS / "kptb-extracted.json").read_text())
    assert extraction["status"] == "extracted-and-visually-reviewed-not-published"
    source = (ASSETS / "kptb-ci.ai").read_bytes()
    assert digest(source) == extraction["source_sha256"]

    publisher = runpy.run_path(str(ROOT / "scripts/publish-svg-background-audit-20261014.py"))
    secrets = publisher["secrets"]()
    db = publisher["database"](secrets["DB_VIBERS_MAIN_URL"])
    s3 = boto3.client(
        "s3", endpoint_url="https://kr.object.ncloudstorage.com", region_name="kr-standard",
        aws_access_key_id=secrets["NCP_ACCESS_KEY"],
        aws_secret_access_key=secrets["NCP_SECRET_KEY"],
        config=Config(signature_version="s3v4", request_checksum_calculation="when_required",
                      response_checksum_validation="when_required"),
    )

    with db.cursor() as cursor:
        cursor.execute("SELECT id,payload,status FROM semologo.logo_posts WHERE id=%s", (BRAND,))
        post = cursor.fetchone()
        cursor.execute(
            "SELECT id,asset_manifest FROM semologo.logo_versions WHERE brand_id=%s AND is_current",
            (BRAND,),
        )
        version = cursor.fetchone()
    assert post and post[2] == "published" and "한국공공조직은행" in post[1]["name_ko"]
    assert version, "current version missing"
    assert version[1] is None or version[1].get("variants", {}).get("primary") == "official-ko-horizontal"

    old_logo = s3.get_object(Bucket=BUCKET, Key=f"_clients/{BRAND}/logo.png")["Body"].read()
    old_digest = digest(old_logo)
    legacy_path = f"sources/legacy-before-official-20261014/{old_digest[:20]}.png"

    def put_immutable(relative: str, raw: bytes, mime: str) -> None:
        key = f"_clients/{BRAND}/{relative}"
        try:
            saved = s3.get_object(Bucket=BUCKET, Key=key)["Body"].read()
            assert saved == raw, f"immutable conflict: {key}"
        except ClientError as error:
            if error.response.get("Error", {}).get("Code") not in ("404", "NoSuchKey", "NotFound"):
                raise
            s3.put_object(Bucket=BUCKET, Key=key, Body=raw, ACL="public-read", ContentType=mime,
                          CacheControl="public,max-age=31536000,immutable", Metadata={"sha256": digest(raw)})
            assert s3.get_object(Bucket=BUCKET, Key=key)["Body"].read() == raw

    put_immutable(legacy_path, old_logo, "image/png")
    source_path = f"sources/official-kptb-20261014/{digest(source)[:20]}.ai"
    put_immutable(source_path, source, "application/postscript")

    variants = [{
        "key": "legacy-before-official", "form": "unknown", "lockup": "unknown",
        "lang": "ko", "color": "original", "label": "기존 수집본 · 흰 배경 PNG",
        "files": {"png": legacy_path}, "origin": "collected", "order": 0,
        "visual_sha256": old_digest,
    }]
    main = {}
    for index, (name, form, label, lang, color) in enumerate(FORMS, start=1):
        files = {}
        for extension, mime in (("svg", "image/svg+xml"), ("png", "image/png")):
            raw = (ASSETS / f"{name}.{extension}").read_bytes()
            relative = f"sources/official-kptb-20261014/{digest(raw)[:20]}.{extension}"
            put_immutable(relative, raw, mime)
            files[extension] = relative
            if name == "ko-horizontal":
                main[extension] = raw
        variants.append({
            "key": f"official-{name}", "form": form, "lockup": form,
            "lang": lang, "color": color, "label": f"{label} · 공식 CI",
            "files": files, "origin": "derived", "provider": "한국공공조직은행 공식 CI",
            "source_file": source_path, "source_sha256": digest(source),
            "visual_sha256": digest((ASSETS / f"{name}.svg").read_bytes()), "order": index,
        })
    manifest = {"schema": 1, "algo_v": 1, "id": BRAND,
                "primary": "official-ko-horizontal", "variants": variants}
    assert coverage(manifest)["complete"]

    before = {"post": post[1], "version_id": version[0], "asset_manifest": version[1],
              "old_logo_sha256": old_digest}
    (ASSETS / "kptb-publication-before.json").write_text(json.dumps(before, ensure_ascii=False, indent=2) + "\n")

    for extension, mime in (("svg", "image/svg+xml"), ("png", "image/png")):
        s3.put_object(Bucket=BUCKET, Key=f"_clients/{BRAND}/logo.{extension}", Body=main[extension],
                      ACL="public-read", ContentType=mime, CacheControl="public,max-age=60")
        assert s3.get_object(Bucket=BUCKET, Key=f"_clients/{BRAND}/logo.{extension}")["Body"].read() == main[extension]

    patch = {"name_ko": "한국공공조직은행", "name_en": "Korea Public Tissue Bank",
             "logo_svg": "logo.svg", "logo_png": True, "has_svg": True, "has_png": True,
             "variants_n": len(variants), "asset_review_status": "official-reviewed",
             "source_ai": source_path,
             "metadata": {**(post[1].get("metadata") or {}), "has_svg": True, "has_png": True}}
    with db, db.cursor() as cursor:
        cursor.execute("SELECT asset_manifest FROM semologo.logo_versions WHERE id=%s AND is_current FOR UPDATE", (version[0],))
        locked = cursor.fetchone()
        assert locked and locked[0] == version[1], "current version changed"
        cursor.execute("UPDATE semologo.logo_versions SET asset_manifest=%s::jsonb, review_status='verified', verified_at=now() WHERE id=%s",
                       (json.dumps({"variants": manifest}, ensure_ascii=False), version[0]))
        cursor.execute("UPDATE semologo.logo_posts SET payload=payload||%s::jsonb, updated_at=now() WHERE id=%s",
                       (json.dumps(patch, ensure_ascii=False), BRAND))
        # The logo_posts trigger creates a new current version when asset flags change.
        cursor.execute(
            "UPDATE semologo.logo_versions SET review_status='verified',verified_at=now() "
            "WHERE brand_id=%s AND is_current AND asset_manifest->'variants'->>'primary'='official-ko-horizontal' "
            "RETURNING id",
            (BRAND,),
        )
        current = cursor.fetchall()
        assert len(current) == 1, "official manifest was not carried to the current version"

    raw_manifest = (json.dumps(manifest, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
    s3.put_object(Bucket=BUCKET, Key=f"_clients/{BRAND}/variants.json", Body=raw_manifest,
                  ACL="public-read", ContentType="application/json", CacheControl="public,max-age=60")
    assert s3.get_object(Bucket=BUCKET, Key=f"_clients/{BRAND}/variants.json")["Body"].read() == raw_manifest
    db.close()
    report = {"brand_id": BRAND, "version_id": current[0][0], "variants": len(variants),
              "coverage": coverage(manifest), "source_sha256": digest(source)}
    (ASSETS / "kptb-published.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()

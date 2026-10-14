#!/usr/bin/env python3
"""Add 2025 official KDB CI forms to the existing Korean Development Bank item."""

import hashlib
import io
import json
import runpy
import subprocess
import zipfile
from pathlib import Path

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from logo_variant_enrichment import coverage


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "marketing/assets/official-next-20261013"
SOURCE = ASSETS / "kdb-extracted"
BRAND = "gongu-ci-1628"
BUCKET = "vibers-bucket"
FORM_INFO = (
    ("ko-horizontal", "horizontal", "ko", "국문 가로조합"),
    ("ko-vertical", "vertical", "ko", "국문 세로조합"),
    ("symbol", "symbol", "none", "심볼"),
    ("wordmark", "wordmark", "ko", "국문 글자형"),
    ("en-horizontal", "horizontal", "en", "영문 가로조합"),
    ("en-vertical", "vertical", "en", "영문 세로조합"),
    ("en-wordmark", "wordmark", "en", "영문 글자형"),
)


def sha(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def main() -> None:
    assert not (SOURCE / "published.json").exists(), "already published"
    extraction = json.loads((SOURCE / "forms.json").read_text())
    assert extraction["status"] == "extracted-awaiting-final-visual-review"
    downloaded = json.loads((ASSETS / "kdb-downloaded.json").read_text())
    for row in downloaded:
        assert sha((ASSETS / row["file"]).read_bytes()) == row["sha256"]

    publisher = runpy.run_path(str(ROOT / "scripts/publish-svg-background-audit-20261014.py"))
    secrets = publisher["secrets"]()
    db = publisher["database"](secrets["DB_VIBERS_MAIN_URL"])
    s3 = boto3.client("s3", endpoint_url="https://kr.object.ncloudstorage.com", region_name="kr-standard",
        aws_access_key_id=secrets["NCP_ACCESS_KEY"], aws_secret_access_key=secrets["NCP_SECRET_KEY"],
        config=Config(signature_version="s3v4", request_checksum_calculation="when_required",
                      response_checksum_validation="when_required"))

    with db.cursor() as cursor:
        cursor.execute("SELECT payload,status FROM semologo.logo_posts WHERE id=%s", (BRAND,))
        post = cursor.fetchone()
        cursor.execute("SELECT id,asset_manifest FROM semologo.logo_versions WHERE brand_id=%s AND is_current", (BRAND,))
        version = cursor.fetchone()
    assert post and post[1] == "published" and post[0]["name_ko"] == "한국산업은행"
    assert version and version[1] is None, "existing reviewed variants need a manual merge"

    def put_immutable(relative: str, raw: bytes, mime: str) -> None:
        key = f"_clients/{BRAND}/{relative}"
        try:
            assert s3.get_object(Bucket=BUCKET, Key=key)["Body"].read() == raw, f"immutable conflict: {key}"
        except ClientError as error:
            if error.response.get("Error", {}).get("Code") not in ("404", "NoSuchKey", "NotFound"):
                raise
            s3.put_object(Bucket=BUCKET, Key=key, Body=raw, ACL="public-read", ContentType=mime,
                          CacheControl="public,max-age=31536000,immutable", Metadata={"sha256": sha(raw)})
            assert s3.get_object(Bucket=BUCKET, Key=key)["Body"].read() == raw

    old_logo = s3.get_object(Bucket=BUCKET, Key=f"_clients/{BRAND}/logo.png")["Body"].read()
    legacy_file = f"sources/legacy-before-official-20261014/{sha(old_logo)[:20]}.png"
    put_immutable(legacy_file, old_logo, "image/png")

    bundle = io.BytesIO()
    with zipfile.ZipFile(bundle, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("README.txt", "한국산업은행 공식 CI 원본 AI. 출처: KDB CI 및 서체 페이지. 국문/영문 로고타입과 가로/상하 시그니처.\n")
        for row in downloaded:
            with zipfile.ZipFile(ASSETS / row["file"], metadata_encoding="cp949") as original:
                for member in original.infolist():
                    if member.filename.lower().endswith(".ai"):
                        archive.writestr(member.filename, original.read(member))
    bundle_raw = bundle.getvalue()
    bundle_file = f"sources/official-kdb-20261014/{sha(bundle_raw)[:20]}.zip"
    put_immutable(bundle_file, bundle_raw, "application/zip")

    ai_files = {}
    inventory = {row["file"]: row for row in json.loads((SOURCE / "inventory.json").read_text())}
    for info in extraction["forms"].values():
        filename = info["source"]
        if filename not in ai_files:
            raw = (SOURCE / filename).read_bytes()
            assert sha(raw) == inventory[filename]["sha256"]
            relative = f"sources/official-kdb-20261014/{sha(raw)[:20]}.ai"
            put_immutable(relative, raw, "application/postscript")
            ai_files[filename] = relative

    variants = [{"key": "legacy-before-official", "form": "unknown", "lockup": "unknown",
                 "lang": "ko", "color": "original", "label": "기존 저해상도 PNG",
                 "files": {"png": legacy_file}, "origin": "collected", "order": 0,
                 "visual_sha256": sha(old_logo)}]
    main = {}
    for order, (name, form, lang, label) in enumerate(FORM_INFO, start=1):
        info = extraction["forms"][name]
        files = {}
        for ext, mime in (("svg", "image/svg+xml"), ("png", "image/png")):
            raw = (SOURCE / f"{name}.{ext}").read_bytes()
            assert sha(raw) == info[f"{ext}_sha256"]
            relative = f"sources/official-kdb-20261014/{sha(raw)[:20]}.{ext}"
            put_immutable(relative, raw, mime)
            files[ext] = relative
            if name == "ko-horizontal":
                main[ext] = raw
        variants.append({"key": f"official-{name}", "form": form, "lockup": form,
                         "lang": lang, "color": "original", "label": f"{label} · 2025 공식 CI",
                         "files": files, "source_file": ai_files[info["source"]],
                         "source_sha256": info["source_sha256"], "visual_sha256": info["svg_sha256"],
                         "provider": "한국산업은행 공식 CI", "origin": "collected", "order": order})
    manifest = {"schema": 1, "algo_v": 1, "id": BRAND,
                "primary": "official-ko-horizontal", "variants": variants}
    assert coverage(manifest)["complete"]

    before = {"post": post[0], "version_id": version[0], "asset_manifest": version[1],
              "old_logo_sha256": sha(old_logo)}
    (SOURCE / "publication-before.json").write_text(json.dumps(before, ensure_ascii=False, indent=2) + "\n")

    for ext, mime in (("svg", "image/svg+xml"), ("png", "image/png")):
        s3.put_object(Bucket=BUCKET, Key=f"_clients/{BRAND}/logo.{ext}", Body=main[ext],
                      ACL="public-read", ContentType=mime, CacheControl="public,max-age=60")
        assert s3.get_object(Bucket=BUCKET, Key=f"_clients/{BRAND}/logo.{ext}")["Body"].read() == main[ext]

    bundle_url = f"https://logo.vibers.co.kr/_clients/{BRAND}/{bundle_file}"
    served_bundle = subprocess.run(["curl", "-fsSL", "--max-time", "30", bundle_url],
                                   capture_output=True, check=True).stdout
    assert sha(served_bundle) == sha(bundle_raw), "public original bundle differs from upload"
    patch = {"name_en": "Korea Development Bank", "logo_svg": "logo.svg", "logo_png": True,
             "has_svg": True, "has_png": True, "variants_n": len(variants),
             "asset_review_status": "official-reviewed",
             "source_ai": ai_files["2025_KDB_CI_SC_Kor_AI-0.ai"],
             "collected_originals_url": bundle_url,
             "metadata": {**(post[0].get("metadata") or {}), "has_svg": True, "has_png": True}}
    with db, db.cursor() as cursor:
        cursor.execute("SELECT asset_manifest FROM semologo.logo_versions WHERE id=%s AND is_current FOR UPDATE", (version[0],))
        locked = cursor.fetchone()
        assert locked and locked[0] == version[1], "current version changed"
        cursor.execute("UPDATE semologo.logo_versions SET asset_manifest=%s::jsonb,review_status='verified',verified_at=now() WHERE id=%s",
                       (json.dumps({"variants": manifest}, ensure_ascii=False), version[0]))
        cursor.execute("UPDATE semologo.logo_posts SET payload=payload||%s::jsonb,updated_at=now() WHERE id=%s",
                       (json.dumps(patch, ensure_ascii=False), BRAND))
        cursor.execute("UPDATE semologo.logo_versions SET review_status='verified',verified_at=now() "
                       "WHERE brand_id=%s AND is_current AND asset_manifest->'variants'->>'primary'='official-ko-horizontal' RETURNING id",
                       (BRAND,))
        current = cursor.fetchall()
        assert len(current) == 1, "official manifest missing on current version"

    raw_manifest = (json.dumps(manifest, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
    s3.put_object(Bucket=BUCKET, Key=f"_clients/{BRAND}/variants.json", Body=raw_manifest,
                  ACL="public-read", ContentType="application/json", CacheControl="public,max-age=60")
    assert s3.get_object(Bucket=BUCKET, Key=f"_clients/{BRAND}/variants.json")["Body"].read() == raw_manifest
    db.close()
    report = {"brand_id": BRAND, "version_id": current[0][0], "variants": len(variants),
              "coverage": coverage(manifest), "original_bundle": bundle_file,
              "bundle_sha256": sha(bundle_raw)}
    (SOURCE / "published.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()

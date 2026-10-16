#!/usr/bin/env python3
"""Build a deduplicated, provenance-bearing domain discovery queue.

These are website candidates, never counted as published logos. The resulting
SQLite database stays on the collection disk; only its small audit is tracked.
"""

import argparse
import csv
import gzip
import hashlib
import json
import sqlite3
import sys
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path

CC_RELEASE = "cc-main-2026-jul-aug-sep"
CC_URL = ("https://ds5q9oxwqwsfj.cloudfront.net/projects/hyperlinkgraph/"
          f"{CC_RELEASE}/domain/{CC_RELEASE}-domain-ranks.txt.gz")


def domain_name(value):
    value = value.strip().strip(".").lower()
    if not value or "/" in value or ":" in value or " " in value or len(value) > 253:
        return None
    try:
        value = value.encode("idna").decode("ascii")
    except UnicodeError:
        return None
    labels = value.split(".")
    if len(labels) < 2 or any(not label or len(label) > 63 or label.startswith("-") or label.endswith("-") for label in labels):
        return None
    if not (labels[-1].isalpha() or labels[-1].startswith("xn--")) or not all(all(char.isalnum() or char == "-" for char in label) for label in labels):
        return None
    return value


def file_hash(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def commoncrawl_rows(response):
    with gzip.GzipFile(fileobj=response) as source:
        header = source.readline().decode("utf-8").strip()
        if "#host_rev" not in header or "#harmonicc_pos" not in header:
            raise ValueError("Unexpected Common Crawl rank format")
        for line in source:
            parts = line.decode("utf-8", "replace").rstrip("\n").split("\t")
            if len(parts) < 5:
                continue
            try:
                rank = int(parts[0])
            except ValueError:
                continue
            yield rank, ".".join(reversed(parts[4].split(".")))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tranco", type=Path, required=True)
    parser.add_argument("--majestic", type=Path, required=True)
    parser.add_argument("--database", type=Path, required=True)
    parser.add_argument("--audit", type=Path, required=True)
    parser.add_argument("--target", type=int, default=5_000_000)
    parser.add_argument("--cc-url", default=CC_URL)
    parser.add_argument("--cc-gzip", type=Path, help="Local prefix of the Common Crawl gzip for a bounded run")
    args = parser.parse_args()
    if args.target < 2_000_000:
        parser.error("target must be at least 2,000,000 candidate domains")
    args.database.parent.mkdir(parents=True, exist_ok=True)
    temp = args.database.with_suffix(".building.sqlite")
    # Keep deduplication in memory and write the SQLite index once in sorted
    # order. Random b-tree updates were prohibitively slow on the HDD.
    domains = {}
    tranco = majestic = 0
    with zipfile.ZipFile(args.tranco) as archive, archive.open("top-1m.csv") as source:
        for row in csv.reader((line.decode("utf-8") for line in source)):
            if len(row) < 2 or not (domain := domain_name(row[1])):
                continue
            tranco += 1
            domains[domain] = (1, int(row[0]), None, None)
    with args.majestic.open(newline="", encoding="utf-8") as source:
        for row in csv.DictReader(source):
            if not (domain := domain_name(row["Domain"])):
                continue
            majestic += 1
            old = domains.get(domain, (0, None, None, None))
            domains[domain] = (old[0] | 2, old[1], int(row["GlobalRank"]), old[3])
    first_two_unique = len(domains)
    print(json.dumps({"stage": "ranked_lists", "tranco": tranco, "majestic": majestic, "unique": first_two_unique}), flush=True)

    cc_scanned = 0
    cc_accepted = 0
    cc_url = args.cc_url
    request = urllib.request.Request(cc_url, headers={"User-Agent": "SemoLogo-domain-discovery/1.0", "Range": "bytes=0-268435455"})
    response = args.cc_gzip.open("rb") if args.cc_gzip else urllib.request.urlopen(request, timeout=120)
    with response:
        for rank, domain in commoncrawl_rows(response):
            cc_scanned += 1
            normal = domain_name(domain)
            if normal:
                old = domains.get(normal, (0, None, None, None))
                domains[normal] = (old[0] | 4, old[1], old[2], rank)
                cc_accepted += 1
            if cc_scanned % 100_000 == 0:
                unique = len(domains)
                print(json.dumps({"stage": "commoncrawl", "scanned": cc_scanned, "unique": unique}), flush=True)
                if unique >= args.target:
                    break
    unique = len(domains)
    if unique < args.target:
        sys.exit("Candidate target not reached; no database published")
    counts = {}
    for mask, *_ in domains.values():
        counts[str(mask)] = counts.get(str(mask), 0) + 1
    if temp.exists():
        temp.unlink()
    with sqlite3.connect(temp) as db:
        db.execute("PRAGMA synchronous=NORMAL")
        db.execute("CREATE TABLE domains(domain TEXT PRIMARY KEY, source_mask INTEGER NOT NULL, tranco_rank INTEGER, majestic_rank INTEGER, cc_rank INTEGER) WITHOUT ROWID")
        db.executemany("INSERT INTO domains(domain,source_mask,tranco_rank,majestic_rank,cc_rank) VALUES(?,?,?,?,?)",
                       ((domain, *domains[domain]) for domain in sorted(domains)))
        db.execute("CREATE INDEX domains_tranco_rank ON domains(tranco_rank) WHERE tranco_rank IS NOT NULL")
        db.commit()
    db.close()
    del domains
    temp.replace(args.database)
    audit = {
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "status": "discovery_candidates_only",
        "targetCandidates": args.target,
        "uniqueCandidateDomains": unique,
        "trancoRows": tranco,
        "majesticRows": majestic,
        "commonCrawlRowsScanned": cc_scanned,
        "commonCrawlAcceptedRows": cc_accepted,
        "sourceMaskCounts": counts,
        "sources": {
            "tranco": {"url": "https://tranco-list.eu/top-1m.csv.zip", "sha256": file_hash(args.tranco)},
            "majestic": {"url": "https://downloads.majestic.com/majestic_million.csv", "sha256": file_hash(args.majestic)},
            "commonCrawl": {"url": cc_url, "release": CC_RELEASE, "partialStream": True,
                            "localPrefixSha256": file_hash(args.cc_gzip) if args.cc_gzip else None}
        },
        "publication": "No domain is a logo. Website identity, logo asset, quality, rights, duplicate and serving checks remain required."
    }
    args.audit.parent.mkdir(parents=True, exist_ok=True)
    args.audit.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"stage": "complete", "unique": unique, "ccScanned": cc_scanned, "database": str(args.database)}), flush=True)
    if unique < args.target:
        sys.exit("Candidate target not reached")


if __name__ == "__main__":
    main()

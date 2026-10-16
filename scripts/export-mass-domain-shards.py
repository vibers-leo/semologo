#!/usr/bin/env python3
"""Prepare disjoint discovery workloads for the two Windows collectors.

The CSVs contain only candidate domains. They are not executable fleet jobs and
must enter a separate bounded discovery contract before worker scheduling.
"""

import argparse
import csv
import gzip
import hashlib
import importlib.util
import json
import zipfile
from datetime import datetime, timezone
from pathlib import Path

SEED_SCRIPT = Path(__file__).with_name("build-mass-domain-seeds.py")
spec = importlib.util.spec_from_file_location("mass_seeds", SEED_SCRIPT)
seeds = importlib.util.module_from_spec(spec)
spec.loader.exec_module(seeds)


def known_domains(tranco, majestic):
    known = set()
    with zipfile.ZipFile(tranco) as archive, archive.open("top-1m.csv") as source:
        for row in csv.reader((line.decode("utf-8") for line in source)):
            if len(row) > 1 and (domain := seeds.domain_name(row[1])):
                known.add(domain)
    with majestic.open(newline="", encoding="utf-8") as source:
        for row in csv.DictReader(source):
            if domain := seeds.domain_name(row["Domain"]):
                known.add(domain)
    return known


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tranco", type=Path, required=True)
    parser.add_argument("--majestic", type=Path, required=True)
    parser.add_argument("--cc-gzip", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--limit", type=int, default=1_000_000)
    args = parser.parse_args()
    if args.limit <= 0:
        parser.error("limit must be positive")
    args.out.mkdir(parents=True, exist_ok=True)
    known = known_domains(args.tranco, args.majestic)
    rows = [[], []]
    with args.cc_gzip.open("rb") as source:
        for rank, raw in seeds.commoncrawl_rows(source):
            domain = seeds.domain_name(raw)
            if domain is None or domain in known:
                continue
            known.add(domain)
            worker = len(rows[0]) + len(rows[1])
            rows[worker % 2].append((rank, domain))
            if worker + 1 >= args.limit:
                break
    files = []
    for index, values in enumerate(rows, 1):
        worker = f"win-0{index}"
        path = args.out / f"{worker}-cc-only-candidates.csv.gz"
        with gzip.open(path, "wt", encoding="utf-8", newline="") as output:
            writer = csv.writer(output)
            writer.writerow(("common_crawl_rank", "domain"))
            writer.writerows(values)
        files.append({"worker": worker, "count": len(values), "path": str(path),
                      "sha256": seeds.file_hash(path), "firstRank": values[0][0] if values else None,
                      "lastRank": values[-1][0] if values else None})
    manifest = {"createdAt": datetime.now(timezone.utc).isoformat(),
                "status": "candidate_shards_not_queued", "commonCrawlRelease": seeds.CC_RELEASE,
                "excludedRankedDomains": len(known) - sum(map(len, rows)),
                "totalCandidates": sum(map(len, rows)), "files": files,
                "note": "Requires a separate bounded Windows discovery job; no logos collected or published by this export."}
    (args.out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"totalCandidates": manifest["totalCandidates"], "perWorker": [len(v) for v in rows],
                      "manifest": str(args.out / 'manifest.json')}))


if __name__ == "__main__":
    main()

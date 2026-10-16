#!/usr/bin/env python3
"""Prepare disjoint discovery workloads for the two Windows collectors.

The CSVs contain only candidate domains. They are not executable fleet jobs and
must enter a separate bounded discovery contract before worker scheduling.
"""

import argparse
import csv
import gzip
import importlib.util
import io
import json
import zipfile
from contextlib import ExitStack
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
    parser.add_argument("--skip", type=int, default=0, help="Skip this many new Common Crawl-only domains")
    args = parser.parse_args()
    if args.limit <= 0 or args.skip < 0:
        parser.error("limit must be positive and skip non-negative")
    args.out.mkdir(parents=True, exist_ok=True)
    known = known_domains(args.tranco, args.majestic)
    counts = [0, 0]
    first_ranks = [None, None]
    last_ranks = [None, None]
    unseen = 0
    paths = [args.out / f"win-0{index}-cc-only-candidates.csv.gz" for index in (1, 2)]
    partial_paths = [path.with_name(path.name + ".part") for path in paths]
    try:
        with ExitStack() as stack:
            writers = []
            for path in partial_paths:
                raw = stack.enter_context(path.open("wb"))
                compressed = stack.enter_context(gzip.GzipFile(fileobj=raw, mode="wb", filename="", mtime=0))
                output = stack.enter_context(io.TextIOWrapper(compressed, encoding="utf-8", newline=""))
                writer = csv.writer(output)
                writer.writerow(("common_crawl_rank", "domain"))
                writers.append(writer)
            source = stack.enter_context(args.cc_gzip.open("rb"))
            for rank, raw in seeds.commoncrawl_rows(source):
                domain = seeds.domain_name(raw)
                if domain is None or domain in known:
                    continue
                known.add(domain)
                unseen += 1
                if unseen <= args.skip:
                    continue
                worker = sum(counts) % 2
                writers[worker].writerow((rank, domain))
                counts[worker] += 1
                if first_ranks[worker] is None:
                    first_ranks[worker] = rank
                last_ranks[worker] = rank
                if sum(counts) >= args.limit:
                    break
        if sum(counts) != args.limit:
            raise ValueError(f"Only {sum(counts)} candidate domains available; requested {args.limit}")
        for partial, final in zip(partial_paths, paths):
            partial.replace(final)
    except Exception:
        for partial in partial_paths:
            partial.unlink(missing_ok=True)
        raise
    files = []
    for index, path in enumerate(paths, 1):
        worker = f"win-0{index}"
        files.append({"worker": worker, "count": counts[index - 1], "path": str(path),
                      "sha256": seeds.file_hash(path), "firstRank": first_ranks[index - 1],
                      "lastRank": last_ranks[index - 1]})
    manifest = {"createdAt": datetime.now(timezone.utc).isoformat(),
                "status": "candidate_shards_not_queued", "commonCrawlRelease": seeds.CC_RELEASE,
                "excludedRankedDomains": len(known) - unseen,
                "skippedPriorCandidates": args.skip,
                "totalCandidates": sum(counts), "files": files,
                "note": "Requires a separate bounded Windows discovery job; no logos collected or published by this export."}
    (args.out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"totalCandidates": manifest["totalCandidates"], "perWorker": counts,
                      "manifest": str(args.out / 'manifest.json')}))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Bounded first-party logo discovery from ranked domain seeds.

Outputs evidence for review; no candidate is published or counted as a logo.
"""

import argparse
import concurrent.futures
import csv
import gzip
import http.client
import itertools
import functools
import hashlib
import html.parser
import json
import sqlite3
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser
from datetime import datetime, timezone
from pathlib import Path

MAX_HTML = 1_000_000
MAX_ASSET = 1_000_000
UA = "SemoLogo-logo-discovery/1.0 (+https://semologo.com/)"


class LogoParser(html.parser.HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.base = None
        self.site_name = None
        self.title = None
        self.in_title = False
        self.candidates = []
        self.jsonld = []
        self.in_jsonld = False

    def handle_starttag(self, tag, attrs):
        data = dict(attrs)
        if tag == "base" and data.get("href"):
            self.base = data["href"]
        if tag == "title":
            self.in_title = True
        if tag == "script" and data.get("type", "").lower() == "application/ld+json":
            self.in_jsonld = True
            self.jsonld.append("")
        if tag == "meta":
            key = (data.get("property") or data.get("name") or "").lower()
            if key == "og:site_name":
                self.site_name = data.get("content")
            if key in ("og:logo", "twitter:logo") and data.get("content"):
                self.candidates.append(("meta-logo", data["content"]))
        if tag == "img" and data.get("src"):
            evidence = " ".join(str(data.get(k, "")) for k in ("alt", "class", "id", "src")).lower()
            if "logo" in evidence or "brand" in evidence:
                self.candidates.append(("image-logo", data["src"]))
        if tag == "link" and data.get("href"):
            rel = str(data.get("rel", "")).lower()
            if "icon" in rel:
                self.candidates.append(("favicon", data["href"]))

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        if tag == "script":
            self.in_jsonld = False

    def handle_data(self, data):
        if self.in_title:
            self.title = (self.title or "") + data
        if self.in_jsonld and self.jsonld:
            self.jsonld[-1] += data


def jsonld_logos(value):
    if isinstance(value, list):
        for item in value:
            yield from jsonld_logos(item)
    elif isinstance(value, dict):
        kind = value.get("@type", "")
        if isinstance(kind, str):
            kind = [kind]
        if any(k in ("Organization", "Corporation", "LocalBusiness", "Brand") for k in kind):
            logo = value.get("logo")
            if isinstance(logo, str):
                yield logo
            elif isinstance(logo, dict) and isinstance(logo.get("url"), str):
                yield logo["url"]
        for child in value.values():
            if isinstance(child, (dict, list)):
                yield from jsonld_logos(child)


def safe_url(base, raw, domain):
    url = urllib.parse.urljoin(base, raw.strip())
    if any(ord(char) < 0x21 or ord(char) == 0x7f for char in url):
        return None
    parts = urllib.parse.urlsplit(url)
    host = (parts.hostname or "").lower()
    if parts.scheme != "https" or parts.username or parts.password or not host:
        return None
    if host != domain and host != "www." + domain and not host.endswith("." + domain):
        return None
    return urllib.parse.urlunsplit((parts.scheme, parts.netloc, parts.path, parts.query, ""))


def get(url, limit, domain, *, robots_redirect=True):
    if safe_url(url, url, domain) is None:
        raise ValueError("request is not first-party HTTPS")
    class FirstPartyRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, request, fp, code, msg, headers, next_url):
            if safe_url(request.full_url, next_url, domain) is None:
                raise ValueError("redirect left first-party HTTPS")
            old_host = urllib.parse.urlsplit(request.full_url).hostname
            next_host = urllib.parse.urlsplit(urllib.parse.urljoin(request.full_url, next_url)).hostname
            if robots_redirect and next_host != old_host and not robots_allows(next_host):
                raise ValueError("redirect destination disallowed by robots.txt")
            return super().redirect_request(request, fp, code, msg, headers, next_url)
    opener = urllib.request.build_opener(FirstPartyRedirect())
    request = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html,image/svg+xml,image/png,image/webp,*/*;q=0.5"})
    with opener.open(request, timeout=12) as response:
        body = response.read(limit + 1)
        if len(body) > limit:
            raise ValueError("response too large")
        return response.url, response.headers.get_content_type(), body


@functools.lru_cache(maxsize=2048)
def robots_allows(domain):
    url = "https://" + domain + "/robots.txt"
    try:
        _, _, raw = get(url, 512_000, domain, robots_redirect=False)
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return True
        raise ValueError("robots.txt not readable") from error
    parser = urllib.robotparser.RobotFileParser()
    parser.parse(raw.decode("utf-8", "replace").splitlines())
    return parser.can_fetch(UA, "https://" + domain + "/")


def inspect(domain, asset_dir):
    row = {"domain": domain, "status": "failed", "logoCandidates": []}
    try:
        if not robots_allows(domain):
            row["status"] = "robots_disallowed"
            return row
        page, content_type, raw = get("https://" + domain + "/", MAX_HTML, domain)
        if content_type not in ("text/html", "application/xhtml+xml"):
            raise ValueError("homepage is not HTML")
        host = (urllib.parse.urlsplit(page).hostname or "").lower()
        if host != domain and host != "www." + domain:
            raise ValueError("homepage redirected to another domain")
        parser = LogoParser()
        parser.feed(raw.decode("utf-8", "replace"))
        row.update({"status": "page_read", "pageUrl": page, "name": (parser.site_name or parser.title or "").strip()[:160]})
        for script in parser.jsonld:
            try:
                for logo in jsonld_logos(json.loads(script)):
                    parser.candidates.append(("organization-jsonld", logo))
            except (ValueError, TypeError):
                continue
        base = urllib.parse.urljoin(page, parser.base) if parser.base else page
        seen = set()
        for kind, raw_url in parser.candidates:
            url = safe_url(base, raw_url, domain)
            if not url or url in seen:
                continue
            seen.add(url)
            if len(row["logoCandidates"]) >= 12:
                break
            row["logoCandidates"].append({"kind": kind, "url": url})
        if not row["logoCandidates"]:
            row["status"] = "no_first_party_logo_signal"
        else:
            # Only one strong candidate is downloaded in this pass. Favicons are
            # useful as discovery signals but do not become logo assets here.
            strong = next((x for x in row["logoCandidates"] if x["kind"] != "favicon"), None)
            if strong:
                final_url, asset_type, body = get(strong["url"], MAX_ASSET, domain)
                if safe_url(page, final_url, domain) is None:
                    raise ValueError("asset redirected off first-party domain")
                signature = (body[:1024].lower(), asset_type)
                is_svg = b"<svg" in signature[0] and asset_type in ("image/svg+xml", "text/xml", "application/xml", "text/plain")
                is_png = body.startswith(b"\x89PNG\r\n\x1a\n")
                is_webp = body.startswith(b"RIFF") and body[8:12] == b"WEBP"
                if is_svg or is_png or is_webp:
                    digest = hashlib.sha256(body).hexdigest()
                    extension = ".svg" if is_svg else ".png" if is_png else ".webp"
                    asset_file = asset_dir / (digest + extension)
                    if not asset_file.exists():
                        asset_file.write_bytes(body)
                    strong.update({"contentType": "image/svg+xml" if is_svg else "image/png" if is_png else "image/webp",
                                   "bytes": len(body), "sha256": digest, "rawPath": str(asset_file)})
                    row["status"] = "asset_found_review_required"
                else:
                    row["status"] = "asset_invalid"
    except (urllib.error.URLError, http.client.HTTPException, TimeoutError, ValueError, OSError) as error:
        row["error"] = str(error)[:180]
    return row


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--database", type=Path)
    source.add_argument("--shard", type=Path, help="One prepared Windows candidate CSV.gz")
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--assets", type=Path, required=True)
    parser.add_argument("--limit", type=int, default=200)
    parser.add_argument("--offset", type=int, default=0)
    parser.add_argument("--workers", type=int, default=8)
    args = parser.parse_args()
    if not 1 <= args.limit <= 1000 or not 1 <= args.workers <= 16:
        parser.error("limit must be 1–1000 and workers 1–16")
    if args.database:
        with sqlite3.connect(args.database) as db:
            domains = [row[0] for row in db.execute("SELECT domain FROM domains WHERE tranco_rank IS NOT NULL ORDER BY tranco_rank LIMIT ? OFFSET ?", (args.limit, args.offset))]
    else:
        with gzip.open(args.shard, "rt", encoding="utf-8", newline="") as source_file:
            domains = [row["domain"] for row in itertools.islice(csv.DictReader(source_file), args.offset, args.offset + args.limit)]
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.assets.mkdir(parents=True, exist_ok=True)
    counts = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool, args.out.open("w") as output:
        for row in pool.map(lambda domain: inspect(domain, args.assets), domains):
            row["checkedAt"] = datetime.now(timezone.utc).isoformat()
            output.write(json.dumps(row, ensure_ascii=False) + "\n")
            counts[row["status"]] = counts.get(row["status"], 0) + 1
    print(json.dumps({"scanned": len(domains), "statuses": counts, "out": str(args.out)}, ensure_ascii=False))


if __name__ == "__main__":
    main()

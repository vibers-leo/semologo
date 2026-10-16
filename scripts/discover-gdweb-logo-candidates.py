#!/usr/bin/env python3
"""Discover GDWEB site entries for official-source logo review; never ingest thumbnails."""

import argparse
import concurrent.futures
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, urljoin, urlparse

import requests
from lxml import html


BASE = 'https://www.gdweb.co.kr/sub/'
ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'data/collection/gdweb-logo-candidates.json'
HEADERS = {'User-Agent': 'Mozilla/5.0 (compatible; SemoLogo-source-discovery/1.0)'}


def get(url):
    response = requests.get(url, headers=HEADERS, timeout=20)
    response.raise_for_status()
    return html.fromstring(response.content)


def entries(page):
    document = get(BASE + f'list.asp?displayrow=60&Txt_fgbn=5&Page={page}')
    found = []
    for node in document.xpath('//ul[contains(@class,"thumnail")]/li'):
        href = node.xpath('.//div[contains(@class,"img-box")]//a/@href')
        title = ' '.join(x.strip() for x in node.xpath('.//p[contains(@class,"subject")]//text()') if x.strip())
        date = ''.join(node.xpath('.//p[contains(@class,"date")]//text()')).strip()
        if not href or not title:
            continue
        source_id = parse_qs(urlparse(href[0]).query).get('str_no', [''])[0]
        if not source_id.isdigit():
            continue
        found.append({'gdweb_id': source_id, 'listing_title': title,
                      'listed_date': date, 'listing_page': page,
                      'discovery_url': BASE + f'view.asp?str_no={source_id}'})
    return found


def detail(row):
    try:
        document = get(row['discovery_url'])
        links = document.xpath('//a[.//span[contains(normalize-space(.),"사이트바로가기")]]/@href')
        official = next((urljoin(row['discovery_url'], link) for link in links
                         if urlparse(urljoin(row['discovery_url'], link)).scheme in ('https', 'http')),
                        None)
        row['official_site_candidate'] = official
        row['status'] = 'official_site_found' if official else 'needs_official_site_review'
    except (requests.RequestException, ValueError) as error:
        row['status'] = 'detail_fetch_failed'
        row['error'] = type(error).__name__
    return row


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pages', type=int, default=3)
    parser.add_argument('--output', type=Path, default=OUTPUT)
    args = parser.parse_args()
    if not 1 <= args.pages <= 10:
        parser.error('--pages must be between 1 and 10')
    rows = []
    for page in range(1, args.pages + 1):
        rows.extend(entries(page))
    rows = list({row['gdweb_id']: row for row in rows}.values())
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        rows = list(pool.map(detail, rows))
    result = {
        'schema_version': 1,
        'discovered_at': datetime.now(timezone.utc).isoformat(),
        'source': BASE + 'list.asp',
        'pages_checked': args.pages,
        'policy': 'Discovery only. GDWEB screenshots are excluded. Brand identity, catalog deduplication, official logo asset, and four-form review are pending.',
        'items': rows,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'entries': len(rows),
                      'official_sites': sum(row['status'] == 'official_site_found' for row in rows),
                      'needs_review': sum(row['status'] != 'official_site_found' for row in rows),
                      'output': str(args.output)}, ensure_ascii=False))


if __name__ == '__main__':
    main()

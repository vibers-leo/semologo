#!/usr/bin/env python3
"""Turn daily news leads into a review sheet and pinned Windows source candidates.

News articles are never used as asset URLs. Only manually approved official SVGs
with a previously recorded SHA-256 may enter the worker handoff.
"""

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse


def prepare(queue, approvals, roster):
    candidates = {item['id']: item for item in queue['candidates']}
    existing_ids = {item['id'] for item in roster['sources']}
    existing_urls = {item['assetUrl'] for item in roster['sources']}
    accepted, problems = [], []
    for row in approvals.get('sources', []):
        topic = candidates.get(row.get('trendId'))
        asset = row.get('assetUrl', '')
        page = row.get('sourcePage', '')
        digest = row.get('expectedSha256', '')
        host = urlparse(asset).hostname or ''
        page_host = urlparse(page).hostname or ''
        reason = None
        if not topic:
            reason = 'trend_missing_from_current_queue'
        elif row.get('reviewStatus') != 'approved_official_svg':
            reason = 'not_manually_approved'
        elif not row.get('id', '').startswith('trend-') or row['id'] in existing_ids:
            reason = 'invalid_or_duplicate_id'
        elif asset in existing_urls or urlparse(asset).scheme != 'https' or not asset.lower().split('?')[0].endswith('.svg'):
            reason = 'invalid_or_duplicate_svg_url'
        elif urlparse(page).scheme != 'https' or not host or not page_host or not (host == page_host or host.endswith('.' + page_host)):
            reason = 'asset_not_on_official_source_domain'
        elif len(digest) != 64 or any(c not in '0123456789abcdef' for c in digest):
            reason = 'missing_pinned_sha256'
        elif not row.get('reviewedBy') or not row.get('reviewedAt'):
            reason = 'missing_human_review_evidence'
        if reason:
            problems.append({'id': row.get('id'), 'trendId': row.get('trendId'), 'reason': reason})
            continue
        accepted.append({key: row[key] for key in ('id', 'nameKo', 'sourcePage', 'assetUrl', 'expectedSha256')})
        existing_ids.add(row['id'])
        existing_urls.add(asset)
    accepted_trends = {row['trendId'] for row in approvals.get('sources', [])
                       if row.get('id') in {source['id'] for source in accepted}}
    return {
        'schemaVersion': 1,
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'publicationApproved': False,
        'workerSources': accepted,
        'reviewNeeded': [{'id': row['id'], 'name': row['name'], 'priority': row['priority'],
                          'status': row['status'], 'articleCount': row['article_count']}
                         for row in queue['candidates'] if row['id'] not in accepted_trends],
        'blockedApprovals': problems,
        'handoff': 'Add workerSources to the pinned roster and release the same manifest to the server and both Windows workers before queuing source IDs.'
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--queue', type=Path, required=True)
    parser.add_argument('--approvals', type=Path, required=True)
    parser.add_argument('--roster', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = prepare(json.loads(args.queue.read_text()), json.loads(args.approvals.read_text()), json.loads(args.roster.read_text()))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temp = args.output.with_suffix('.tmp')
    temp.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    temp.replace(args.output)
    print(json.dumps({'workerSources': len(result['workerSources']), 'reviewNeeded': len(result['reviewNeeded']),
                      'blockedApprovals': len(result['blockedApprovals'])}, ensure_ascii=False))


if __name__ == '__main__':
    main()

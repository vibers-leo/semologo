#!/usr/bin/env python3
"""Keep the 701-institution official-logo review and recollection gap reproducible.

Uses the frozen initial roster audit plus reviewed manifests. This deliberately
does not count a CMS name match as a verified official logo.
"""
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STAGE = ROOT / 'marketing/assets/public-ci-recovery-20261017'
OUTPUT = ROOT / 'data/collection/public-ci-recollection-queue-20261017.json'
REVIEWS = (
    'public-ci-roster-reviewed-20261017.json',
    'public-ci-roster-alt-reviewed-20261017.json',
    'public-ci-roster-legal-reviewed-20261017.json',
    'public-ci-roster-new-direct-reviewed-20261017.json',
    'public-ci-roster-alt-legal-reviewed-20261017.json',
    'public-ci-roster-alt-new-direct-reviewed-20261017.json',
)


def legal_norm(value):
    return re.sub(r'^(재단법인|사단법인|주식회사|유한회사|사회복지법인|공익재단법인)', '',
                  re.sub(r'[^가-힣a-z0-9]', '', str(value or '').lower()))


def main():
    initial = json.loads((STAGE / 'all-701-audit.json').read_text())
    legal = {r['member_key']: r for r in json.loads((STAGE / 'all-701-audit-legal.json').read_text())}
    original = {r['member_key']: r for r in json.loads((STAGE / 'unverified.json').read_text())}
    posts = {r['id']: r for r in json.loads((STAGE / 'cms-candidates.json').read_text())}
    official = {}
    for row in json.loads((ROOT / 'data/collection/official-ci-assets-staged.json').read_text())['candidates']:
        official.setdefault(legal_norm(row['name_ko']), []).append(row)
    reviewed = {}
    for filename in REVIEWS:
        for row in json.loads((ROOT / 'data/collection' / filename).read_text())['items']:
            key = row['member_key']
            if key in reviewed:
                raise ValueError(f'duplicate reviewed member: {key}')
            reviewed[key] = {'brand_id': row['exact_candidates'][0], 'evidence': filename,
                             'official_source_page': row['source_page'], 'official_asset_url': row['asset_url']}
    if len(initial) != 701 or len({r['member_key'] for r in initial}) != 701:
        raise ValueError('frozen 701-member baseline changed')
    items = []
    for row in initial:
        key = row['member_key']
        other = legal[key]
        candidates = [posts[x] for x in original[key]['metadata'].get('candidates', []) if x in posts]
        sources = official.get(legal_norm(row['name']), [])
        official_pages = list(dict.fromkeys(s['official_source_page'] for s in sources))
        direct_asset_count = len({url for s in sources for url in s.get('asset_links', [])})
        exact = list(dict.fromkeys(row['exact_candidates'] + other['exact_candidates']))
        if key in reviewed:
            status = 'verified_in_this_batch'
            next_action = 'none'
        elif exact and direct_asset_count:
            status = 'official_asset_requires_visual_reselection'
            next_action = 'inspect other files on official CI page; replace wrong CMS asset or verify exact match'
        elif exact and official_pages:
            status = 'official_page_without_direct_file'
            next_action = 'retry official CI page and extract downloadable logo from CSS, script, attachment, or rendered page'
        elif exact:
            status = 'cms_candidate_without_official_ci_page'
            next_action = 'find organization official site and its current CI or media kit'
        else:
            status = 'no_exact_cms_or_official_ci_page'
            next_action = 'discover official organization and logo, review identity, then publish new content'
        items.append({'member_key': key, 'name': row['name'],
                      'province': original[key]['metadata'].get('province'),
                      'status': status, 'next_action': next_action,
                      'exact_candidate_ids': exact,
                      'other_candidate_ids': [c['id'] for c in candidates if c['id'] not in exact],
                      'official_pages': official_pages,
                      'direct_asset_count': direct_asset_count,
                      **({'reviewed': reviewed[key]} if key in reviewed else {})})
    counts = Counter(r['status'] for r in items)
    report = {'schema': 1, 'collection_id': 'kr-local-invested-institutions',
              'baseline': '701 members pending at start of 2026-10-17 review',
              'review_date': '2026-10-17', 'count': len(items),
              'status_counts': dict(counts), 'items': items}
    OUTPUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'output': str(OUTPUT.relative_to(ROOT)), 'counts': counts}, ensure_ascii=False))


if __name__ == '__main__':
    main()

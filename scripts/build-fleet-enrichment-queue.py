#!/usr/bin/env python3
"""Audit the whole CMS and route collected logos to existing content first.

This is read-only. A domain or name match is a review lead, never permission to
replace artwork. Unrecorded composition metadata remains *unknown*, not missing.
"""
import argparse
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

from logo_variant_enrichment import SLOTS, coverage


def domain_of(value):
    if not isinstance(value, str) or not value:
        return ''
    host = urlsplit(value if '://' in value else 'https://' + value).hostname or ''
    host = host.lower().removeprefix('www.')
    return host if '.' in host else ''


def name_of(value):
    name = ' '.join((value or '').casefold().split())
    if name in {'home', 'homepage', 'main', 'welcome', 'index', 'logo',
                '홈', '메인', '홈페이지', '사이트이름'}:
        return ''
    if len(name) < 4 and not (len(name) >= 2 and all('가' <= ch <= '힣' for ch in name)):
        return ''
    return name


def claimed(value):
    if value is True or value == 'true':
        return True
    if value is False or value == 'false':
        return False
    return None


def form_status(row):
    manifest = row.get('variant_manifest')
    variants = manifest.get('variants') if isinstance(manifest, dict) else None
    if not isinstance(variants, list) or not variants:
        return {'state': 'unassessed', 'present': [], 'missing': []}
    verified = [item for item in variants if item.get('review_status') == 'verified']
    if not verified:
        return {'state': 'unassessed', 'present': [], 'missing': []}
    result = coverage({**manifest, 'variants': verified})
    return {'state': 'recorded', 'present': [slot for slot in SLOTS if result['present'][slot]],
            'missing': result['missing'], 'distinct_artwork': result['distinct_artwork']}


def candidate_rows(manifests):
    seen = set()
    for source in manifests:
        data = json.loads(source.read_text())
        rows = data if isinstance(data, list) else data.get('results', [])
        for row in rows:
            if row.get('status') != 'staged_review_required':
                continue
            domain = domain_of(row.get('domain'))
            digest = row.get('sha256')
            if not domain or not digest or len(digest) != 64:
                continue
            key = (domain, digest)
            if key in seen:
                continue
            seen.add(key)
            yield {'domain': domain, 'name': row.get('name') or '',
                   'pageUrl': row.get('pageUrl') or '', 'assetUrl': row.get('assetUrl') or '',
                   'sha256': digest, 'sourceManifest': str(source)}


def asset_failures(paths):
    """Latest sweep result per brand/format; a failure requests recheck, not replacement."""
    latest = {}
    for source in paths:
        with source.open() as stream:
            for line in stream:
                row = json.loads(line)
                for kind in ('png', 'svg'):
                    detail = row.get(kind)
                    if isinstance(detail, dict):
                        latest[(row['id'], kind)] = detail
    failed = defaultdict(dict)
    for (ident, kind), detail in latest.items():
        if not detail.get('valid'):
            failed[ident][kind] = detail
    return dict(failed)


def build(catalog, candidates, failed_assets=None):
    failed_assets = failed_assets or {}
    by_domain, by_name = defaultdict(set), defaultdict(set)
    quality = {}
    catalog_audit = []
    counts = Counter()
    for row in catalog:
        ident = row['id']
        for value in (row.get('domain'), row.get('website')):
            host = domain_of(value)
            if host:
                by_domain[host].add(ident)
        for value in (row.get('name_ko'), row.get('name_en')):
            name = name_of(value)
            if name:
                by_name[name].add(ident)
        png, svg = claimed(row.get('has_png')), claimed(row.get('has_svg'))
        form = form_status(row)
        counts['published'] += 1
        counts['declared_png_missing' if png is False else 'declared_png_present' if png else 'png_unknown'] += 1
        counts['declared_svg_missing' if svg is False else 'declared_svg_present' if svg else 'svg_unknown'] += 1
        counts['forms_' + form['state']] += 1
        if form['state'] == 'recorded':
            for slot in form['missing']:
                counts['recorded_missing_' + slot] += 1
        failed = failed_assets.get(ident, {})
        quality[ident] = {'png': png, 'svg': svg, 'forms': form,
                          'assetRecheck': sorted(failed)}
        actions = []
        if png is False:
            actions.append('generate_or_collect_png')
        if svg is False:
            actions.append('find_official_svg')
        if form['state'] == 'recorded' and form['missing']:
            actions.append('collect_verified_forms')
        if form['state'] == 'unassessed':
            actions.append('assess_composition')
        if failed:
            actions.append('recheck_unreachable_assets')
            counts['brands_requiring_asset_recheck'] += 1
        catalog_audit.append({'id': ident, 'domain': domain_of(row.get('domain') or row.get('website')),
                              'png': png, 'svg': svg, 'forms': form,
                              'assetRecheck': sorted(failed), 'actions': actions})

    queue = []
    for candidate in candidates:
        domain_ids = by_domain.get(candidate['domain'], set())
        name_ids = by_name.get(name_of(candidate['name']), set())
        if len(domain_ids) == 1:
            target = next(iter(domain_ids))
            action = 'review_existing_update'
            if name_ids and target not in name_ids:
                action = 'resolve_identity_conflict'
        elif len(domain_ids) > 1:
            target, action = None, 'resolve_domain_ambiguity'
        elif len(name_ids) == 1:
            target, action = next(iter(name_ids)), 'review_name_match'
        elif len(name_ids) > 1:
            target, action = None, 'resolve_name_ambiguity'
        else:
            target, action = None, 'review_new_content'
        row = {**candidate, 'action': action, 'targetBrandId': target,
               'domainMatches': sorted(domain_ids), 'nameMatches': sorted(name_ids)}
        if target:
            row['targetQuality'] = quality[target]
        queue.append(row)
        counts['candidates_' + action] += 1
    queue.sort(key=lambda x: (0 if x['action'] == 'review_existing_update' else
                              1 if x['action'] == 'review_name_match' else
                              2 if x['action'].startswith('resolve_') else 3,
                              x['domain'], x['sha256']))
    return {'schemaVersion': 1, 'createdAt': datetime.now(timezone.utc).isoformat(),
            'policy': 'Review first-party identity and original artwork before an in-place variant update. Never infer a missing composition from absent legacy metadata. No automatic replacement or CMS write.',
            'counts': dict(counts), 'catalogAudit': catalog_audit, 'queue': queue}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--catalog', type=Path, required=True)
    parser.add_argument('--manifest', type=Path, action='append', required=True)
    parser.add_argument('--asset-sweep', type=Path, action='append', default=[],
                        help='Optional JSONL public-byte sweep; failures are recheck leads')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    catalog = json.loads(args.catalog.read_text())
    report = build(catalog, candidate_rows(args.manifest), asset_failures(args.asset_sweep))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(json.dumps({'queue': len(report['queue']), **report['counts']}, ensure_ascii=False))


if __name__ == '__main__':
    main()

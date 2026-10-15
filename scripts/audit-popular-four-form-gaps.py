#!/usr/bin/env python3
"""Queue missing confirmed logo forms among recently opened brand pages.

This read-only audit complements collection-roster gap checks. It never treats
an image's aspect ratio as proof of a symbol or a lockup.
"""
import argparse
import concurrent.futures
import datetime
import json
import runpy
import subprocess
from pathlib import Path
from urllib.parse import quote

from logo_variant_enrichment import SLOTS, coverage

ROOT = Path(__file__).resolve().parents[1]


def load_manifest(brand_id):
    url = f"https://semologo.com/api/logo-variants/?id={quote(brand_id)}"
    result = subprocess.run(
        ['curl', '--fail', '--silent', '--show-error', '--max-time', '10', url],
        capture_output=True, text=True, timeout=12,
    )
    if result.returncode:
        return brand_id, None, result.stderr.strip()[:160]
    try:
        manifest = json.loads(result.stdout)
        if not isinstance(manifest, dict) or not isinstance(manifest.get('variants'), list):
            raise ValueError('variants missing')
        return brand_id, manifest, None
    except (ValueError, TypeError) as error:
        return brand_id, None, str(error)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--days', type=int, default=7)
    parser.add_argument('--limit', type=int, default=50)
    parser.add_argument('--out', type=Path, default=ROOT / 'marketing/assets/popular-four-form-gaps/latest.json')
    args = parser.parse_args()
    if not 1 <= args.days <= 30 or not 1 <= args.limit <= 200:
        parser.error('days must be 1–30 and limit must be 1–200')

    publisher = runpy.run_path(str(ROOT / 'scripts/publish-svg-background-audit-20261014.py'))
    db = publisher['database'](publisher['secrets']()['DB_VIBERS_MAIN_URL'])
    with db.cursor() as cursor:
        cursor.execute('SET statement_timeout TO 10000')
        cursor.execute('''WITH recent AS (
          SELECT CASE
            WHEN event='brand_opened' THEN params->>'brand_id'
            WHEN event='page_view' AND path ~ '^/brand/[^/]+/?$' THEN split_part(path,'/',3)
          END AS brand_id
          FROM semologo.traffic_events
          WHERE created_at > now() - (%s || ' days')::interval
            AND event IN ('brand_opened','page_view')
        )
        SELECT brand_id,count(*)::int AS opens FROM recent
        WHERE brand_id ~ '^[[:alnum:]_.-]+$'
        GROUP BY brand_id ORDER BY opens DESC,brand_id LIMIT %s''', (args.days, args.limit))
        popular = cursor.fetchall()
    db.close()

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        results = dict((brand_id, (manifest, error)) for brand_id, manifest, error
                       in pool.map(load_manifest, (brand_id for brand_id, _ in popular)))

    items = []
    for brand_id, opens in popular:
        manifest, error = results[brand_id]
        forms = coverage(manifest) if manifest else None
        items.append({
            'id': brand_id, 'opens': opens,
            'present': {slot: forms['present'][slot] for slot in SLOTS} if forms else None,
            'missing': forms['missing'] if forms else [],
            'complete': bool(forms and forms['complete']),
            'manifest_unavailable': forms is None,
            'next_action': 'check-manifest-or-assets' if error else
                           'collect-missing-official-lockups' if forms['missing'] else
                           'review-duplicate-artwork' if not forms['complete'] else 'complete',
            **({'error': error} if error else {}),
        })
    report = {
        'checked_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'window_days': args.days, 'ranked_brands': len(items),
        'complete': sum(item['complete'] for item in items),
        'manifest_unavailable': sum(item['manifest_unavailable'] for item in items),
        'missing_by_form': {slot: sum(slot in item['missing'] for item in items) for slot in SLOTS},
        'items': items,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({key: value for key, value in report.items() if key != 'items'}, ensure_ascii=False))
    print('top_gaps', [(item['id'], item['opens'], item['missing']) for item in items[:10] if item['missing']])


if __name__ == '__main__':
    main()

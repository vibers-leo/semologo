#!/usr/bin/env python3
"""Deduplicate roster-linked identities and queue their missing lockups.

Published content stays published. This queue describes verified composition
gaps; it never guesses forms from image aspect ratio or changes a brand.
"""
import datetime
import json
import runpy
from collections import defaultdict
from pathlib import Path

from logo_variant_enrichment import SLOTS, coverage

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'marketing/assets/four-form-recollection-20261014'
publisher = runpy.run_path(str(ROOT / 'scripts/publish-svg-background-audit-20261014.py'))
db = publisher['database'](publisher['secrets']()['DB_VIBERS_MAIN_URL'])
query = '''WITH latest AS (
  SELECT DISTINCT ON (collection_id) id,collection_id FROM semologo.collection_snapshots
  ORDER BY collection_id,as_of DESC,id DESC
)
SELECT m.brand_id,m.name,m.review_status,m.metadata->>'png_verified' AS png_verified,
       s.collection_id,p.payload,v.asset_manifest->'variants' AS manifest
FROM latest s JOIN semologo.collection_members m ON m.snapshot_id=s.id
JOIN semologo.logo_posts p ON p.id=m.brand_id AND p.status='published'
LEFT JOIN semologo.logo_versions v ON v.brand_id=m.brand_id AND v.is_current
WHERE m.brand_id IS NOT NULL'''
with db.cursor() as cursor:
    cursor.execute(query)
    rows = cursor.fetchall()
db.close()

by_brand = {}
for ident, member_name, review_status, png_verified, collection_id, payload, manifest in rows:
    item = by_brand.setdefault(ident, {
        'id': ident, 'name': payload.get('name_ko') or payload.get('name_en') or member_name,
        'name_en': payload.get('name_en') or '', 'collections': set(),
        'official_source_page': payload.get('official_source_page') or payload.get('ci_page_url') or '',
        'website': payload.get('website') or '',
        'identity_verified': False, 'png_verified': False,
        'manifest': manifest or {'id': ident, 'variants': []},
    })
    item['collections'].add(collection_id)
    item['identity_verified'] |= review_status == 'verified'
    item['png_verified'] |= png_verified == 'true'

items = []
for item in by_brand.values():
    result = coverage(item.pop('manifest'))
    item['collections'] = sorted(item['collections'])
    item['forms'] = {slot: result['present'][slot] for slot in SLOTS}
    item['missing'] = result['missing']
    item['distinct_artwork'] = result['distinct_artwork']
    item['present_count'] = 4 - len(result['missing'])
    item['complete'] = item['identity_verified'] and item['png_verified'] and result['complete']
    if item['complete']:
        continue
    item['priority'] = (4 - item['present_count']) * 10 + (0 if item['official_source_page'] else 2)
    item['next_action'] = ('verify-identity-or-png' if not item['identity_verified'] or not item['png_verified']
                           else 'review-duplicate-artwork' if not item['missing']
                           else 'collect-missing-official-lockups')
    items.append(item)
items.sort(key=lambda item: (item['priority'], -len(item['collections']), item['id']))
OUT.mkdir(parents=True, exist_ok=True)
report = {'checked_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'policy': 'Identity and PNG verified plus four confirmed SVG/PNG composition forms; overlapping rosters deduplicated by brand_id.',
          'linked_unique': len(by_brand), 'complete_unique': len(by_brand) - len(items),
          'missing_by_form': {slot: sum(slot in item['missing'] for item in items) for slot in SLOTS},
          'items': items}
(OUT / 'queue.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
(OUT / 'top-100.json').write_text(json.dumps({**{k: v for k, v in report.items() if k != 'items'},
    'items': items[:100]}, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({key: value for key, value in report.items() if key != 'items'}, ensure_ascii=False))
print('near_complete', [(item['id'], item['missing']) for item in items[:12]])

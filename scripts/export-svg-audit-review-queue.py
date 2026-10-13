#!/usr/bin/env python3
"""Export the completed local SVG audit's unresolved identities for admin review."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
AUDIT = ROOT / 'marketing/assets/svg-full-audit-20261013'
OUT = ROOT / 'src/lib/svg-audit-review-queue.json'
REVIEW = {'manual-review', 'opaque-awaiting-review', 'failed'}

def main():
    scope = {item['id']: item for item in json.loads((AUDIT / 'scope.json').read_text())['items']}
    last = {}
    for line in (AUDIT / 'progress.jsonl').open():
        try:
            item = json.loads(line)
            last[item['id']] = item
        except (ValueError, KeyError):
            continue
    assert len(last) == len(scope), 'Audit must finish before queue export'
    items = []
    for ident, result in last.items():
        status = result['status']
        if status == 'background-removal-awaiting-review' and (
            not result.get('candidate_has_transparency') or result.get('background_elements') != 1
        ):
            status = 'candidate-needs-review'
        elif status == 'background-removal-awaiting-review' and scope[ident].get('has_png'):
            status = 'existing-png-review'
        if status not in REVIEW and status not in {'candidate-needs-review', 'existing-png-review'}:
            continue
        brand = scope[ident]
        items.append({
            'id': ident,
            'name_ko': brand.get('name_ko') or '',
            'name_en': brand.get('name_en') or '',
            'status': status,
            'reason': result.get('reason') or result.get('error') or '',
        })
    priority = {'failed': 0, 'candidate-needs-review': 1, 'existing-png-review': 2, 'manual-review': 3, 'opaque-awaiting-review': 4}
    items.sort(key=lambda item: (priority[item['status']], item['id']))
    OUT.write_text(json.dumps({'total': len(items), 'items': items}, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(json.dumps({'total': len(items), 'counts': {key: sum(x['status'] == key for x in items) for key in priority}}, ensure_ascii=False))

if __name__ == '__main__':
    main()

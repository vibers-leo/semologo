#!/usr/bin/env python3
"""Wrap seven GDWEB version manifests in the API's asset_manifest.variants shape."""

import runpy
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EXPECTED = {
    'dtribe': 'official-site-wordmark',
    'makervil': 'official-site-wordmark',
    'instantfunk': 'official-site-wordmark',
    'worxphere': 'official-site-wordmark',
    'seojinsystem': 'gdweb-official-20261016',
    'gigavis': 'gdweb-official-20261016',
    'saltlux': 'gdweb-official-20261016',
}


def main():
    helper = runpy.run_path(str(ROOT / 'scripts/publish-svg-background-audit-20261014.py'))
    secret = helper['secrets']()
    db = helper['database'](secret['DB_VIBERS_MAIN_URL'])
    changed = []
    with db:
        with db.cursor() as cursor:
            for ident, primary in EXPECTED.items():
                cursor.execute('SELECT id,asset_manifest FROM semologo.logo_versions WHERE brand_id=%s AND is_current FOR UPDATE', (ident,))
                rows = cursor.fetchall()
                assert len(rows) == 1, ident + ': expected one current version'
                version_id, manifest = rows[0]
                if isinstance(manifest.get('variants'), dict):
                    assert manifest['variants'].get('primary') == primary, ident + ': unexpected existing wrapper'
                    continue
                assert manifest.get('primary') == primary and isinstance(manifest.get('variants'), list), ident + ': unexpected manifest'
                cursor.execute('UPDATE semologo.logo_versions SET asset_manifest=jsonb_build_object(\'variants\',asset_manifest) WHERE id=%s', (version_id,))
                changed.append(ident)
    db.close()
    print({'wrapped': changed, 'total': len(EXPECTED)})


if __name__ == '__main__':
    main()

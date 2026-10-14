#!/usr/bin/env python3
"""Conservative composition coverage and duplicate-ingest enrichment.

Only publisher-confirmed forms count. Canvas ratio and OCR never prove that an
SVG contains a separable symbol or wordmark. Keep originals when a source is
ambiguous; a reviewer can then collect the missing official lockup.
"""
import argparse
import copy
import hashlib
import json
from pathlib import Path

SLOTS = ('symbol', 'horizontal', 'vertical', 'wordmark')


def form_of(variant):
    form = variant.get('lockup') or variant.get('form') or 'unknown'
    return form if form in SLOTS else None


def coverage(manifest):
    found = {slot: [] for slot in SLOTS}
    for variant in manifest.get('variants') or []:
        slot = form_of(variant)
        if slot and any((variant.get('files') or {}).get(ext) for ext in ('svg', 'png')):
            found[slot].append(variant['key'])
    return {'id': manifest.get('id'), 'present': found,
            'missing': [slot for slot in SLOTS if not found[slot]],
            'complete': all(found.values())}


def merge_variant(manifest, incoming):
    """Add new artwork or fill a duplicate's missing format/verified metadata.

    Same-key but changed artwork becomes a separate variant. A digest match can
    fill PNG on an existing SVG variant without throwing away its provenance.
    """
    variants = manifest.setdefault('variants', [])
    incoming = copy.deepcopy(incoming)
    files = incoming.get('files') or {}
    assert incoming.get('key') and any(files.get(k) for k in ('svg', 'png'))
    fingerprint = incoming.get('visual_sha256') or incoming.get('source_sha256')
    matching = next((v for v in variants if fingerprint and fingerprint in
                     (v.get('visual_sha256'), v.get('source_sha256'))), None)
    same_key = next((v for v in variants if v.get('key') == incoming['key']), None)
    if matching is None and same_key is not None:
        oldfiles = same_key.get('files') or {}
        conflict = any(oldfiles.get(ext) and files.get(ext) and oldfiles[ext] != files[ext]
                       for ext in ('svg', 'png'))
        matching = None if conflict else same_key
    if matching is not None:
        oldfiles = matching.setdefault('files', {})
        changed = False
        for ext, path in files.items():
            if path and not oldfiles.get(ext):
                oldfiles[ext] = path
                changed = True
        if form_of(matching) is None and form_of(incoming):
            matching['form'] = form_of(incoming)
            matching['lockup'] = form_of(incoming)
            changed = True
        for field in ('source_url', 'source_sha256', 'visual_sha256', 'preview_png'):
            if incoming.get(field) and not matching.get(field):
                matching[field] = incoming[field]
                changed = True
        return 'enriched' if changed else 'unchanged'
    if same_key is not None:
        suffix = (fingerprint or hashlib.sha256(json.dumps(files, sort_keys=True).encode()).hexdigest())[:10]
        incoming['key'] += '-' + suffix
        if any(v.get('key') == incoming['key'] for v in variants):
            return 'unchanged'
    incoming.setdefault('order', len(variants))
    variants.append(incoming)
    if not manifest.get('primary'):
        manifest['primary'] = incoming['key']
    return 'added'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--manifest', type=Path)
    parser.add_argument('--release', type=Path)
    parser.add_argument('--db-current', action='store_true', help='audit current reviewed CMS manifests')
    parser.add_argument('--out', type=Path)
    args = parser.parse_args()
    if sum((bool(args.manifest), bool(args.release), args.db_current)) != 1:
        parser.error('provide exactly one of --manifest, --release, or --db-current')
    if args.db_current:
        import runpy
        publisher = runpy.run_path(str(Path(__file__).with_name('publish-svg-background-audit-20261014.py')))
        db = publisher['database'](publisher['secrets']()['DB_VIBERS_MAIN_URL'])
        with db.cursor() as cursor:
            cursor.execute("SELECT brand_id,asset_manifest->'variants' FROM semologo.logo_versions WHERE is_current AND asset_manifest ? 'variants'")
            manifests = [{**(row[1] or {}), 'id': row[0]} for row in cursor.fetchall()]
        db.close()
    else:
        source = args.manifest or args.release
        data = json.loads(source.read_text())
        manifests = [data] if args.manifest else list((data.get('variants') or {}).values())
    report = {'total': len(manifests), 'complete': 0, 'needs': [], 'slot_counts': {slot: 0 for slot in SLOTS}}
    for manifest in manifests:
        result = coverage(manifest)
        report['complete'] += result['complete']
        for slot in SLOTS:
            report['slot_counts'][slot] += bool(result['present'][slot])
        if result['missing']:
            report['needs'].append({'id': result['id'], 'missing': result['missing']})
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({key: value for key, value in report.items() if key != 'needs'}, ensure_ascii=False))


if __name__ == '__main__':
    main()

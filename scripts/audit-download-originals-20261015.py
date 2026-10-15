#!/usr/bin/env python3
"""Inventory user-supplied logo originals without reading unrelated documents."""
import collections
import hashlib
import json
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOWNLOADS = Path('/Users/juuuno/Downloads')
OUT = ROOT / 'marketing/assets/download-original-audit-20261015'
PREVIOUS = ROOT / 'marketing/assets/download-logo-audit-20261010/audit.json'
LOGO_PDFS = {'CI_basic.pdf', 'CI_application.pdf', '2026 네이버 블로그 리브랜딩.pdf',
             '[배달의민족]로고사용가이드_꼭 읽어보세요.pdf'}
LOGO_PNG_NAMES = {'CJON.png', '삼성카드.png', '지그재그-로고-01-scaled.png',
    '지그재그-로고-02-scaled.png', '지그재그-로고-03-scaled.png',
    '지그재그-로고-04-scaled.png', '지그재그-로고-05-scaled.png'}
BATCHES = {
    '1.svg': 'figma-airline-collection-20261010',
    'Better Logos (Community).zip': 'figma-better-collection-20261010',
    'Logos - Payment (Community).svg': 'figma-payment-collections-20261010',
    'Payment Methods Logicons_ UI-Ready Logos & Icons for Fintech, Payments & SaaS Products (Community).svg': 'figma-payment-collections-20261010',
    'Payment Methods Logicons_ UI-Ready Logos & Icons for Fintech, Payments & SaaS Products (Community).zip': 'figma-payment-collections-20261010',
    '❖ Premium company logos UI kit – Untitled UI (Community).zip': 'figma-premium-collection-20261010',
}


def norm(value):
    return unicodedata.normalize('NFC', value)


def main():
    previous = {norm(r['name']): r for r in json.loads(PREVIOUS.read_text())['files']}
    releases = list((ROOT / 'src/lib').glob('reviewed*.json'))
    release_text = {p.name: p.read_text(errors='replace') for p in releases}
    scripts = [p for p in (ROOT / 'scripts').glob('*.py') if p.name != Path(__file__).name]
    script_text = {p.name: p.read_text(errors='replace') for p in scripts}
    items = []
    for path in sorted(DOWNLOADS.iterdir(), key=lambda p: norm(p.name).casefold()):
        if not path.is_file() or path.is_symlink():
            continue
        name = norm(path.name)
        if path.suffix.lower() not in {'.ai', '.svg', '.zip'} and name not in LOGO_PDFS | LOGO_PNG_NAMES:
            continue
        data = path.read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        exact = [file for file, text in release_text.items() if digest[:20] in text]
        used_by = [file for file, text in script_text.items() if name in text]
        prior = previous.get(name)
        batch = BATCHES.get(name)
        batch_proof = ROOT / 'marketing/assets' / batch / 'published.json' if batch else None
        row = {'name': name, 'bytes': len(data), 'sha256': digest,
               'exactReleaseReferences': exact, 'processingScripts': used_by,
               'previousStatus': prior['status'] if prior else None}
        if batch_proof and batch_proof.is_file():
            row['partialBatchEvidence'] = {'directory': batch, **json.loads(batch_proof.read_text())}
        if exact:
            row['assessment'] = 'exact_source_referenced'
        elif row.get('partialBatchEvidence'):
            row['assessment'] = 'partial_collection'
        elif name == 'logo_ai.zip':
            row['assessment'] = 'derived_lg_chem_served_original_zip_unlinked'
        elif prior and prior['status'] == 'already_served':
            row['assessment'] = 'previously_served_recheck_needed'
        elif prior and prior['status'] == 'partially_served':
            row['assessment'] = 'partial_collection'
        elif prior and prior['status'] == 'ambiguous':
            row['assessment'] = 'identity_review_needed'
        elif prior and prior['status'] == 'unreflected_evidence':
            row['assessment'] = 'publication_unconfirmed'
        elif used_by:
            row['assessment'] = 'processed_publication_unconfirmed'
        else:
            row['assessment'] = 'no_publication_evidence'
        items.append(row)
    OUT.mkdir(parents=True, exist_ok=True)
    summary = dict(collections.Counter(r['assessment'] for r in items))
    report = {'schemaVersion': 1, 'scope': 'Downloads top-level AI/SVG/ZIP and four logo PDFs/seven logo PNGs; symlinks excluded',
              'fileCount': len(items), 'summary': summary, 'files': items}
    (OUT / 'audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'fileCount': len(items), 'summary': summary}, ensure_ascii=False))


if __name__ == '__main__':
    main()

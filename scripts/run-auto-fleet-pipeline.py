#!/usr/bin/env python3
"""Resumable Windows result -> first-party download -> review -> CMS cycle."""
import argparse
import fcntl
import json
import os
import runpy
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE = runpy.run_path(str(ROOT / 'scripts/fleet-auto-core.py'))
PUBLISH = runpy.run_path(str(ROOT / 'scripts/fleet-auto-publish.py'))
STATE = ROOT / 'fleet-auto-state'
ZERO = {'createdAt': '1970-01-01T00:00:00Z', 'id': '00000000-0000-0000-0000-000000000000'}


def cycle(limit, apply):
    STATE.mkdir(exist_ok=True)
    cursor_file = STATE / 'cursor.json'
    cursor = json.loads(cursor_file.read_text()) if cursor_file.exists() else ZERO
    jobs = CORE['jobs_after'](cursor, limit)
    if not jobs:
        return {'status': 'caught_up', 'cursor': cursor}
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    folder = STATE / ('batch-' + stamp + '-' + jobs[0]['id'][:8])
    folder.mkdir(exist_ok=True)
    s3 = CORE['s3_client']()
    signals, staged = CORE['stage_jobs'](s3, jobs, folder)
    by_domain, by_name, ids = CORE['cms_catalog']()
    reviewed, published, held, publish_errors = [], [], [], []
    chosen_new = set()
    for item in staged:
        domain = CORE['host'](item.get('domain'))
        reason = ''
        if item.get('status') != 'staged_review_required':
            reason = item.get('status', 'failed') + ':' + item.get('error', '')[:80]
        elif len(by_domain.get(domain, [])) > 1:
            reason = 'ambiguous_existing_domain'
        else:
            reason = CORE['source_reason'](item)
        if not reason:
            try:
                raw = (folder / item['file']).read_bytes()
                if CORE['sha'](raw) != item['sha256']:
                    raise ValueError('staged_hash_changed')
                png, image = CORE['review_svg'](raw)
                matches = by_domain.get(domain, [])
                name = (matches[0].get('name_en') or matches[0].get('name_ko')) if matches else item.get('name', '')
                text = CORE['matched_ocr'](CORE['ocr'](image), name, domain, not bool(matches))
                if not text:
                    raise ValueError('identity_ocr_unconfirmed')
                if matches:
                    ident = matches[0]['id']
                else:
                    ident = domain.replace('.', '-')
                    if ident in ids or CORE['fold'](CORE['title'](name)) in by_name or domain in chosen_new:
                        raise ValueError('new_identity_collision')
                    chosen_new.add(domain)
                _, _, current = CORE['STAGE']['secure_get'](item['assetUrl'], domain, 150000)
                if current != raw:
                    raise ValueError('official_source_changed')
                evidence = {'targetId': ident, 'domain': domain, 'name': CORE['title'](name),
                            'sha256': CORE['sha'](raw), 'sourceUrl': item['assetUrl'],
                            'ocr': text, 'identity': 'exact-domain' if matches else 'name-domain-ocr'}
                reviewed.append(evidence)
                if apply:
                    try:
                        if matches:
                            status = PUBLISH['existing'](CORE['node'], s3, CORE['sha'], ident, item, raw, png)
                        else:
                            status = PUBLISH['new'](CORE['node'], s3, CORE['sha'], ident,
                                                    CORE['title'](name), item, raw, png)
                            by_domain[domain] = [{'id': ident, 'name_en': CORE['title'](name)}]
                            ids.add(ident)
                        published.append({'id': ident, 'status': status, 'sha256': CORE['sha'](raw)})
                    except Exception as error:
                        publish_errors.append({'id': ident, 'domain': domain,
                                               'sha256': CORE['sha'](raw), 'reason': str(error)[:180]})
            except Exception as error:
                reason = str(error)[:180]
        if reason:
            held.append({'domain': domain, 'sha256': item.get('sha256'),
                         'sourceUrl': item.get('assetUrl'), 'reason': reason})
    next_cursor = {'createdAt': jobs[-1]['created_at'], 'id': jobs[-1]['id']}
    receipt = {'schemaVersion': 1, 'at': datetime.now(timezone.utc).isoformat(),
               'mode': 'apply' if apply else 'dry-run', 'jobs': len(jobs), 'signals': len(signals),
               'staged': staged, 'reviewed': reviewed, 'published': published, 'held': held,
               'publishErrors': publish_errors, 'nextCursor': next_cursor}
    (folder / 'receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
    if apply and not publish_errors:
        temporary = cursor_file.with_suffix('.tmp')
        temporary.write_text(json.dumps(next_cursor) + '\n')
        temporary.replace(cursor_file)
    return {'status': 'retry_required' if publish_errors else 'processed',
            'mode': receipt['mode'], 'jobs': len(jobs), 'signals': len(signals),
            'reviewed': len(reviewed), 'published': len(published), 'held': len(held),
            'publishErrors': len(publish_errors),
            'cursor': next_cursor if not publish_errors else cursor,
            'receipt': str(folder / 'receipt.json')}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--limit-jobs', type=int, default=100)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    if not 1 <= args.limit_jobs <= 200:
        parser.error('bounded limit required')
    if not os.path.ismount('/Volumes/HDD-1TB'):
        raise SystemExit('HDD-1TB is not mounted; intake state must stay on the external drive')
    STATE.mkdir(exist_ok=True)
    with (STATE / 'pipeline.lock').open('w') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print(json.dumps({'status': 'already_running'}))
            return
        result = cycle(args.limit_jobs, args.apply)
    print(json.dumps(result, ensure_ascii=False))
    if result['status'] == 'retry_required':
        raise SystemExit(1)


if __name__ == '__main__':
    main()

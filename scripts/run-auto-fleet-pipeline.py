#!/usr/bin/env python3
"""Resumable Windows result -> first-party download -> review -> CMS cycle."""
import argparse
import fcntl
import json
import os
import runpy
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE = runpy.run_path(str(ROOT / 'scripts/fleet-auto-core.py'))
PUBLISH = runpy.run_path(str(ROOT / 'scripts/fleet-auto-publish.py'))
STATE = ROOT / 'fleet-auto-state'
ZERO = {'createdAt': '1970-01-01T00:00:00Z', 'id': '00000000-0000-0000-0000-000000000000'}
RETRY_LIMIT = 3
RETRY_PER_CYCLE = 20


def retryable_download(row):
    if row.get('status') != 'failed':
        return False
    error = row.get('error', '').lower()
    return any(token in error for token in (
        'timed out', 'timeout', 'temporarily', 'connection reset',
        'network is unreachable', 'http error 429', 'http error 500',
        'http error 502', 'http error 503', 'http error 504'))


def asset_key(row):
    return (row.get('domain'), row.get('assetUrl'))


def next_download_retries(previous, staged):
    pending = {asset_key(row): row for row in previous}
    for row in staged:
        key = asset_key(row)
        if retryable_download(row):
            attempt = pending.get(key, {}).get('attempts', 0) + 1
            if attempt < RETRY_LIMIT:
                pending[key] = {field: row.get(field) for field in
                                ('domain', 'pageUrl', 'name', 'assetUrl')}
                pending[key]['attempts'] = attempt
            else:
                pending.pop(key, None)
        else:
            pending.pop(key, None)
    return list(pending.values())


def cycle(limit, apply):
    STATE.mkdir(exist_ok=True)
    cursor_file = STATE / 'cursor.json'
    retry_file = STATE / 'download-retries.json'
    cursor = json.loads(cursor_file.read_text()) if cursor_file.exists() else ZERO
    pending_retries = json.loads(retry_file.read_text()) if retry_file.exists() else []
    jobs = CORE['jobs_after'](cursor, limit)
    if not jobs and not pending_retries:
        return {'status': 'caught_up', 'cursor': cursor}
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    folder = STATE / ('batch-' + stamp + '-' + (jobs[0]['id'][:8] if jobs else 'retry-only'))
    folder.mkdir(exist_ok=True)
    s3 = CORE['s3_client']()
    signals, staged = CORE['stage_jobs'](s3, jobs, folder)
    retry_batch = pending_retries[:RETRY_PER_CYCLE]
    retried = [CORE['STAGE']['fetch']((row['domain'], row['pageUrl'], row['name'],
                                      'download-retry', row['assetUrl']), folder)
               for row in retry_batch]
    staged = list({asset_key(row): row for row in staged + retried}.values())
    updated_retries = next_download_retries(pending_retries, staged)
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
    next_cursor = ({'createdAt': jobs[-1]['created_at'], 'id': jobs[-1]['id']}
                   if jobs else cursor)
    receipt = {'schemaVersion': 1, 'at': datetime.now(timezone.utc).isoformat(),
               'mode': 'apply' if apply else 'dry-run', 'jobs': len(jobs), 'signals': len(signals),
               'staged': staged, 'reviewed': reviewed, 'published': published, 'held': held,
               'publishErrors': publish_errors, 'nextCursor': next_cursor,
               'downloadRetriesAttempted': len(retry_batch),
               'downloadRetriesPending': updated_retries}
    (folder / 'receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
    if apply:
        temporary_retry = retry_file.with_suffix('.tmp')
        temporary_retry.write_text(json.dumps(updated_retries, ensure_ascii=False) + '\n')
        temporary_retry.replace(retry_file)
    if apply and not publish_errors and jobs:
        temporary = cursor_file.with_suffix('.tmp')
        temporary.write_text(json.dumps(next_cursor) + '\n')
        temporary.replace(cursor_file)
    return {'status': 'retry_required' if publish_errors else 'processed',
            'mode': receipt['mode'], 'jobs': len(jobs), 'signals': len(signals),
            'reviewed': len(reviewed), 'published': len(published), 'held': len(held),
            'publishErrors': len(publish_errors),
            'downloadRetriesPending': len(updated_retries),
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
    ocr_engine = Path('/opt/homebrew/bin/tesseract')
    if not ocr_engine.is_file():
        raise SystemExit('OCR engine missing; cursor must not advance')
    languages = subprocess.run([str(ocr_engine), '--list-langs'], capture_output=True,
                               text=True, timeout=10, check=True).stdout.splitlines()
    if 'eng' not in languages:
        raise SystemExit('English OCR data missing; cursor must not advance')
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

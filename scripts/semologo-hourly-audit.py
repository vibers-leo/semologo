#!/usr/bin/env python3
"""Run one bounded publish pass and verify the last hour's fleet-to-front flow."""

import json
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
STATE = ROOT / 'fleet-auto-state'
REPORTS = STATE / 'hourly-audit'
UTC = timezone.utc


def command(args, *, input_text=None, timeout=120):
    result = subprocess.run(args, input=input_text, capture_output=True, text=True, timeout=timeout)
    if result.returncode:
        raise RuntimeError(f'{args[0]} exit {result.returncode}: {result.stderr.strip()[-300:]}')
    return result.stdout.strip()


def fleet_status():
    source = r'''const {Pool}=require('pg'); (async()=>{const p=new Pool({connectionString:process.env.FLEET_DATABASE_URL,max:1});try{const q=await p.query("select kind,owner,status,count(*)::int n from fleet.job where tenant='internal' and project='semologo' and kind in ('semologo-domain-discover','semologo-logo-collect') and created_at>=now()-interval '1 hour' group by kind,owner,status order by kind,owner,status");console.log(JSON.stringify(q.rows))}finally{await p.end()}})().catch(e=>{console.error(e.message);process.exit(1)})'''
    return json.loads(command(['ssh', 'vibers', 'docker exec -i vibers-fleet node -'], input_text=source))


def receipts_since(since):
    rows = []
    for file in STATE.glob('batch-*/receipt.json'):
        try:
            row = json.loads(file.read_text())
            if datetime.fromisoformat(row['at']) >= since:
                rows.append(row)
        except (ValueError, KeyError, OSError):
            continue
    return sorted(rows, key=lambda row: row['at'])


def front_check(ident):
    url = f'https://semologo.com/brand/{ident}/'
    try:
        request = Request(url, headers={'User-Agent': 'SemoLogo-hourly-audit/1.0'})
        with urlopen(request, timeout=15) as response:
            body = response.read(150000).decode('utf-8', 'replace')
            return {'id': ident, 'status': response.status, 'visible': response.status == 200 and ident in body}
    except Exception as error:
        return {'id': ident, 'status': None, 'visible': False, 'error': str(error)[:160]}


def main():
    if not Path('/Volumes/HDD-1TB').is_mount():
        raise SystemExit('HDD-1TB is not mounted')
    started = datetime.now(UTC)
    # The regular 5-minute publisher remains the primary path. Its file lock
    # makes this hourly pass a no-op if one is already processing a batch.
    publisher = subprocess.run(
        ['/opt/homebrew/bin/python3', str(ROOT / 'scripts/run-auto-fleet-pipeline.py'), '--limit-jobs', '100', '--apply'],
        capture_output=True, text=True, timeout=1800,
    )
    publisher_line = publisher.stdout.strip().splitlines()[-1:] or []
    try:
        publisher_result = json.loads(publisher_line[0]) if publisher_line else None
    except ValueError:
        publisher_result = None
    since = started - timedelta(hours=1)
    receipts = receipts_since(since)
    published = [entry for row in receipts for entry in row.get('published', [])]
    new_ids = list(dict.fromkeys(entry['id'] for entry in published if entry.get('status') == 'published_new'))
    sampled = [front_check(ident) for ident in new_ids[-3:]]
    try:
        timers = command(['ssh', 'vibers', 'systemctl is-active semologo-domain-discover.timer semologo-hourly.timer']).splitlines()
        feeder_result = command(['ssh', 'vibers', 'systemctl show semologo-domain-discover.service -p Result --value'])
        fleet = fleet_status()
        fleet_error = None
    except Exception as error:
        timers, feeder_result, fleet, fleet_error = [], None, [], str(error)[:300]
    report = {
        'at': datetime.now(UTC).isoformat(),
        'windowStart': since.isoformat(),
        'publisherExit': publisher.returncode,
        'publisherResult': publisher_result,
        'publisherError': publisher.stderr.strip()[-300:] if publisher.returncode else None,
        'receipts': len(receipts),
        'processedJobs': sum(row.get('jobs', 0) for row in receipts),
        'publishedNew': len(new_ids),
        'updatedExisting': sum(entry.get('status') == 'updated_existing' for entry in published),
        'heldCandidates': sum(len(row.get('held', [])) for row in receipts),
        'publishErrors': sum(len(row.get('publishErrors', [])) for row in receipts),
        'latestBatchPublishErrors': len(receipts[-1].get('publishErrors', [])) if receipts else None,
        'lastReceiptAt': receipts[-1]['at'] if receipts else None,
        'fleetLastHour': fleet,
        'fleetError': fleet_error,
        'feederResult': feeder_result,
        'timers': timers,
        'frontSamples': sampled,
    }
    report['healthy'] = bool(
        receipts and publisher.returncode == 0 and fleet_error is None
        and timers == ['active', 'active'] and feeder_result == 'success'
        and report['latestBatchPublishErrors'] == 0
        and all(sample['visible'] for sample in sampled)
    )
    REPORTS.mkdir(parents=True, exist_ok=True)
    temporary = REPORTS / 'latest.tmp'
    temporary.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(REPORTS / 'latest.json')
    with (REPORTS / 'history.jsonl').open('a') as log:
        log.write(json.dumps(report, ensure_ascii=False) + '\n')
    print(json.dumps(report, ensure_ascii=False))
    return 0 if report['healthy'] else 1


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as error:
        print(json.dumps({'at': datetime.now(UTC).isoformat(), 'error': str(error)[:300]}), file=sys.stderr)
        sys.exit(1)

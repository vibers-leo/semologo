#!/usr/bin/env python3
"""Turn reviewed fleet domain signals into a private, deduplicated file batch.

This intentionally stops before CMS publication. Run on the central Mac, whose
bucket credential can read immutable fleet artifacts; Windows has no CMS key.
"""
import argparse
import concurrent.futures
import hashlib
import ipaddress
import json
import os
import re
import socket
import subprocess
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser
from datetime import datetime, timezone
from pathlib import Path

import boto3
from botocore.config import Config

ROOT = Path(__file__).resolve().parents[1]
PREFIX = 'automation/v1/tenants/internal/projects/semologo/runs/'
BUCKET = 'vibers-bucket'
UA = 'SemoLogo-logo-discovery/1.0 (+https://semologo.com/)'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def fleet_jobs(limit, request_prefix=None):
    query = """const {Pool}=require('pg');const p=new Pool({connectionString:process.env.FLEET_DATABASE_URL});
    (async()=>{const r=await p.query("select id,owner,result from fleet.job where project='semologo' and kind='semologo-domain-discover' and status='succeeded' and ($2::text is null or request_key like $2) order by created_at desc limit $1",[Number(process.argv[2]),process.argv[3]==='-'?null:process.argv[3]+'%']);console.log(JSON.stringify(r.rows));await p.end()})().catch(e=>{console.error(e.message);process.exit(1)})"""
    proc = subprocess.run(['ssh', 'vibers', 'docker exec -i vibers-fleet node - ' + str(limit) + ' ' + (request_prefix or '-')],
                          input=query, capture_output=True, text=True, check=True)
    return json.loads(proc.stdout)


def s3_client():
    if not os.environ.get('NCP_ACCESS_KEY') or not os.environ.get('NCP_SECRET_KEY'):
        raise RuntimeError('Central NCP credential environment is required')
    return boto3.client('s3', endpoint_url='https://kr.object.ncloudstorage.com', region_name='kr-standard',
        aws_access_key_id=os.environ['NCP_ACCESS_KEY'], aws_secret_access_key=os.environ['NCP_SECRET_KEY'],
        config=Config(signature_version='s3v4', max_pool_connections=32,
                      request_checksum_calculation='when_required', response_checksum_validation='when_required'))


def read_job(s3, job):
    key = job['result']['manifestKey']
    digest = job['result']['manifestHash']
    if not key.startswith(PREFIX + job['id'] + '/') or not key.endswith(digest + '.manifest.json') or not re.fullmatch('[a-f0-9]{64}', digest):
        raise ValueError('Invalid fleet artifact reference')
    raw = s3.get_object(Bucket=BUCKET, Key=key)['Body'].read()
    if sha(raw) != digest:
        raise ValueError('Fleet manifest hash mismatch')
    manifest = json.loads(raw)
    result_key = manifest['resultKey']
    if manifest['jobId'] != job['id'] or not result_key.startswith(PREFIX + job['id'] + '/'):
        raise ValueError('Fleet manifest job mismatch')
    raw = s3.get_object(Bucket=BUCKET, Key=result_key)['Body'].read()
    if len(raw) != manifest['size'] or sha(raw) != manifest['sha256']:
        raise ValueError('Fleet result hash mismatch')
    result = json.loads(raw)
    if result['jobId'] != job['id'] or result['kind'] != 'semologo-domain-discover':
        raise ValueError('Fleet result identity mismatch')
    return result['results']


def public_first_party(url, domain):
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != 'https' or parsed.port or parsed.username or parsed.password or parsed.hostname not in (domain, 'www.' + domain):
        return False
    for info in socket.getaddrinfo(parsed.hostname, 443, type=socket.SOCK_STREAM):
        if not ipaddress.ip_address(info[4][0]).is_global:
            return False
    return True


def secure_get(url, domain, limit):
    if not public_first_party(url, domain):
        raise ValueError('URL is not public first-party HTTPS')

    class FirstPartyRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, request, fp, code, msg, headers, next_url):
            absolute = urllib.parse.urljoin(request.full_url, next_url)
            if not public_first_party(absolute, domain):
                raise ValueError('Redirect left public first-party HTTPS')
            return super().redirect_request(request, fp, code, msg, headers, absolute)

    opener = urllib.request.build_opener(FirstPartyRedirect())
    request = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'image/svg+xml,image/png,image/webp,*/*;q=0.5'})
    with opener.open(request, timeout=12) as response:
        raw = response.read(limit + 1)
        if len(raw) > limit:
            raise ValueError('response too large')
        return response.url, response.headers.get_content_type(), raw


def robots_allows(domain):
    try:
        _, _, raw = secure_get('https://' + domain + '/robots.txt', domain, 512_000)
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return True
        raise ValueError('robots.txt not readable') from error
    parser = urllib.robotparser.RobotFileParser()
    parser.parse(raw.decode('utf-8', 'replace').splitlines())
    return parser.can_fetch(UA, 'https://' + domain + '/')


def fetch(candidate, output):
    domain, page, name, kind, url = candidate
    row = {'domain': domain, 'pageUrl': page, 'name': name, 'signal': kind, 'assetUrl': url, 'status': 'failed'}
    try:
        if not public_first_party(url, domain):
            raise ValueError('Asset URL is not public first-party HTTPS')
        if not robots_allows(domain):
            raise ValueError('Robots rule disallows collection')
        final, content_type, raw = secure_get(url, domain, 1_000_000)
        if not public_first_party(final, domain):
            raise ValueError('Asset redirect left public first-party HTTPS')
        head = raw[:2048].lower()
        if b'<svg' in head and content_type in ('image/svg+xml', 'text/xml', 'application/xml', 'text/plain', 'application/octet-stream'):
            extension = '.svg'
        elif raw.startswith(b'\x89PNG\r\n\x1a\n'):
            extension = '.png'
        elif raw.startswith(b'RIFF') and raw[8:12] == b'WEBP':
            extension = '.webp'
        else:
            row['status'] = 'unsupported_content'
            return row
        digest = sha(raw)
        target = output / (digest + extension)
        if target.exists():
            if target.read_bytes() != raw:
                raise ValueError('Digest collision or altered staged asset')
        else:
            target.write_bytes(raw)
        row.update(status='staged_review_required', sha256=digest, bytes=len(raw), file=target.name,
                   contentType=content_type)
    except Exception as error:
        row['error'] = str(error)[:180]
    return row


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--limit-jobs', type=int, default=500)
    parser.add_argument('--workers', type=int, default=16)
    parser.add_argument('--request-prefix', default=None)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if not 1 <= args.limit_jobs <= 2000 or not 1 <= args.workers <= 24:
        parser.error('limit-jobs 1–2000 and workers 1–24 are required')
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    s3 = s3_client()
    if args.request_prefix and not re.fullmatch(r'[a-z0-9-]{1,90}', args.request_prefix):
        parser.error('request-prefix must be a simple fleet request-key prefix')
    jobs = fleet_jobs(args.limit_jobs, args.request_prefix)
    candidates, errors = [], []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        for job, future in zip(jobs, pool.map(lambda j: read_job(s3, j), jobs)):
            for result in future:
                if result.get('status') != 'candidate_review_required':
                    continue
                domain = result['domain']
                for url in result.get('logoCandidates', [])[:3]:
                    if isinstance(url, str):
                        candidates.append((domain, result.get('pageUrl', ''), result.get('name', ''), 'first-party-logo', url))
    candidates = list(dict.fromkeys(candidates))
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        rows = list(pool.map(lambda c: fetch(c, output), candidates))
    staged = [r for r in rows if r['status'] == 'staged_review_required']
    report = {'schemaVersion': 1, 'createdAt': datetime.now(timezone.utc).isoformat(),
              'publication': 'private file staging only; identity, visual quality and CMS review required',
              'jobsRead': len(jobs), 'candidateUrls': len(candidates), 'stagedFiles': len({r['file'] for r in staged}),
              'stagedDomains': len({r['domain'] for r in staged}), 'results': rows, 'errors': errors}
    (output / 'manifest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: report[k] for k in ('jobsRead', 'candidateUrls', 'stagedFiles', 'stagedDomains')}, ensure_ascii=False))


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Daily news-to-logo lead discovery. This script never downloads logos or publishes brands."""

import argparse
import hashlib
import json
import os
import re
import tempfile
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / 'data/collection/trend-watch-topics.json'
DEFAULT_OUTPUT = ROOT / 'marketing/assets/trend-watch'
RSS_BASE = 'https://news.google.com/rss/search'
LOGO_TERMS = ('로고', 'CI', 'BI', '엠블럼', '상징', '마스코트', '캐릭터', '심볼')
ANNOUNCE_TERMS = ('공개', '발표', '선보', '출시', '변경', '교체', '리뉴얼', '공모', '선정')


def atomic_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix='.' + path.name, dir=path.parent)
    try:
        with os.fdopen(fd, 'w') as stream:
            json.dump(data, stream, ensure_ascii=False, indent=2)
            stream.write('\n')
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def news_url(query):
    return RSS_BASE + '?' + urlencode({'q': query, 'hl': 'ko', 'gl': 'KR', 'ceid': 'KR:ko'})


def fetch(query):
    request = Request(news_url(query), headers={'User-Agent': 'Mozilla/5.0 SemoLogoTrendWatch/1.0'})
    with urlopen(request, timeout=25) as response:
        if response.status != 200:
            raise RuntimeError(f'RSS HTTP {response.status}')
        return response.read(2_000_000)


def parse_feed(raw, now, days):
    root = ET.fromstring(raw)
    if root.find('./channel') is None:
        raise ValueError('RSS channel missing')
    cutoff = now - timedelta(days=days)
    articles = []
    for item in root.findall('./channel/item'):
        title = (item.findtext('title') or '').strip()
        link = (item.findtext('link') or '').strip()
        publisher = (item.findtext('source') or '').strip()
        published = (item.findtext('pubDate') or '').strip()
        if not title or not link or not published or not link.startswith('https://news.google.com/'):
            continue
        try:
            at = parsedate_to_datetime(published).astimezone(timezone.utc)
        except (TypeError, ValueError):
            continue
        if at < cutoff or at > now + timedelta(hours=2):
            continue
        if publisher and title.endswith(' - ' + publisher):
            title = title[:-(len(publisher) + 3)].strip()
        key = hashlib.sha256(link.encode()).hexdigest()[:20]
        articles.append({'id': key, 'title': title, 'news_url': link,
                         'publisher': publisher, 'published_at': at.isoformat()})
    return articles


def topic_matches(title, topic):
    lowered = title.casefold()
    return any(alias.casefold() in lowered for alias in topic['aliases'])


def headline_group(title):
    # Many outlets report the same announcement with different wording. This
    # prefix is a review hint, not a verified brand identity.
    prefix = re.split(r'[,，]|…|\.\.\.|\s[—–-]\s', title, maxsplit=1)[0].strip('“”‘’\'" ')
    return prefix if 2 <= len(prefix) <= 28 else title


def build_queue(articles, topics, seen, now):
    queue = []
    for topic in topics:
        matching = [row for row in articles if topic_matches(row['title'], topic)]
        if not matching:
            continue
        matching.sort(key=lambda row: row['published_at'], reverse=True)
        has_asset_signal = any(any(term.casefold() in row['title'].casefold() for term in LOGO_TERMS)
                               for row in matching)
        publishers = len({row['publisher'] for row in matching if row['publisher']})
        new = sum(row['id'] not in seen for row in matching)
        score = min(5, len(matching)) * 10 + min(3, publishers) * 5 + (20 if has_asset_signal else 0)
        if new:
            score += 10
        queue.append({'id': topic['id'], 'name': topic['name'], 'kind': topic['kind'],
                      'catalog_id': topic.get('catalog_id'), 'priority': score,
                      'articles': matching[:12], 'article_count': len(matching),
                      'new_article_count': new, 'publishers': publishers,
                      'asset_signal': has_asset_signal,
                      'status': 'needs_official_asset_review' if topic['kind'] == 'seasonal_official'
                      else 'needs_identity_and_editorial_review',
                      'review_note': topic['review_note']})
    generic = [row for row in articles if not any(topic_matches(row['title'], topic) for topic in topics)
               and any(term.casefold() in row['title'].casefold() for term in LOGO_TERMS)
               and any(term in row['title'] for term in ANNOUNCE_TERMS)]
    groups = {}
    for row in generic:
        groups.setdefault(headline_group(row['title']), []).append(row)
    for name, rows in groups.items():
        rows.sort(key=lambda row: row['published_at'], reverse=True)
        new = sum(row['id'] not in seen for row in rows)
        publishers = len({row['publisher'] for row in rows if row['publisher']})
        key = hashlib.sha256(name.casefold().encode()).hexdigest()[:16]
        score = min(5, len(rows)) * 10 + min(3, publishers) * 5 + (10 if new else 0)
        queue.append({'id': 'headline-' + key, 'name': name, 'kind': 'unclassified',
                      'catalog_id': None, 'priority': score,
                      'articles': rows[:12], 'article_count': len(rows),
                      'new_article_count': new, 'publishers': publishers,
                      'asset_signal': True, 'status': 'needs_entity_and_official_source_review',
                      'review_note': '기사 제목은 발견 단서일 뿐이다. 브랜드·행사 동일성과 공식 배포 원본을 확인한 후 수집한다.'})
    queue.sort(key=lambda item: (-item['priority'], -item['new_article_count'], item['id']))
    return {'schema_version': 1, 'generated_at': now.isoformat(), 'review_only': True,
            'policy': 'News is discovery evidence, never a logo source. No automatic image extraction, synthetic official logo, catalog publication, or four-form completion count.',
            'candidates': queue}


def run(config_path, output_dir, fixture=None, now=None):
    now = now or datetime.now(timezone.utc)
    config = json.loads(config_path.read_text())
    assert config['schema_version'] == 1
    previous = output_dir / 'seen.json'
    seen = json.loads(previous.read_text()) if previous.exists() else {}
    queries = list(config['queries']) + [item['query'] for item in config['topics']]
    feeds = json.loads(fixture.read_text()) if fixture else None
    articles, failures = {}, []
    succeeded = 0
    for query in queries:
        try:
            raw = feeds[query].encode() if feeds is not None else fetch(query)
            rows = parse_feed(raw, now, 14)
            succeeded += 1
            for row in rows:
                articles[row['id']] = row
        except (KeyError, OSError, RuntimeError, ValueError, ET.ParseError) as error:
            failures.append({'query': query, 'error': type(error).__name__})
    if not succeeded or not articles:
        raise RuntimeError('No usable news articles; keeping previous queue unchanged')
    queue = build_queue(list(articles.values()), config['topics'], seen, now)
    queue['feeds_checked'] = succeeded
    queue['feeds_failed'] = failures
    queue['articles_checked'] = len(articles)
    atomic_json(output_dir / 'queue.json', queue)
    cutoff = now - timedelta(days=45)
    fresh_seen = {key: value for key, value in seen.items() if datetime.fromisoformat(value) >= cutoff}
    for key in articles:
        fresh_seen.setdefault(key, now.isoformat())
    atomic_json(previous, fresh_seen)
    result = {'checked_at': now.isoformat(), 'feeds_checked': succeeded,
              'feeds_failed': len(failures), 'articles_checked': len(articles),
              'candidates': len(queue['candidates']),
              'candidates_with_new_articles': sum(bool(item['new_article_count']) for item in queue['candidates']),
              'top': [{'id': item['id'], 'name': item['name'], 'priority': item['priority']}
                      for item in queue['candidates'][:8]]}
    atomic_json(output_dir / 'status.json', result)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', type=Path, default=CONFIG)
    parser.add_argument('--output-dir', type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument('--fixture', type=Path)
    parser.add_argument('--status', action='store_true')
    args = parser.parse_args()
    if args.status:
        result = json.loads((args.output_dir / 'status.json').read_text())
        age = datetime.now(timezone.utc) - datetime.fromisoformat(result['checked_at'])
        print(json.dumps({**result, 'age_hours': round(age.total_seconds() / 3600, 1)}, ensure_ascii=False))
        raise SystemExit(0 if age <= timedelta(hours=36) and result['feeds_checked'] else 1)
    print(json.dumps(run(args.config, args.output_dir, args.fixture), ensure_ascii=False))


if __name__ == '__main__':
    main()

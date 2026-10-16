#!/usr/bin/env python3
"""Focused checks for news parsing, duplicate grouping, and review-only output."""

import importlib.util
import unittest
from datetime import datetime, timezone
from pathlib import Path


PATH = Path(__file__).with_name('collect-trending-logo-leads.py')
SPEC = importlib.util.spec_from_file_location('trend_watch', PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class TrendWatchTest(unittest.TestCase):
    def test_recent_rss_and_duplicate_headlines(self):
        now = datetime(2026, 10, 16, tzinfo=timezone.utc)
        feed = b'''<rss><channel>
          <item><title>\xec\x8b\x9c\xed\x81\x90\xec\x95\x84\xec\x9d\xb4, \xec\x83\x88 CI \xea\xb3\xb5\xea\xb0\x9c - A</title><link>https://news.google.com/rss/articles/one</link><pubDate>Thu, 15 Oct 2026 12:00:00 GMT</pubDate><source>A</source></item>
          <item><title>\xec\x8b\x9c\xed\x81\x90\xec\x95\x84\xec\x9d\xb4, \xeb\xa1\x9c\xea\xb3\xa0 \xea\xb5\x90\xec\xb2\xb4 - B</title><link>https://news.google.com/rss/articles/two</link><pubDate>Thu, 15 Oct 2026 13:00:00 GMT</pubDate><source>B</source></item>
          <item><title>old logo</title><link>https://news.google.com/rss/articles/old</link><pubDate>Tue, 01 Sep 2026 12:00:00 GMT</pubDate></item>
        </channel></rss>'''
        articles = MODULE.parse_feed(feed, now, 14)
        self.assertEqual(len(articles), 2)
        result = MODULE.build_queue(articles, [], {}, now)
        self.assertTrue(result['review_only'])
        self.assertEqual(len(result['candidates']), 1)
        self.assertEqual(result['candidates'][0]['article_count'], 2)
        self.assertEqual(result['candidates'][0]['status'], 'needs_entity_and_official_source_review')

    def test_event_and_concept_have_distinct_review_paths(self):
        now = datetime(2026, 10, 16, tzinfo=timezone.utc)
        articles = [
            {'id': 'one', 'title': '부산국제영화제 공식 로고 공개', 'published_at': now.isoformat(), 'publisher': 'A'},
            {'id': 'two', 'title': '부캉이 마스코트 공모', 'published_at': now.isoformat(), 'publisher': 'B'},
        ]
        topics = [
            {'id': 'biff', 'name': 'BIFF', 'aliases': ['부산국제영화제'], 'kind': 'seasonal_official', 'review_note': ''},
            {'id': 'bukangi', 'name': '부캉이', 'aliases': ['부캉이'], 'kind': 'editorial_concept', 'review_note': ''},
        ]
        result = MODULE.build_queue(articles, topics, {}, now)
        by_id = {item['id']: item for item in result['candidates']}
        self.assertEqual(by_id['biff']['status'], 'needs_official_asset_review')
        self.assertEqual(by_id['bukangi']['status'], 'needs_identity_and_editorial_review')


if __name__ == '__main__':
    unittest.main()

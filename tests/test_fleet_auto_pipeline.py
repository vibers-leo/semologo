import hashlib
import io
import json
import runpy
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CORE = runpy.run_path(str(ROOT / 'scripts/fleet-auto-core.py'))
RUNNER = runpy.run_path(str(ROOT / 'scripts/run-auto-fleet-pipeline.py'))
PUBLISH = runpy.run_path(str(ROOT / 'scripts/fleet-auto-publish.py'))


class IntakeTests(unittest.TestCase):
    def test_homepage_logo_guard(self):
        item = {'domain': 'example.com', 'pageUrl': 'https://example.com/',
                'assetUrl': 'https://example.com/assets/logo.svg'}
        self.assertEqual(CORE['source_reason'](item), '')
        self.assertEqual(CORE['source_reason']({**item, 'assetUrl': 'https://other.com/logo.svg'}),
                         'not_first_party_https')
        self.assertEqual(CORE['source_reason']({**item, 'assetUrl': 'https://example.com/partner-logo.svg'}),
                         'not_canonical_svg')

    def test_unsafe_and_opaque_svg_rejected(self):
        unsafe = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
        with self.assertRaisesRegex(ValueError, 'unsafe_svg'):
            CORE['review_svg'](unsafe)
        opaque = b'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200"><rect width="600" height="200" fill="white"/><text x="10" y="100" font-size="80">Example</text></svg>'
        with self.assertRaisesRegex(ValueError, 'empty_or_opaque_canvas|embedded_white_backdrop'):
            CORE['review_svg'](opaque)

    def test_ocr_requires_new_name_and_domain_agreement(self):
        self.assertEqual(CORE['matched_ocr'](['Codeway'], 'Codeway', 'codeway.co', True), 'Codeway')
        self.assertEqual(CORE['matched_ocr'](['Codeway'], 'Unrelated', 'codeway.co', True), '')
        self.assertEqual(CORE['title']('Home / Henle Library'), 'Henle Library')

    def test_white_transparent_artwork_uses_dark_card(self):
        def encoded(color):
            image = Image.new('RGBA', (200, 100), (0, 0, 0, 0))
            for x in range(25, 175):
                for y in range(25, 75):
                    image.putpixel((x, y), color)
            output = io.BytesIO()
            image.save(output, format='PNG')
            return output.getvalue()
        self.assertTrue(PUBLISH['light_artwork'](encoded((255, 255, 255, 255))))
        self.assertFalse(PUBLISH['light_artwork'](encoded((0, 0, 0, 255))))


class CursorTests(unittest.TestCase):
    def fake_core(self, raw, fail):
        digest = hashlib.sha256(raw).hexdigest()
        item = {'domain': 'example.com', 'pageUrl': 'https://example.com/',
                'assetUrl': 'https://example.com/logo.svg', 'name': 'Example',
                'status': 'staged_review_required', 'file': digest + '.svg',
                'sha256': digest}

        def stage_jobs(s3, jobs, folder):
            (folder / item['file']).write_bytes(raw)
            return [('example.com', item['assetUrl'])], [item]

        fake = dict(CORE)
        fake.update({
            'jobs_after': lambda cursor, limit: [{
                'id': '00000000-0000-0000-0000-000000000001',
                'created_at': '2026-10-17T00:00:00.123456Z'}],
            's3_client': lambda: None,
            'stage_jobs': stage_jobs,
            'cms_catalog': lambda: ({}, {}, set()),
            'source_reason': lambda row: '',
            'review_svg': lambda data: (b'png', object()),
            'ocr': lambda image: ['Example'],
            'matched_ocr': lambda texts, name, domain, is_new: 'Example',
            'STAGE': {'secure_get': lambda url, domain, limit: (url, 'image/svg+xml', raw)},
        })
        publisher = {'new': lambda *args: (_ for _ in ()).throw(RuntimeError('temporary_upload_failure'))
                     if fail else 'published_new'}
        return fake, publisher

    def test_publish_failure_keeps_cursor_for_retry(self):
        raw = b'<svg>Example</svg>'
        fake, publisher = self.fake_core(raw, True)
        with tempfile.TemporaryDirectory() as directory:
            with patch.dict(RUNNER['cycle'].__globals__,
                            {'CORE': fake, 'PUBLISH': publisher, 'STATE': Path(directory)}):
                result = RUNNER['cycle'](1, True)
            self.assertEqual(result['status'], 'retry_required')
            self.assertEqual(result['publishErrors'], 1)
            self.assertFalse((Path(directory) / 'cursor.json').exists())
            receipt = json.loads(Path(result['receipt']).read_text())
            self.assertEqual(receipt['publishErrors'][0]['reason'], 'temporary_upload_failure')

    def test_success_advances_precise_cursor(self):
        raw = b'<svg>Example</svg>'
        fake, publisher = self.fake_core(raw, False)
        with tempfile.TemporaryDirectory() as directory:
            with patch.dict(RUNNER['cycle'].__globals__,
                            {'CORE': fake, 'PUBLISH': publisher, 'STATE': Path(directory)}):
                result = RUNNER['cycle'](1, True)
            self.assertEqual(result['status'], 'processed')
            self.assertEqual(result['published'], 1)
            self.assertEqual(json.loads((Path(directory) / 'cursor.json').read_text())['createdAt'],
                             '2026-10-17T00:00:00.123456Z')


if __name__ == '__main__':
    unittest.main()

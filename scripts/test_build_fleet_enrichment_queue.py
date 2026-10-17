import importlib.util
import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).parent))
spec = importlib.util.spec_from_file_location(
    'enrichment_queue', Path(__file__).with_name('build-fleet-enrichment-queue.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class FleetEnrichmentQueueTest(unittest.TestCase):
    def test_existing_domain_routes_to_update_without_inventing_missing_forms(self):
        catalog = [{'id': 'acme', 'name_ko': '에이크미', 'name_en': 'Acme',
                    'domain': 'acme.kr', 'has_png': 'true', 'has_svg': 'false',
                    'variant_manifest': None}]
        candidate = {'domain': 'acme.kr', 'name': 'Acme', 'sha256': 'a' * 64}
        report = module.build(catalog, [candidate])
        item = report['queue'][0]
        self.assertEqual((item['action'], item['targetBrandId']),
                         ('review_existing_update', 'acme'))
        self.assertEqual(item['targetQuality']['forms']['state'], 'unassessed')
        self.assertEqual(report['counts']['declared_svg_missing'], 1)
        self.assertNotIn('recorded_missing_symbol', report['counts'])

    def test_conflicting_name_and_domain_requires_identity_review(self):
        catalog = [
            {'id': 'first', 'name_ko': '첫째', 'domain': 'first.kr'},
            {'id': 'second', 'name_ko': '둘째', 'domain': 'second.kr'},
        ]
        candidate = {'domain': 'first.kr', 'name': '둘째', 'sha256': 'b' * 64}
        item = module.build(catalog, [candidate])['queue'][0]
        self.assertEqual(item['action'], 'resolve_identity_conflict')

    def test_recorded_forms_only_count_verified_artwork(self):
        catalog = [{'id': 'logo', 'name_ko': '로고', 'domain': 'logo.kr',
                    'variant_manifest': {'id': 'logo', 'variants': [
                        {'key': 'mark', 'form': 'symbol', 'files': {'svg': 'mark.svg'},
                         'visual_sha256': '1' * 64, 'review_status': 'verified'}]}}]
        report = module.build(catalog, [])
        self.assertEqual(report['counts']['forms_recorded'], 1)
        self.assertEqual(report['counts']['recorded_missing_horizontal'], 1)
        self.assertNotIn('recorded_missing_symbol', report['counts'])

    def test_generic_page_title_never_matches_legacy_brand(self):
        catalog = [{'id': 'home', 'name_ko': 'Home'}]
        candidate = {'domain': 'example.kr', 'name': 'Home', 'sha256': 'c' * 64}
        self.assertEqual(module.build(catalog, [candidate])['queue'][0]['action'],
                         'review_new_content')


if __name__ == '__main__':
    unittest.main()

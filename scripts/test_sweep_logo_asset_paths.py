import importlib.util
import unittest
from pathlib import Path


spec = importlib.util.spec_from_file_location(
    'asset_sweep', Path(__file__).with_name('sweep-logo-asset-paths.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class AssetPathTest(unittest.TestCase):
    def test_nested_reviewed_source_path_is_checked_under_its_brand(self):
        url = module.asset_url({'id': 'brand-a', 'logo_png': 'sources/reviewed/logo.png'}, 'png')
        self.assertEqual(url, 'https://logo.vibers.co.kr/_clients/brand-a/sources/reviewed/logo.png')

    def test_external_and_traversal_paths_are_rejected(self):
        for path in ('../logo.png', 'sources/../../logo.png',
                     'https://elsewhere.test/logo.png', 'true'):
            with self.subTest(path=path), self.assertRaises(ValueError):
                module.asset_url({'id': 'brand-a', 'logo_png': path}, 'png')

    def test_site_relative_path_with_spaces_is_encoded(self):
        url = module.asset_url({'id': 'hipcamp', 'logo_png':
                                '/_clients/hipcamp/sources/Hipcamp (black).png'}, 'png')
        self.assertEqual(url, 'https://semologo.com/_clients/hipcamp/sources/Hipcamp%20%28black%29.png')

    def test_absolute_cdn_path_with_spaces_is_encoded(self):
        url = module.asset_url({'id': 'hipcamp', 'logo_png':
                                'https://logo.vibers.co.kr/_clients/hipcamp/Hipcamp (black).png'}, 'png')
        self.assertEqual(url, 'https://logo.vibers.co.kr/_clients/hipcamp/Hipcamp%20%28black%29.png')


if __name__ == '__main__':
    unittest.main()

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


if __name__ == '__main__':
    unittest.main()

import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('enrichment', Path(__file__).with_name('logo_variant_enrichment.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class EnrichmentTests(unittest.TestCase):
    def test_duplicate_adds_missing_png_without_losing_original_svg(self):
        manifest = {'id': 'x', 'primary': 'original', 'variants': [
            {'key': 'original', 'form': 'unknown', 'files': {'svg': 'old.svg'}, 'source_sha256': 'a' * 64}]}
        result = module.merge_variant(manifest, {'key': 'new-png', 'form': 'horizontal',
            'files': {'png': 'transparent.png'}, 'source_sha256': 'a' * 64})
        self.assertEqual(result, 'enriched')
        self.assertEqual(len(manifest['variants']), 1)
        self.assertEqual(manifest['variants'][0]['files'], {'svg': 'old.svg', 'png': 'transparent.png'})
        self.assertEqual(module.coverage(manifest)['missing'], ['symbol', 'vertical', 'wordmark'])
        self.assertEqual(module.merge_variant(manifest, {'key': 'new-png', 'form': 'horizontal',
            'files': {'png': 'transparent.png'}, 'source_sha256': 'a' * 64}), 'unchanged')

    def test_same_key_changed_artwork_is_retained_as_new_variant(self):
        manifest = {'id': 'x', 'primary': 'official', 'variants': [
            {'key': 'official', 'form': 'symbol', 'files': {'svg': 'old.svg'}}]}
        result = module.merge_variant(manifest, {'key': 'official', 'form': 'symbol',
            'files': {'svg': 'new.svg'}, 'source_sha256': 'b' * 64})
        self.assertEqual(result, 'added')
        self.assertEqual(len(manifest['variants']), 2)
        self.assertEqual(manifest['variants'][0]['files']['svg'], 'old.svg')
        self.assertEqual(manifest['variants'][1]['files']['svg'], 'new.svg')

    def test_unknown_and_emblem_are_not_guessed_into_four_slots(self):
        manifest = {'id': 'x', 'variants': [
            {'key': 'old', 'form': 'unknown', 'aspect': 3.2, 'files': {'svg': 'old.svg'}},
            {'key': 'crest', 'form': 'emblem', 'files': {'svg': 'crest.svg'}}]}
        self.assertEqual(module.coverage(manifest)['missing'], list(module.SLOTS))


if __name__ == '__main__':
    unittest.main()

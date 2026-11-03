"""Offline regression checks: no browser, OCR model, Firebase, or HTTP calls."""
import ast
import importlib.util
import logging
import pathlib
import sys
import types
import unittest
from unittest.mock import Mock, patch
ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'coffee_crawler/crawlers/html_crawler.py'

class FakeBase:
    def __init__(self, cafe_id, config):
        self.cafe_id, self.config, self.logger = cafe_id, config, Mock()

class RuntimeTests(unittest.TestCase):
    def setUp(self):
        self.reader = Mock()
        self.easy = types.ModuleType('easyocr')
        self.easy.Reader = Mock(return_value=self.reader)
        self.requests = types.ModuleType('requests')
        self.requests.get = Mock(side_effect=AssertionError('Real HTTP is forbidden'))
        base = types.ModuleType('coffee_crawler.crawlers.base_crawler')
        base.BaseCrawler = FakeBase
        bean = types.ModuleType('coffee_crawler.models.bean')
        bean.Bean = type('Bean', (), {})
        soup = types.ModuleType('bs4'); soup.BeautifulSoup = Mock()
        self.modules = patch.dict(sys.modules, {
            'easyocr': self.easy, 'requests': self.requests, 'bs4': soup,
            'coffee_crawler.crawlers.base_crawler': base,
            'coffee_crawler.models.bean': bean,
        })
        self.modules.start(); self.addCleanup(self.modules.stop)
        spec = importlib.util.spec_from_file_location('synthetic_html', SOURCE)
        self.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.module)
        logging.disable(logging.CRITICAL); self.addCleanup(logging.disable, logging.NOTSET)
        self.crawler = self.module.HtmlCrawler('fixture', {'url': 'https://fixture.invalid'})

    def test_html_only_does_not_initialize_reader(self):
        self.easy.Reader.assert_not_called()
        self.assertIsNone(self.crawler.ocr_reader)

    def test_no_top_level_ocr_import(self):
        tree = ast.parse(SOURCE.read_text(encoding='utf-8'))
        imports = [n for node in tree.body if not isinstance(node, (ast.ClassDef, ast.FunctionDef))
                   for n in ast.walk(node) if isinstance(n, (ast.Import, ast.ImportFrom))]
        names = [a.name for n in imports for a in n.names]
        self.assertNotIn('easyocr', names)

    def test_reader_created_once_and_cpu_only(self):
        self.assertTrue(self.crawler._ensure_ocr_reader())
        self.assertTrue(self.crawler._ensure_ocr_reader())
        self.easy.Reader.assert_called_once_with(['ko', 'en'], gpu=False)

    def test_missing_optional_library_is_nonfatal(self):
        with patch.dict(sys.modules, {'easyocr': None}):
            self.assertFalse(self.crawler._ensure_ocr_reader())
        self.assertFalse(self.crawler._ensure_ocr_reader())
        self.easy.Reader.assert_not_called()

    def test_initialization_error_is_not_retried_per_image(self):
        self.easy.Reader.side_effect = RuntimeError('synthetic initialization error')
        self.assertFalse(self.crawler._ensure_ocr_reader())
        self.assertFalse(self.crawler._ensure_ocr_reader())
        self.easy.Reader.assert_called_once()

    def test_filtered_urls_do_not_initialize_or_download(self):
        for url in ['', 'https://fixture.invalid/icon_a.png', 'https://fixture.invalid/a.gif',
                    'https://fixture.invalid/plain.txt', 'https://fixture.invalid/common/a.jpg']:
            with self.subTest(url=url):
                self.assertEqual(self.crawler._extract_text_from_image(url), '')
        self.easy.Reader.assert_not_called(); self.requests.get.assert_not_called()

    def test_eligible_image_keeps_ocr_output_and_reuses_reader(self):
        response = Mock(content=b'synthetic-bytes')
        self.requests.get.side_effect = None; self.requests.get.return_value = response
        self.reader.readtext.return_value = [(None, 'coffee', .99), (None, 'fixture', .99)]
        for _ in range(2):
            self.assertEqual(self.crawler._extract_text_from_image('https://fixture.invalid/a.png'), 'coffee fixture')
        self.easy.Reader.assert_called_once_with(['ko', 'en'], gpu=False)
        self.assertEqual(self.reader.readtext.call_count, 2)

    def test_image_failure_retains_empty_result(self):
        self.requests.get.side_effect = RuntimeError('synthetic download error')
        self.assertEqual(self.crawler._extract_text_from_image('https://fixture.invalid/a.jpg'), '')

    def test_known_python39_grpc_regression_is_bounded(self):
        text = (ROOT / 'requirements.txt').read_text(encoding='utf-8')
        self.assertIn('grpcio==1.78.0; python_version < "3.10" and sys_platform == "linux"', text)

    def test_persistent_runner_does_not_restore_remote_caches(self):
        text = (ROOT / '.github/workflows/coffee_crawler.yml').read_text(encoding='utf-8')
        for kind in ('pip', 'npm'):
            self.assertIn("runner.environment == 'github-hosted' && '" + kind + "' || ''", text)
        self.assertIn('python scripts/test_bean_filter.py', text)
        self.assertIn('python scripts/test_crawler_runtime.py', text)
        for name in ('OMP_NUM_THREADS', 'OPENBLAS_NUM_THREADS', 'MKL_NUM_THREADS', 'NUMEXPR_NUM_THREADS'):
            self.assertIn(name + ": '1'", text)

if __name__ == '__main__':
    unittest.main(verbosity=2)
#!/usr/bin/env python3
"""실제 프릳츠 HTML fixture와 현재 설정을 검사하는 오프라인 회귀 테스트."""

import copy
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import yaml

from check_crawler_selectors import ROOT, check_selectors

FIXTURE = Path(__file__).parent / 'fixtures/fritz_product_cards.html'


def check_fritz_fixture(config):
    result = check_selectors(FIXTURE.read_text(encoding='utf-8'), config['cafes']['fritz'])
    if not result['passed'] or result['cards'] != 2:
        return f'프릳츠 상품 링크 회귀: {result}'
    return None


class SelectorTests(unittest.TestCase):
    def setUp(self):
        self.config = yaml.safe_load((ROOT / 'config/crawler_config.yaml').read_text(encoding='utf-8'))
        self.cafe = copy.deepcopy(self.config['cafes']['fritz'])
        self.html = FIXTURE.read_text(encoding='utf-8')

    def test_current_config_matches_real_cards(self):
        self.assertIsNone(check_fritz_fixture(self.config))

    def test_real_parser_keeps_bean_and_excludes_drip_bag(self):
        from coffee_crawler.crawlers.html_crawler import HtmlCrawler

        self.cafe['selectors']['fetch_product_detail'] = False
        with patch('coffee_crawler.crawlers.html_crawler.OCR_AVAILABLE', False):
            crawler = HtmlCrawler('fritz', self.cafe)
        with patch.object(crawler, '_safe_request', return_value=(SimpleNamespace(text=self.html), True)):
            rows = crawler.crawl()
        self.assertEqual(len(rows), 1)
        self.assertIn('올드독', rows[0]['name'])
        self.assertTrue(rows[0]['link'].startswith('https://m.fritz.co.kr/product/'))

    def test_original_selector_regression_fails(self):
        self.cafe['selectors']['product_link'] = '.box > a'
        result = check_selectors(self.html, self.cafe)
        self.assertFalse(result['passed'])
        self.assertEqual(result['cards'], 2)
        self.assertEqual(result['matched_links'], 0)

    def test_empty_page_fails(self):
        self.assertFalse(check_selectors('<ul class="column2"></ul>', self.cafe)['passed'])

    def test_missing_container_fails(self):
        with self.assertRaises(ValueError):
            check_selectors('<html>maintenance</html>', self.cafe)

    def test_invalid_hrefs_fail(self):
        for href in ['', ' ', '#', '#detail', '/', 'javascript:void(0)', 'mailto:test@example.com']:
            with self.subTest(href=href):
                html = f'<ul class="column2"><li class="item"><div class="name"><a href="{href}">Coffee</a></div></li></ul>'
                result = check_selectors(html, self.cafe)
                self.assertFalse(result['passed'])
                self.assertEqual(result['invalid_links'], 1)

    def test_mixed_missing_links_fail(self):
        html = self.html.replace('</ul>', '<li class="item">missing link</li></ul>')
        result = check_selectors(html, self.cafe)
        self.assertFalse(result['passed'])
        self.assertEqual(result['missing_links'], 1)

    def test_anchor_cards_and_skeletons(self):
        self.cafe['selectors'].update(product_item='.item', product_link='')
        html = '<ul class="column2"><a class="item" href="/product/1">Coffee</a><a class="item skeleton">Loading</a></ul>'
        result = check_selectors(html, self.cafe)
        self.assertTrue(result['passed'])
        self.assertEqual(result['cards'], 1)


if __name__ == '__main__':
    unittest.main()

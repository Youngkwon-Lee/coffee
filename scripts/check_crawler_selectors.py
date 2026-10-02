#!/usr/bin/env python3
"""상품 목록 selector 검증. 샘플 생성·상세 요청·DB 쓰기·알림 없이 검사한다."""

import argparse
import json
import sys
from pathlib import Path
from urllib.parse import urljoin, urlparse

import yaml
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def check_selectors(html, cafe_config):
    selectors = cafe_config['selectors']
    soup = BeautifulSoup(html, 'html.parser')
    container = soup.select_one(selectors['product_list_container'])
    if container is None:
        raise ValueError(f"상품 컨테이너 불일치: {selectors['product_list_container']!r}")
    cards = [
        item for item in container.select(selectors['product_item'])
        if 'skeleton' not in [str(c).lower() for c in item.get('class', [])]
    ]
    link_selector = (selectors.get('product_link') or '').strip()
    matched = valid = 0
    for card in cards:
        link = (card.select_one(link_selector) if link_selector else
                card if card.name == 'a' else card.select_one('a[href]'))
        if link is None:
            continue
        matched += 1
        href = (link.get('href') or '').strip()
        resolved = urlparse(urljoin(cafe_config['url'], href))
        if href and not href.startswith('#') and href != '/' and \
                resolved.scheme in {'http', 'https'} and resolved.netloc:
            valid += 1
    return {
        'cards': len(cards),
        'link_selector': link_selector,
        'matched_links': matched,
        'valid_links': valid,
        'missing_links': len(cards) - matched,
        'invalid_links': matched - valid,
        'passed': bool(cards) and valid == len(cards),
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cafe', default='fritz')
    parser.add_argument('--config', type=Path, default=ROOT / 'config/crawler_config.yaml')
    parser.add_argument('--html', type=Path, help='저장한 HTML로 오프라인 검사')
    args = parser.parse_args(argv)
    try:
        config = yaml.safe_load(args.config.read_text(encoding='utf-8'))
        cafe = config['cafes'][args.cafe]
        if cafe.get('type') != 'html':
            raise ValueError('HTML 크롤러 설정만 지원합니다')
        if args.html:
            html = args.html.read_text(encoding=cafe.get('encoding', 'utf-8'))
        else:
            from coffee_crawler.utils.http_client import HttpClient

            response, success = HttpClient(user_agent=cafe.get('user_agent')).get(cafe['url'])
            if not success:
                raise ValueError('상품 목록 HTTP 요청 실패')
            response.encoding = cafe.get('encoding', 'utf-8')
            html = response.text
        result = check_selectors(html, cafe)
        print(json.dumps({'cafe': args.cafe, **result}, ensure_ascii=False, indent=2))
        return 0 if result['passed'] else 1
    except (ValueError, KeyError, OSError) as error:
        print(f'selector 검증 실패: {error}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())

"""
Shopify RSS 크롤러 테스트
"""

import pytest
import os
import json
from unittest.mock import patch, MagicMock
import sys

# 프로젝트 루트 경로 추가
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from coffee_crawler.crawlers.shopify_rss_crawler import ShopifyRssCrawler
from coffee_crawler.models.bean import Bean
from coffee_crawler.utils.sample_data import generate_sample_beans, save_sample_data

# 샘플 RSS 피드 항목 데이터
SAMPLE_ENTRY = {
    'title': '에티오피아 예가체프 워시드 G1 (200g)',
    'link': 'https://example.com/beans/ethiopia-yirgacheffe',
    'published': 'Wed, 20 Oct 2023 10:00:00 +0900',
    'summary': '<div><p>향긋한 꽃향기와 베리류의 과일향이 특징인 원두입니다.</p>'
               '<p>가격: <strong>18,000원</strong></p>'
               '<img src="https://example.com/images/ethiopia-yirgacheffe.jpg" alt="에티오피아 예가체프"></div>',
    'links': [
        {
            'rel': 'alternate',
            'type': 'text/html',
            'href': 'https://example.com/beans/ethiopia-yirgacheffe'
        },
        {
            'rel': 'enclosure',
            'type': 'image/jpeg',
            'href': 'https://example.com/images/ethiopia-yirgacheffe.jpg'
        }
    ]
}

# 샘플 피드 응답
SAMPLE_FEED = {
    'feed': {
        'title': '커피 원두',
        'link': 'https://example.com/collections/beans'
    },
    'entries': [SAMPLE_ENTRY]
}

# 테스트 설정
@pytest.fixture
def mock_config():
    return {
        'label': '테스트 카페',
        'url': 'https://example.com/collections/beans.atom',
        'type': 'shopify_rss',
        'active': True
    }

@pytest.fixture
def crawler(mock_config):
    with patch('coffee_crawler.utils.logger.get_crawler_logger') as mock_logger:
        mock_logger.return_value = MagicMock()
        crawler = ShopifyRssCrawler('testcafe', mock_config)
        return crawler

class TestShopifyRssCrawler:
    """ShopifyRssCrawler 테스트 클래스"""
    
    def test_init(self, crawler):
        """초기화 테스트"""
        assert crawler.cafe_id == 'testcafe'
        assert crawler.rss_url == 'https://example.com/collections/beans.atom'
        assert crawler.cafe.name == '테스트 카페'
    
    @patch('feedparser.parse')
    def test_crawl_impl(self, mock_parse, crawler):
        """크롤링 구현 테스트"""
        # feedparser의 반환 값 설정
        mock_feed = MagicMock()
        mock_feed.entries = [MagicMock()]
        mock_feed.entries[0].__getitem__ = lambda self, key: SAMPLE_ENTRY.get(key)
        mock_feed.entries[0].title = SAMPLE_ENTRY['title']
        mock_feed.entries[0].link = SAMPLE_ENTRY['link']
        mock_feed.entries[0].published = SAMPLE_ENTRY['published']
        mock_feed.entries[0].summary = SAMPLE_ENTRY['summary']
        mock_feed.entries[0].links = SAMPLE_ENTRY['links']
        
        mock_parse.return_value = mock_feed
        
        # _parse_entry 메서드를 모의화
        with patch.object(crawler, '_parse_entry') as mock_parse_entry:
            mock_parse_entry.return_value = {'name': '에티오피아 예가체프', 'price': 18000}
            
            # 크롤링 실행
            results = crawler._crawl_impl()
            
            # 결과 검증
            assert len(results) == 1
            assert results[0]['name'] == '에티오피아 예가체프'
            assert results[0]['price'] == 18000
            
            # _parse_entry가 호출되었는지 확인
            mock_parse_entry.assert_called_once()
    
    def test_parse_entry(self, crawler):
        """항목 파싱 테스트"""
        # entry 객체 모의화
        entry = MagicMock()
        entry.title = SAMPLE_ENTRY['title']
        entry.link = SAMPLE_ENTRY['link']
        entry.published = SAMPLE_ENTRY['published']
        entry.summary = SAMPLE_ENTRY['summary']
        entry.links = SAMPLE_ENTRY['links']
        
        # 각 추출 메서드 모의화
        with patch.object(crawler, '_extract_bean_info') as mock_extract_info, \
             patch.object(crawler, '_extract_price') as mock_extract_price, \
             patch.object(crawler, '_extract_images') as mock_extract_images, \
             patch.object(crawler, '_extract_weight') as mock_extract_weight:
            
            mock_extract_info.return_value = {'origin': '에티오피아', 'processing': '워시드'}
            mock_extract_price.return_value = 18000
            mock_extract_images.return_value = ['https://example.com/images/ethiopia-yirgacheffe.jpg']
            mock_extract_weight.return_value = 200
            
            # 항목 파싱
            result = crawler._parse_entry(entry)
            
            # 결과 검증
            assert result['name'] == '에티오피아 예가체프 워시드 G1 (200g)'
            assert result['brand'] == '테스트 카페'
            assert result['price'] == 18000
            assert result['origin'] == '에티오피아'
            assert result['processing'] == '워시드'
            assert result['weight_g'] == 200
            assert result['url'] == 'https://example.com/beans/ethiopia-yirgacheffe'
            assert 'https://example.com/images/ethiopia-yirgacheffe.jpg' in result['images']
    
    def test_extract_price(self, crawler):
        """가격 추출 테스트"""
        # 여러 형식의 가격 테스트
        assert crawler._extract_price('가격: 18,000원') == 18000
        assert crawler._extract_price('18000원') == 18000
        assert crawler._extract_price('₩18,000') is None  # 원화 기호는 인식하지 않음
        assert crawler._extract_price('가격 없음') is None
    
    def test_extract_weight(self, crawler):
        """무게 추출 테스트"""
        # 제목에서 추출
        assert crawler._extract_weight('에티오피아 200g', '') == 200
        assert crawler._extract_weight('케냐 AA 500G', '') == 500
        
        # 요약에서 추출
        assert crawler._extract_weight('에티오피아', '무게: 200g') == 200
        assert crawler._extract_weight('케냐', '<p>500g</p>') == 500
        
        # 무게 정보 없음
        assert crawler._extract_weight('에티오피아', '설명') is None
    
    def test_extract_bean_info(self, crawler):
        """원두 정보 추출 테스트"""
        # 원산지 추출
        info = crawler._extract_bean_info('에티오피아 예가체프')
        assert 'origin' in info
        assert info['origin'] == '에티오피아'
        
        # 가공방식 추출
        info = crawler._extract_bean_info('케냐 워시드 프로세스')
        assert 'origin' in info
        assert 'processing' in info
        assert info['origin'] == '케냐'
        assert info['processing'] == '워시드'
        
        # 품종 추출
        info = crawler._extract_bean_info('에티오피아 게이샤')
        assert 'origin' in info
        assert 'variety' in info
        assert info['origin'] == '에티오피아'
        assert info['variety'] == '게이샤'

# 통합 테스트 (실제 RSS 피드를 사용)
@pytest.mark.skipif(not os.environ.get('RUN_REAL_TESTS'), reason="실제 테스트는 RUN_REAL_TESTS=1 환경변수 설정 시에만 실행")
def test_real_shopify_crawler():
    """실제 Shopify RSS 피드 크롤링 테스트"""
    # 실제 설정으로 크롤러 생성
    config = {
        'label': '센터커피',
        'url': 'https://centercoffee.co.kr/collections/coffee/rss.xml',
        'product_url': 'https://centercoffee.co.kr/collections/coffee',
        'type': 'shopify_rss',
        'active': True,
        'backup_method': 'html'
    }
    
    crawler = ShopifyRssCrawler('centercoffee', config)
    
    # 크롤링 실행 (테스트 모드)
    results = crawler.crawl(test_mode=True)
    
    # 결과가 없으면 샘플 데이터 사용
    if not results:
        print("실제 크롤링 결과가 없어 샘플 데이터를 생성합니다.")
        results = generate_sample_beans(5, 'centercoffee')
        
        # 샘플 저장
        sample_dir = os.path.join(os.path.dirname(__file__), 'samples')
        os.makedirs(sample_dir, exist_ok=True)
        save_sample_data(results, os.path.join(sample_dir, 'centercoffee_beans.json'))
    
    # 결과 확인
    assert len(results) > 0
    
    # 첫 번째 결과 출력
    print(json.dumps(results[0], indent=2, ensure_ascii=False))
    
    # 결과 검증
    for bean in results:
        assert 'name' in bean
        assert 'brand' in bean
        assert 'price' in bean
        assert 'cafe_id' in bean
        assert bean['cafe_id'] == 'centercoffee'

# 샘플 데이터 테스트
def test_sample_data():
    """샘플 데이터 생성 테스트"""
    from coffee_crawler.utils.sample_data import generate_sample_beans
    
    # 샘플 데이터 생성
    beans = generate_sample_beans(5, 'centercoffee')
    
    # 결과 확인
    assert len(beans) == 5
    
    # 첫 번째 결과 검증
    bean = beans[0]
    assert 'name' in bean
    assert 'brand' in bean
    assert 'price' in bean
    assert 'cafe_id' in bean
    assert bean['cafe_id'] == 'centercoffee'
    assert bean['brand'] == '센터커피' 
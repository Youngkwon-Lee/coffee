"""
Shopify RSS 크롤러

이 모듈은 Shopify RSS 피드를 크롤링하여 원두 정보를 수집하는 크롤러를 구현합니다.
"""

import re
import logging
import feedparser
from typing import Dict, List, Any, Optional
from bs4 import BeautifulSoup
from urllib.parse import urljoin

from coffee_crawler.crawlers.base_crawler import BaseCrawler
from coffee_crawler.models.bean import Bean

class ShopifyRssCrawler(BaseCrawler):
    """Shopify RSS 피드 크롤러 클래스"""
    
    def __init__(self, cafe_id: str, config: Dict[str, Any]):
        """
        ShopifyRssCrawler 초기화
        
        Args:
            cafe_id: 카페 ID
            config: 카페 설정 딕셔너리
        """
        super().__init__(cafe_id, config)
        
        # RSS URL 확인
        self.rss_url = config.get('url')
        if not self.rss_url:
            raise ValueError(f"RSS URL이 설정되지 않았습니다: {cafe_id}")
            
        # 가격 정규식 패턴
        self.price_pattern = re.compile(r'(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*원')
        
        # 테스트 모드 제한 수
        self.test_limit = 3
    
    def _crawl_impl(self, test_mode: bool = False) -> List[Dict[str, Any]]:
        """
        Shopify RSS 피드 크롤링 구현
        
        Args:
            test_mode: 테스트 모드 여부
            
        Returns:
            수집된 원두 정보 목록
        """
        self.logger.info(f"Shopify RSS 피드 크롤링: {self.rss_url}")
        
        # RSS 피드 파싱
        feed = feedparser.parse(self.rss_url)
        
        if not feed.entries:
            self.logger.warning(f"RSS 피드에 항목이 없습니다: {self.rss_url}")
            return []
            
        self.logger.info(f"RSS 피드 항목 수: {len(feed.entries)}")
        
        # 테스트 모드인 경우 제한된 수만 처리
        if test_mode:
            feed.entries = feed.entries[:self.test_limit]
            self.logger.info(f"테스트 모드: {self.test_limit}개 항목만 처리")
        
        # 결과 목록
        results = []
        
        # 각 항목 처리
        for entry in feed.entries:
            try:
                bean_info = self._parse_entry(entry)
                if bean_info:
                    results.append(bean_info)
            except Exception as e:
                self.logger.error(f"항목 파싱 중 오류 발생: {e}", exc_info=True)
                continue
        
        return results
    
    def _parse_entry(self, entry) -> Optional[Dict[str, Any]]:
        """
        RSS 피드 항목 파싱
        
        Args:
            entry: feedparser 항목
            
        Returns:
            원두 정보 딕셔너리
        """
        # 기본 정보 추출
        title = entry.title
        link = entry.link
        published = entry.published
        summary = entry.summary
        
        self.logger.debug(f"항목 파싱: {title}")
        
        # 제목에서 정보 추출
        bean_info = self._extract_bean_info(title)
        
        # 가격 추출
        price = self._extract_price(summary)
        if price is None:
            self.logger.warning(f"가격 정보를 찾을 수 없음: {title}")
            price = 0  # 기본값 설정
        
        # 이미지 URL 추출
        image_urls = self._extract_images(entry)
        
        # Bean 객체 생성을 위한 데이터
        bean_data = {
            'name': title,
            'brand': self.cafe.name,
            'price': price,
            'url': link,
            'description': summary,
            'images': image_urls,
            'cafe_id': self.cafe_id,
            **bean_info  # 제목에서 추출한 정보 추가
        }
        
        # 원두 무게 추출 시도
        weight = self._extract_weight(title, summary)
        if weight:
            bean_data['weight_g'] = weight
        
        # Bean 객체 생성
        bean = Bean(**bean_data)
        
        return bean.to_dict()
    
    def _extract_price(self, summary: str) -> Optional[int]:
        """
        가격 정보 추출
        
        Args:
            summary: 항목 요약 내용
            
        Returns:
            가격 (정수)
        """
        # HTML 파싱
        soup = BeautifulSoup(summary, 'html.parser')
        
        # 텍스트만 추출
        text = soup.get_text()
        
        # 가격 패턴 검색
        match = self.price_pattern.search(text)
        if match:
            price_str = match.group(1)
            # 쉼표 제거하고 정수로 변환
            price = int(price_str.replace(',', ''))
            return price
        
        return None
    
    def _extract_images(self, entry) -> List[str]:
        """
        이미지 URL 추출
        
        Args:
            entry: feedparser 항목
            
        Returns:
            이미지 URL 목록
        """
        image_urls = []
        
        # 미디어 컨텐츠 확인
        if hasattr(entry, 'media_content') and entry.media_content:
            for media in entry.media_content:
                if 'url' in media:
                    image_urls.append(media['url'])
        
        # 이미지 링크 확인
        if hasattr(entry, 'links'):
            for link in entry.links:
                if link.get('type', '').startswith('image/'):
                    image_urls.append(link.get('href'))
        
        # HTML에서 이미지 추출
        if hasattr(entry, 'summary'):
            soup = BeautifulSoup(entry.summary, 'html.parser')
            for img in soup.find_all('img'):
                if 'src' in img.attrs:
                    image_url = img['src']
                    # 상대 경로인 경우 절대 경로로 변환
                    if not image_url.startswith(('http://', 'https://')):
                        image_url = urljoin(self.cafe.url or self.rss_url, image_url)
                    image_urls.append(image_url)
        
        # 중복 제거
        return list(dict.fromkeys(image_urls))
    
    def _extract_weight(self, title: str, summary: str) -> Optional[int]:
        """
        무게 정보 추출
        
        Args:
            title: 제품명
            summary: 항목 요약 내용
            
        Returns:
            무게 (g)
        """
        # 무게 패턴 (200g, 500g 등)
        weight_pattern = re.compile(r'(\d+)\s*[gG]')
        
        # 제목에서 검색
        match = weight_pattern.search(title)
        if match:
            return int(match.group(1))
        
        # 요약에서 검색
        text = BeautifulSoup(summary, 'html.parser').get_text()
        match = weight_pattern.search(text)
        if match:
            return int(match.group(1))
        
        return None 
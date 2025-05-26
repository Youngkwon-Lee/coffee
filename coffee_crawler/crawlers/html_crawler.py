"""
HTML 파싱 크롤러

이 모듈은 HTML 웹페이지를 크롤링하여 원두 정보를 수집하는 크롤러를 구현합니다.
주로 프릳츠와 같은 커피 브랜드의 웹사이트를 대상으로 합니다.
"""

import re
import logging
import time
from typing import Dict, List, Any, Optional, Tuple
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse

from coffee_crawler.crawlers.base_crawler import BaseCrawler
from coffee_crawler.models.bean import Bean

class HtmlCrawler(BaseCrawler):
    """HTML 파싱 크롤러 클래스"""
    
    def __init__(self, cafe_id: str, config: Dict[str, Any]):
        """
        HtmlCrawler 초기화
        
        Args:
            cafe_id: 카페 ID
            config: 카페 설정 딕셔너리
        """
        super().__init__(cafe_id, config)
        
        # 크롤링 설정
        self.product_list_url = config.get('url')
        if not self.product_list_url:
            raise ValueError(f"상품 목록 URL이 설정되지 않았습니다: {cafe_id}")
        
        # CSS 선택자 설정
        self.selectors = config.get('selectors', {})
        self._validate_selectors()
        
        # 가격 정규식 패턴
        self.price_pattern = re.compile(r'(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*원')
        
        # 테스트 모드 제한 수
        self.test_limit = 3
        
        # 페이지 지연 설정 (초)
        self.page_delay = config.get('page_delay', 1.0)
        
    def _validate_selectors(self):
        """필수 CSS 선택자 검증"""
        required_selectors = [
            'product_list_container',
            'product_item',
            'product_link',
            'product_title',
            'product_price'
        ]
        
        for selector in required_selectors:
            if selector not in self.selectors:
                self.logger.warning(f"필수 CSS 선택자가 없습니다: {selector}")
                # 기본값 설정
                if selector == 'product_list_container':
                    self.selectors[selector] = '.collection-products'
                elif selector == 'product_item':
                    self.selectors[selector] = '.product-item'
                elif selector == 'product_link':
                    self.selectors[selector] = 'a.product-item__link'
                elif selector == 'product_title':
                    self.selectors[selector] = '.product-item__title'
                elif selector == 'product_price':
                    self.selectors[selector] = '.product-item__price'
    
    def _crawl_impl(self, test_mode: bool = False) -> List[Dict[str, Any]]:
        """
        HTML 페이지 크롤링 구현
        
        Args:
            test_mode: 테스트 모드 여부
            
        Returns:
            수집된 원두 정보 목록
        """
        self.logger.info(f"HTML 크롤링 시작: {self.product_list_url}")
        
        # 상품 목록 페이지 요청
        response, success = self._safe_request(self.product_list_url)
        
        if not success:
            self.logger.error("상품 목록 페이지 요청 실패")
            return []
        
        # HTML 파싱
        try:
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 상품 항목 추출
            product_container = soup.select_one(self.selectors['product_list_container'])
            if not product_container:
                self.logger.warning(f"상품 목록 컨테이너를 찾을 수 없음: {self.selectors['product_list_container']}")
                product_items = soup.select(self.selectors['product_item'])
            else:
                product_items = product_container.select(self.selectors['product_item'])
            
            if not product_items:
                self.logger.warning("상품 항목을 찾을 수 없음")
                return []
                
            self.logger.info(f"상품 항목 수: {len(product_items)}")
            
            # 테스트 모드인 경우 제한된 수만 처리
            if test_mode and len(product_items) > self.test_limit:
                product_items = product_items[:self.test_limit]
                self.logger.info(f"테스트 모드: {self.test_limit}개 항목만 처리")
            
            # 결과 목록
            results = []
            
            # 각 상품 항목 처리
            for i, item in enumerate(product_items):
                try:
                    self.logger.debug(f"상품 항목 처리 중: {i+1}/{len(product_items)}")
                    bean_info = self._parse_product_item(item)
                    if bean_info:
                        # 상세 정보 추출이 필요한 경우
                        if self.selectors.get('fetch_product_detail', False):
                            product_url = bean_info.get('url')
                            if product_url:
                                # 페이지 요청 간 지연
                                time.sleep(self.page_delay)
                                detailed_info = self._fetch_product_detail(product_url)
                                if detailed_info:
                                    bean_info.update(detailed_info)
                        
                        results.append(bean_info)
                except Exception as e:
                    self.logger.error(f"상품 항목 파싱 중 오류 발생: {e}", exc_info=True)
                    continue
            
            return results
            
        except Exception as e:
            self.logger.error(f"HTML 파싱 중 오류 발생: {e}", exc_info=True)
            return []
    
    def _parse_product_item(self, item_soup) -> Optional[Dict[str, Any]]:
        """
        상품 항목 파싱
        
        Args:
            item_soup: BeautifulSoup 항목 객체
            
        Returns:
            원두 정보 딕셔너리
        """
        # 링크 추출
        link_elem = item_soup.select_one(self.selectors['product_link'])
        if not link_elem:
            self.logger.warning("상품 링크를 찾을 수 없음")
            return None
        
        # 상대 URL을 절대 URL로 변환
        product_url = link_elem.get('href', '')
        if product_url and not (product_url.startswith('http://') or product_url.startswith('https://')):
            product_url = urljoin(self.product_list_url, product_url)
        
        # 제목 추출
        title_elem = item_soup.select_one(self.selectors['product_title'])
        if not title_elem:
            title_elem = link_elem  # 링크 텍스트를 제목으로 사용
        title = title_elem.get_text().strip()
        
        # 가격 추출
        price = 0
        price_elem = item_soup.select_one(self.selectors['product_price'])
        if price_elem:
            price_text = price_elem.get_text().strip()
            price = self._extract_price(price_text)
        
        # 이미지 추출
        image_urls = []
        if 'product_image' in self.selectors:
            img_elem = item_soup.select_one(self.selectors['product_image'])
            if img_elem:
                if img_elem.name == 'img':
                    img_url = img_elem.get('src', '')
                    if not img_url:
                        img_url = img_elem.get('data-src', '')
                else:
                    # background-image 스타일에서 URL 추출
                    style = img_elem.get('style', '')
                    img_url_match = re.search(r'url\([\'"]?([^\'"]+)[\'"]?\)', style)
                    img_url = img_url_match.group(1) if img_url_match else ''
                
                if img_url and not (img_url.startswith('http://') or img_url.startswith('https://')):
                    img_url = urljoin(self.product_list_url, img_url)
                
                if img_url:
                    image_urls.append(img_url)
        
        # 제목에서 정보 추출
        bean_info = self._extract_bean_info(title)
        
        # Bean 객체 생성을 위한 데이터
        bean_data = {
            'name': title,
            'brand': self.cafe.name,
            'price': price,
            'url': product_url,
            'images': image_urls,
            'cafe_id': self.cafe_id,
            **bean_info  # 제목에서 추출한 정보 추가
        }
        
        # 원두 무게 추출 시도
        weight = self._extract_weight(title)
        if weight:
            bean_data['weight_g'] = weight
        
        # Bean 객체 생성
        bean = Bean(**bean_data)
        
        return bean.to_dict()
    
    def _fetch_product_detail(self, product_url: str) -> Optional[Dict[str, Any]]:
        """
        상품 상세 정보 가져오기
        
        Args:
            product_url: 상품 상세 페이지 URL
            
        Returns:
            상세 정보 딕셔너리
        """
        self.logger.debug(f"상품 상세 정보 가져오기: {product_url}")
        
        # 상품 상세 페이지 요청
        response, success = self._safe_request(product_url)
        
        if not success:
            self.logger.warning(f"상품 상세 페이지 요청 실패: {product_url}")
            return None
        
        # HTML 파싱
        try:
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 상세 정보 딕셔너리
            details = {}
            
            # 설명 추출
            if 'product_description' in self.selectors:
                desc_elem = soup.select_one(self.selectors['product_description'])
                if desc_elem:
                    details['description'] = desc_elem.get_text().strip()
            
            # 특성 추출 (원산지, 품종, 가공방식 등)
            if 'product_origin' in self.selectors:
                origin_elem = soup.select_one(self.selectors['product_origin'])
                if origin_elem:
                    details['origin'] = origin_elem.get_text().strip()
            
            if 'product_variety' in self.selectors:
                variety_elem = soup.select_one(self.selectors['product_variety'])
                if variety_elem:
                    details['variety'] = variety_elem.get_text().strip()
            
            if 'product_processing' in self.selectors:
                process_elem = soup.select_one(self.selectors['product_processing'])
                if process_elem:
                    details['processing'] = process_elem.get_text().strip()
            
            # 향미 노트 추출
            if 'product_flavor_notes' in self.selectors:
                flavor_elem = soup.select_one(self.selectors['product_flavor_notes'])
                if flavor_elem:
                    flavors_text = flavor_elem.get_text().strip()
                    # 쉼표로 구분된 향미 노트 분리
                    flavors = [f.strip() for f in flavors_text.split(',')]
                    details['flavors'] = flavors
            
            # 이미지 추가 추출
            if 'product_detail_images' in self.selectors:
                img_elems = soup.select(self.selectors['product_detail_images'])
                if img_elems:
                    images = []
                    for img_elem in img_elems:
                        img_url = img_elem.get('src', '')
                        if not img_url:
                            img_url = img_elem.get('data-src', '')
                        
                        if img_url and not (img_url.startswith('http://') or img_url.startswith('https://')):
                            img_url = urljoin(product_url, img_url)
                        
                        if img_url and img_url not in images:
                            images.append(img_url)
                    
                    if images:
                        details['images'] = images
                        self.logger.debug(f"상세 이미지 {len(images)}개 추출 성공")
            
            if details:
                self.logger.debug(f"상세 정보 추출 성공: {list(details.keys())}")
            else:
                self.logger.debug("추출된 상세 정보 없음")
                
            return details
            
        except Exception as e:
            self.logger.error(f"상세 정보 파싱 중 오류 발생: {e}", exc_info=True)
            return None
    
    def _extract_price(self, price_text: str) -> int:
        """
        가격 정보 추출
        
        Args:
            price_text: 가격 텍스트
            
        Returns:
            가격 (정수)
        """
        # None이거나 빈 문자열이면 0 반환
        if not price_text:
            return 0
            
        # 가격 패턴 검색
        match = self.price_pattern.search(price_text)
        if match:
            price_str = match.group(1)
            # 쉼표 제거하고 정수로 변환
            try:
                price = int(price_str.replace(',', ''))
                return price
            except ValueError:
                self.logger.warning(f"가격 변환 실패: {price_str}")
        
        # 숫자만 추출
        nums = re.findall(r'\d+', price_text)
        if nums:
            try:
                # 가장 큰 숫자를 가격으로 간주
                return max(int(n) for n in nums)
            except ValueError:
                pass
        
        return 0
    
    def _extract_weight(self, text: str) -> Optional[int]:
        """
        무게 정보 추출
        
        Args:
            text: 텍스트
            
        Returns:
            무게 (g)
        """
        # 무게 패턴 (200g, 500g, 1kg 등)
        weight_pattern = re.compile(r'(\d+)\s*[gG]|(\d+)\s*[kK][gG]')
        
        match = weight_pattern.search(text)
        if match:
            if match.group(1):  # g 단위
                return int(match.group(1))
            elif match.group(2):  # kg 단위
                return int(match.group(2)) * 1000
        
        return None 
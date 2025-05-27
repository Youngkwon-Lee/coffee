"""
Selenium 기반 크롤러

이 모듈은 Selenium을 활용하여 동적 로딩 페이지를 크롤링하는 크롤러를 구현합니다.
JavaScript로 콘텐츠를 로딩하는 웹사이트에서 원두 정보를 수집하는 데 사용됩니다.
"""

import re
import time
import logging
import os
from typing import Dict, List, Any, Optional, Tuple
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, WebDriverException, NoSuchElementException
from webdriver_manager.chrome import ChromeDriverManager

from coffee_crawler.crawlers.base_crawler import BaseCrawler
from coffee_crawler.models.bean import Bean

class SeleniumCrawler(BaseCrawler):
    """Selenium 기반 크롤러 클래스"""
    
    def __init__(self, cafe_id: str, config: Dict[str, Any]):
        """
        SeleniumCrawler 초기화
        
        Args:
            cafe_id: 카페 ID
            config: 카페 설정 딕셔너리
        """
        super().__init__(cafe_id, config)
        
        # 크롤링 설정
        self.product_list_url = config.get('url')
        if not self.product_list_url:
            raise ValueError(f"상품 목록 URL이 설정되지 않았습니다: {cafe_id}")
        
        # 유저 에이전트 설정
        self.user_agent = config.get('user_agent', "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
        
        # CSS 선택자 설정
        self.selectors = config.get('selectors', {})
        self._validate_selectors()
        
        # Selenium 옵션
        self.headless = config.get('headless', True)
        self.wait_timeout = config.get('wait_timeout', 10)
        self.page_load_delay = config.get('page_load_delay', 2)
        
        # 페이지네이션 설정
        self.pagination = config.get('pagination', False)
        self.max_pages = config.get('max_pages', 3)
        
        # 가격 정규식 패턴
        self.price_pattern = re.compile(r'(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*원')
        
        # 테스트 모드 제한 수
        self.test_limit = 3
        
        # 브라우저 인스턴스
        self.driver = None
        
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
        
        # pagination 속성이 없는 경우 추가 (하위 호환성 유지)
        if not hasattr(self, 'pagination'):
            self.pagination = self.config.get('pagination', False)
            
        if not hasattr(self, 'max_pages'):
            self.max_pages = self.config.get('max_pages', 3)
        
        # 페이지네이션 관련 선택자 검증
        if self.pagination:
            pagination_selectors = [
                'pagination_container',
                'next_page'
            ]
            
            for selector in pagination_selectors:
                if selector not in self.selectors:
                    self.logger.warning(f"페이지네이션 CSS 선택자가 없습니다: {selector}")
                    # 기본값 설정
                    if selector == 'pagination_container':
                        self.selectors[selector] = '.paging-block'
                    elif selector == 'next_page':
                        self.selectors[selector] = 'a'
    
    def _setup_driver(self):
        """Selenium WebDriver 설정"""
        try:
            chrome_options = Options()
            if self.headless:
                chrome_options.add_argument("--headless=new")
            chrome_options.add_argument("--no-sandbox")
            chrome_options.add_argument("--disable-dev-shm-usage")
            chrome_options.add_argument("--disable-gpu")
            chrome_options.add_argument(f"user-agent={self.user_agent}")
            
            # 언어 설정 (한글 인코딩 문제 해결)
            chrome_options.add_argument("--lang=ko-KR")
            chrome_options.add_argument("--accept-lang=ko-KR,ko")
            
            # 명시적으로 크롬 경로 지정 (Windows)
            chrome_path = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
            if os.path.exists(chrome_path):
                chrome_options.binary_location = chrome_path
                self.logger.info(f"Chrome 경로 설정: {chrome_path}")
            
            try:
                service = Service(ChromeDriverManager().install())
                self.driver = webdriver.Chrome(service=service, options=chrome_options)
                self.driver.set_page_load_timeout(30)
                
                self.logger.info("Selenium WebDriver 설정 완료")
                return True
            except Exception as e:
                self.logger.error(f"WebDriver 초기화 중 오류 발생: {e}", exc_info=True)
                return False
        except Exception as e:
            self.logger.error(f"WebDriver 설정 중 오류 발생: {e}", exc_info=True)
            return False
    
    def _close_driver(self):
        """WebDriver 종료"""
        if self.driver:
            try:
                self.driver.quit()
                self.logger.info("WebDriver 종료됨")
            except Exception as e:
                self.logger.warning(f"WebDriver 종료 중 오류 발생: {e}")
            finally:
                self.driver = None
    
    def _crawl_impl(self, test_mode: bool = False) -> List[Dict[str, Any]]:
        """
        Selenium을 사용한 크롤링 구현
        
        Args:
            test_mode: 테스트 모드 여부
            
        Returns:
            수집된 원두 정보 목록
        """
        self.logger.info(f"Selenium 크롤링 시작: {self.product_list_url}")
        
        all_results = []
        current_page = 1
        
        # 중복 URL 체크를 위한 집합
        processed_urls = set()
        
        try:
            # WebDriver 설정
            if not self._setup_driver():
                return []
            
            # 페이지 로드
            self.logger.info(f"페이지 로드 중: {self.product_list_url}")
            self.driver.get(self.product_list_url)
            
            # 각 페이지 크롤링
            while True:
                # 페이지 로딩 대기
                time.sleep(self.page_load_delay)
                
                self.logger.info(f"페이지 {current_page} 크롤링 중...")
                
                # 현재 페이지에서 상품 추출
                page_results = self._extract_products_from_current_page(test_mode)
                
                # 중복 제거
                unique_results = []
                for product in page_results:
                    if product.get('url') not in processed_urls:
                        processed_urls.add(product.get('url'))
                        unique_results.append(product)
                
                # 유니크한 결과만 추가
                all_results.extend(unique_results)
                
                # 테스트 모드인 경우 첫 페이지만 처리
                if test_mode:
                    self.logger.info("테스트 모드: 첫 페이지만 처리")
                    break
                
                # 페이지네이션이 활성화되어 있지 않거나 최대 페이지 수에 도달한 경우 종료
                if not self.pagination or current_page >= self.max_pages:
                    if self.pagination:
                        self.logger.info(f"최대 페이지 수({self.max_pages})에 도달하여 크롤링 종료")
                    break
                
                # 다음 페이지 이동
                if not self._move_to_next_page(current_page):
                    self.logger.info("더 이상 다음 페이지가 없어 크롤링 종료")
                    break
                
                current_page += 1
            
            return all_results
            
        except Exception as e:
            self.logger.error(f"Selenium 크롤링 중 오류 발생: {e}", exc_info=True)
            return all_results  # 일부 결과라도 반환
        finally:
            self._close_driver()
    
    def _extract_products_from_current_page(self, test_mode: bool = False) -> List[Dict[str, Any]]:
        """
        현재 페이지에서 상품 정보 추출
        
        Args:
            test_mode: 테스트 모드 여부
            
        Returns:
            현재 페이지에서 추출한 상품 정보 목록
        """
        page_results = []
        
        try:
            # 상품 목록 컨테이너 대기
            try:
                WebDriverWait(self.driver, self.wait_timeout).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, self.selectors['product_list_container']))
                )
            except TimeoutException:
                self.logger.warning(f"상품 목록 컨테이너를 찾을 수 없음: {self.selectors['product_list_container']}")
                # 컨테이너가 없어도 계속 진행
            
            # 페이지 소스 가져오기
            page_source = self.driver.page_source
            
            # BeautifulSoup으로 파싱
            soup = BeautifulSoup(page_source, 'html.parser')
            
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
                                detailed_info = self._fetch_product_detail(product_url)
                                if detailed_info:
                                    bean_info.update(detailed_info)
                        
                        page_results.append(bean_info)
                except Exception as e:
                    self.logger.error(f"상품 항목 파싱 중 오류 발생: {e}", exc_info=True)
                    continue
                    
        except Exception as e:
            self.logger.error(f"현재 페이지 처리 중 오류 발생: {e}", exc_info=True)
            
        return page_results
    
    def _move_to_next_page(self, current_page: int) -> bool:
        """
        다음 페이지로 이동
        
        Args:
            current_page: 현재 페이지 번호
            
        Returns:
            이동 성공 여부
        """
        try:
            # 페이지네이션 컨테이너 찾기
            try:
                pagination_container = WebDriverWait(self.driver, self.wait_timeout).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, self.selectors['pagination_container']))
                )
                
                # 페이지 링크 요소들 찾기
                page_links = pagination_container.find_elements(By.TAG_NAME, self.selectors['next_page'])
                if not page_links:
                    self.logger.warning("페이지 링크를 찾을 수 없음")
                    return self._move_to_next_page_by_url(current_page)
                
                # 다음 페이지 링크 찾기
                next_page_number = current_page + 1
                next_page_link = None
                
                for link in page_links:
                    link_text = link.text.strip()
                    if link_text.isdigit() and int(link_text) == next_page_number:
                        next_page_link = link
                        break
                
                if not next_page_link:
                    self.logger.info(f"다음 페이지({next_page_number}) 링크를 찾을 수 없음")
                    return self._move_to_next_page_by_url(current_page)
                
                # 다음 페이지로 이동
                self.logger.info(f"다음 페이지({next_page_number})로 이동 (링크 클릭)")
                next_page_link.click()
                time.sleep(self.page_load_delay)  # 페이지 로드 대기
                
                return True
                
            except (TimeoutException, NoSuchElementException) as e:
                self.logger.warning(f"다음 페이지 링크 찾기 실패: {e}")
                return self._move_to_next_page_by_url(current_page)
                
        except Exception as e:
            self.logger.error(f"다음 페이지로 이동 중 예상치 못한 오류 발생: {e}", exc_info=True)
            return self._move_to_next_page_by_url(current_page)
    
    def _move_to_next_page_by_url(self, current_page: int) -> bool:
        """
        URL 직접 수정을 통한 다음 페이지 이동
        
        Args:
            current_page: 현재 페이지 번호
            
        Returns:
            이동 성공 여부
        """
        try:
            # 현재 URL 가져오기
            current_url = self.driver.current_url
            
            # 다음 페이지 URL 생성
            next_page = current_page + 1
            
            # URL에 페이지 파라미터 추가 또는 수정
            if "page=" in current_url:
                next_url = re.sub(r'page=\d+', f'page={next_page}', current_url)
            else:
                # 센터커피 사이트의 경우 URL 형식이 다름
                if self.cafe_id == 'centercoffee':
                    # 상품 페이지를 구분하는 파라미터 제거 (?idx=XXX)
                    base_url = re.sub(r'\?idx=\d+.*', '', current_url)
                    
                    # 페이지 파라미터가 있는지 확인
                    if "?" in base_url:
                        next_url = f"{base_url}&page={next_page}&sort=recent"
                    else:
                        next_url = f"{base_url}?page={next_page}&sort=recent"
                else:
                    # 일반적인 URL 파라미터 추가
                    if "?" in current_url:
                        next_url = f"{current_url}&page={next_page}"
                    else:
                        next_url = f"{current_url}?page={next_page}"
            
            # URL 이동
            self.logger.info(f"다음 페이지({next_page})로 이동 (URL 직접 접근): {next_url}")
            self.driver.get(next_url)
            time.sleep(self.page_load_delay)  # 페이지 로드 대기
            
            # 페이지 변경 확인 (상품 항목이 있는지 확인)
            try:
                WebDriverWait(self.driver, self.wait_timeout).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, self.selectors['product_item']))
                )
                return True
            except TimeoutException:
                self.logger.warning(f"다음 페이지({next_page})에 상품 항목이 없음")
                return False
                
        except Exception as e:
            self.logger.error(f"URL을 통한 페이지 이동 중 오류 발생: {e}", exc_info=True)
            return False
    
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
        
        # 한글 인코딩 확인
        if not self._is_valid_text(title):
            self.logger.warning(f"제목에 인코딩 문제가 있을 수 있음: {title}")
        
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
        
        # Bean 객체 생성을 위한 데이터
        bean_data = {
            'name': title,
            'brand': self.cafe.name,
            'price': price,
            'url': product_url,
            'images': image_urls,
            'cafe_id': self.cafe_id
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
        상품 상세 페이지에서 추가 정보 추출
        
        Args:
            product_url: 상품 상세 페이지 URL
            
        Returns:
            추가 정보 딕셔너리
        """
        self.logger.info(f"상품 상세 정보 가져오기: {product_url}")
        
        try:
            # 이미 드라이버가 초기화되지 않았다면 초기화
            if not self.driver:
                if not self._setup_driver():
                    return None
            
            # 상세 페이지 로드
            self.driver.get(product_url)
            time.sleep(self.page_load_delay)
            
            # 상세 정보 컨테이너 대기
            detail_container_selector = self.selectors.get('product_detail_container', 'body')
            try:
                WebDriverWait(self.driver, self.wait_timeout).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, detail_container_selector))
                )
            except TimeoutException:
                self.logger.warning(f"상세 정보 컨테이너를 찾을 수 없음: {detail_container_selector}")
            
            # 페이지 소스 가져오기
            page_source = self.driver.page_source
            
            # BeautifulSoup으로 파싱
            soup = BeautifulSoup(page_source, 'html.parser')
            
            # 상세 정보 컨테이너 찾기
            detail_container = soup.select_one(detail_container_selector)
            if not detail_container:
                detail_container = soup
            
            # 상세 정보 딕셔너리
            detailed_info = {}
            
            # 설명 추출
            if 'product_description' in self.selectors:
                desc_elem = detail_container.select_one(self.selectors['product_description'])
                if desc_elem:
                    description = desc_elem.get_text().strip()
                    detailed_info['description'] = description
            
            # 추가 이미지 추출
            if 'product_detail_images' in self.selectors:
                img_elems = detail_container.select(self.selectors['product_detail_images'])
                additional_images = []
                for img_elem in img_elems:
                    img_url = img_elem.get('src', '')
                    if not img_url:
                        img_url = img_elem.get('data-src', '')
                    
                    if img_url and not (img_url.startswith('http://') or img_url.startswith('https://')):
                        img_url = urljoin(product_url, img_url)
                    
                    if img_url and img_url not in additional_images:
                        additional_images.append(img_url)
                
                if additional_images:
                    detailed_info['additional_images'] = additional_images
            
            # 원산지 정보 추출
            if 'product_origin' in self.selectors:
                origin_elem = detail_container.select_one(self.selectors['product_origin'])
                if origin_elem:
                    origin = origin_elem.get_text().strip()
                    detailed_info['origin'] = origin
            
            # 로스팅 정보 추출
            if 'product_roasting' in self.selectors:
                roasting_elem = detail_container.select_one(self.selectors['product_roasting'])
                if roasting_elem:
                    roasting = roasting_elem.get_text().strip()
                    detailed_info['roasting'] = roasting
            
            return detailed_info
            
        except Exception as e:
            self.logger.error(f"상품 상세 정보 가져오기 중 오류 발생: {e}", exc_info=True)
            return None
    
    def _extract_price(self, price_text: str) -> int:
        """
        가격 정보 추출
        
        Args:
            price_text: 가격 텍스트
            
        Returns:
            가격 (정수)
        """
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
        
        # 단순 숫자 추출 시도
        nums = re.findall(r'\d+', price_text)
        if nums:
            try:
                # 연속된 숫자 문자열을 합쳐서 처리
                combined_nums = []
                i = 0
                while i < len(nums):
                    if i < len(nums)-1 and len(nums[i+1]) == 3:  # 천 단위 숫자일 가능성
                        combined_nums.append(nums[i] + nums[i+1])
                        i += 2
                    else:
                        combined_nums.append(nums[i])
                        i += 1
                
                # 정수로 변환하여 가장 큰 값 선택
                values = [int(num) for num in combined_nums]
                if values:
                    # 일반적인 가격 범위 내의 값 필터링 (1,000 ~ 1,000,000원)
                    price_values = [v for v in values if 1000 <= v <= 1000000]
                    if price_values:
                        return max(price_values)
                    return max(values)
            except ValueError:
                pass
        
        return 0
    
    def _extract_weight(self, text: str) -> Optional[int]:
        """
        원두 무게 추출
        
        Args:
            text: 추출할 텍스트
            
        Returns:
            무게 (그램)
        """
        if not text:
            return None
        
        # 무게 패턴
        weight_pattern = re.compile(r'(\d+)\s*[gG]')
        weight_pattern_alt = re.compile(r'(\d+)\s*그램')
        
        # 기본 패턴으로 검색
        match = weight_pattern.search(text)
        if match:
            try:
                return int(match.group(1))
            except ValueError:
                pass
        
        # 대체 패턴으로 검색
        match = weight_pattern_alt.search(text)
        if match:
            try:
                return int(match.group(1))
            except ValueError:
                pass
        
        return None
    
    def _is_valid_text(self, text: str) -> bool:
        """
        텍스트에 인코딩 문제가 있는지 확인
        
        Args:
            text: 확인할 텍스트
            
        Returns:
            유효한 텍스트인지 여부
        """
        # 한글 글자가 포함되어 있는지 확인
        if re.search(r'[가-힣]', text):
            return True
        
        # 원두 이름에 일반적으로 포함되는 영어 단어가 있는지 확인
        common_words = ['coffee', 'bean', 'roast', 'blend', 'single', 'origin']
        for word in common_words:
            if word.lower() in text.lower():
                return True
        
        # 숫자와 특수문자만 있다면 의심스러움
        if re.match(r'^[\W\d_]+$', text):
            return False
        
        return True 
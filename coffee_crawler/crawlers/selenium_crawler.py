"""
Selenium 기반 크롤러

이 모듈은 Selenium을 활용하여 동적 로딩 페이지를 크롤링하는 크롤러를 구현합니다.
JavaScript로 콘텐츠를 로딩하는 웹사이트에서 원두 정보를 수집하는 데 사용됩니다.
"""

import re
import time
import logging
import os
import requests
from typing import Dict, List, Any, Optional, Tuple
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from datetime import datetime

# 전역 변수: GitHub Actions 환경 여부
is_github_actions = os.environ.get('GITHUB_ACTIONS') == 'true'
use_selenium = os.environ.get('USE_SELENIUM', '').lower() != 'false'

# GitHub Actions 환경에서는 항상 Selenium 사용 비활성화
if is_github_actions:
    use_selenium = False

if not is_github_actions:
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
    """
    Selenium을 사용하여 웹사이트에서 원두 정보를 수집하는 크롤러
    
    HTML 크롤링이 가능한 경우 requests와 BeautifulSoup으로 대체하여 사용 가능
    GitHub Actions 환경에서는 항상 requests와 BeautifulSoup 사용
    """

    def __init__(self, cafe_id: str, config: Dict[str, Any]):
        """
        Selenium 크롤러 초기화
        
        Args:
            cafe_id: 카페 ID
            config: 카페 설정 딕셔너리
        """
        super().__init__(cafe_id, config)
        self.driver = None
        self.wait = None
        self.headless = config.get('headless', True)
        self.wait_timeout = config.get('wait_timeout', 10)
        self.page_load_delay = config.get('page_load_delay', 2)
        self.pagination = config.get('pagination', False)
        self.max_pages = config.get('max_pages', 1)
        
        # URL 설정
        self.url = config.get('url')
        if not self.url:
            raise ValueError(f"URL이 설정되지 않았습니다: {cafe_id}")
        
        # 카페명 설정
        self.cafe_name = config.get('label', cafe_id)
        
        # 사용자 에이전트
        self.user_agent = config.get('user_agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36')
        
        # CSS 선택자
        self.selectors = config.get('selectors', {})
        
        # 셀레니움 관련 설정
        self.product_list_selector = self.selectors.get('product_list_container')
        self.product_item_selector = self.selectors.get('product_item')
        self.product_link_selector = self.selectors.get('product_link')
        self.product_title_selector = self.selectors.get('product_title')
        self.product_price_selector = self.selectors.get('product_price')
        self.product_image_selector = self.selectors.get('product_image')
        
        # 페이지네이션 관련 설정
        self.pagination_container_selector = self.selectors.get('pagination_container')
        self.next_page_selector = self.selectors.get('next_page')
        
        # 상세 페이지 설정
        self.fetch_product_detail = self.selectors.get('fetch_product_detail', False)
        self.product_detail_container_selector = self.selectors.get('product_detail_container')
        self.product_description_selector = self.selectors.get('product_description')
        self.product_detail_images_selector = self.selectors.get('product_detail_images')
        
        # 크롤링 시간 측정용
        self.start_time = time.time()
        
        self.logger = logging.getLogger(f'coffee_crawler.crawler.{self.cafe_id}')

    def _crawl_impl(self, test_mode=False) -> List[Bean]:
        """
        Selenium을 사용하여 웹사이트에서 원두 정보를 크롤링
        
        Args:
            test_mode: 테스트 모드 여부
            
        Returns:
            수집된 원두 정보 목록
        """
        self.start_time = time.time()  # 시간 측정 시작
        
        # GitHub Actions 환경이거나 USE_SELENIUM=false 설정이면 requests와 BeautifulSoup 사용
        if is_github_actions or not use_selenium:
            self.logger.info("GitHub Actions 환경 또는 USE_SELENIUM=false 설정으로 requests/BeautifulSoup 사용")
            return self._crawl_with_requests(test_mode)
        
        self.logger.info(f"Selenium 크롤링 시작: {self.url}")
        beans = []
        
        try:
            # WebDriver 초기화
            self._setup_driver()
            
            if not self.driver:
                self.logger.error("WebDriver 초기화 실패, requests/BeautifulSoup으로 대체")
                return self._crawl_with_requests(test_mode)
            
            # 페이지 로드
            self.driver.get(self.url)
            time.sleep(self.page_load_delay)  # 페이지 로딩 대기
            
            # 제품 목록 가져오기
            page_count = 0
            
            while True:
                page_count += 1
                
                try:
                    # 제품 목록 컨테이너 찾기
                    if self.product_list_selector:
                        try:
                            product_list_container = WebDriverWait(self.driver, self.wait_timeout).until(
                                EC.presence_of_element_located((By.CSS_SELECTOR, self.product_list_selector))
                            )
                        except TimeoutException:
                            self.logger.warning(f"제품 목록 컨테이너를 찾을 수 없음: {self.product_list_selector}")
                            break
                    else:
                        product_list_container = self.driver.find_element(By.TAG_NAME, "body")
                    
                    # 제품 항목 찾기
                    product_items = product_list_container.find_elements(By.CSS_SELECTOR, self.product_item_selector)
                    self.logger.info(f"페이지 {page_count}: {len(product_items)}개 제품 발견")
                    
                    # 각 제품 정보 추출
                    for item in product_items:
                        bean = self._extract_product_info(item)
                        if bean:
                            beans.append(bean)
                    
                    # 페이지네이션 처리
                    if self.pagination and page_count < self.max_pages:
                        next_page = self._go_to_next_page()
                        if not next_page:
                            break
                    else:
                        break
                        
                except Exception as e:
                    self.logger.error(f"제품 목록 처리 중 오류 발생: {str(e)}")
                    break
                    
        except Exception as e:
            self.logger.error(f"크롤링 중 오류 발생: {str(e)}")
        finally:
            # 드라이버 종료
            self._close_driver()
            
        # 결과 필터링
        filtered_beans = self._filter_beans(beans)
        
        self.logger.info(f"Selenium 크롤링 완료: {len(filtered_beans)}개 원두 정보 수집 (총 {len(beans)}개 중), 소요시간: {time.time() - self.start_time:.2f}초")
        return filtered_beans

    def _crawl_with_requests(self, test_mode=False) -> List[Bean]:
        """
        requests와 BeautifulSoup을 사용하여 웹사이트에서 원두 정보를 크롤링
        
        Args:
            test_mode: 테스트 모드 여부
            
        Returns:
            수집된 원두 정보 목록
        """
        self.logger.info(f"GitHub Actions 환경에서 requests로 크롤링: {self.url}")
        
        beans = []
        
        try:
            # 웹 페이지 요청
            headers = {"User-Agent": self.user_agent}
            response = requests.get(self.url, headers=headers, timeout=30)
            
            if response.status_code != 200:
                self.logger.error(f"페이지 요청 실패: {response.status_code}")
                return []
                
            # HTML 파싱
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 제품 목록 컨테이너 찾기
            if self.product_list_selector:
                product_list_container = soup.select_one(self.product_list_selector)
                if not product_list_container:
                    self.logger.warning(f"제품 목록 컨테이너를 찾을 수 없음: {self.product_list_selector}")
                    product_list_container = soup
            else:
                product_list_container = soup
                
            # 제품 항목 찾기
            product_items = product_list_container.select(self.product_item_selector)
            self.logger.info(f"제품 항목 수: {len(product_items)}")
            
            # 각 제품 정보 추출
            for item in product_items:
                bean = self._extract_product_info_bs4(item)
                if bean:
                    beans.append(bean)
                    
        except Exception as e:
            self.logger.error(f"requests 크롤링 중 오류 발생: {str(e)}")
            
        # 결과 필터링
        filtered_beans = self._filter_beans(beans)
        
        self.logger.info(f"requests 크롤링 완료: {len(filtered_beans)}개 원두 정보 수집 (총 {len(beans)}개 중), 소요시간: {time.time() - self.start_time:.2f}초")
        return filtered_beans

    def _extract_product_info_bs4(self, item_soup) -> Optional[Bean]:
        """
        BeautifulSoup을 사용하여 제품 정보 추출
        
        Args:
            item_soup: BeautifulSoup 요소
            
        Returns:
            Bean 객체 또는 None
        """
        try:
            # 제품 링크 추출
            link_element = None
            if self.product_link_selector:
                link_element = item_soup.select_one(self.product_link_selector)
            
            # 제품 URL
            product_url = None
            if link_element and link_element.has_attr('href'):
                product_url = link_element['href']
                # 상대 URL을 절대 URL로 변환
                if product_url and not (product_url.startswith('http://') or product_url.startswith('https://')):
                    product_url = urljoin(self.url, product_url)
            
            # 제품 이름
            name = None
            if self.product_title_selector:
                title_element = item_soup.select_one(self.product_title_selector)
                if title_element:
                    name = title_element.get_text().strip()
            
            # 이름이 없으면 링크 텍스트 사용
            if not name and link_element:
                name = link_element.get_text().strip()
            
            if not name:
                return None
            
            # 제품 가격
            price = None
            if self.product_price_selector:
                price_element = item_soup.select_one(self.product_price_selector)
                if price_element:
                    price_text = price_element.get_text().strip()
                    # 가격에서 숫자만 추출
                    price_numbers = re.findall(r'\d+,?\d*', price_text)
                    if price_numbers:
                        # 쉼표 제거 후 정수로 변환
                        price = int(''.join(price_numbers[0].split(',')))
            
            # 제품 이미지 URL
            image_url = None
            if self.product_image_selector:
                image_element = item_soup.select_one(self.product_image_selector)
                if image_element:
                    if image_element.name == 'img':
                        image_url = image_element.get('src')
                        if not image_url:
                            image_url = image_element.get('data-src')
                    # style 속성에서 이미지 URL 추출 시도
                    elif 'style' in image_element.attrs:
                        style = image_element['style']
                        url_match = re.search(r'url\([\'"]?([^\'"]+)[\'"]?\)', style)
                        if url_match:
                            image_url = url_match.group(1)
            
            # 상대 URL을 절대 URL로 변환
            if image_url and not (image_url.startswith('http://') or image_url.startswith('https://')):
                image_url = urljoin(self.url, image_url)
            
            # Bean 객체 생성
            bean = Bean(
                id=self._generate_id(name),
                name=name,
                price=price,
                cafe=self.cafe_name,
                url=product_url,
                image_url=image_url,
                description="",
                metadata={
                    "source_url": self.url,
                    "crawled_at": self._get_current_time()
                }
            )
            
            return bean
            
        except Exception as e:
            self.logger.error(f"BeautifulSoup으로 제품 정보 추출 중 오류 발생: {str(e)}")
            return None

    def _setup_driver(self):
        """
        웹드라이버 설정 및 초기화
        
        Returns:
            초기화된 WebDriver 객체
        """
        # GitHub Actions 환경에서는 항상 None 반환
        if os.environ.get('GITHUB_ACTIONS') == 'true':
            self.logger.info("GitHub Actions 환경에서는 WebDriver 초기화를 건너뜁니다")
            return None
        
        # 환경 변수 확인 - USE_SELENIUM이 'false'이면 초기화 건너뛰기
        if os.environ.get('USE_SELENIUM', '').lower() == 'false':
            self.logger.info("환경 변수 USE_SELENIUM=false로 설정되어 Selenium 초기화 건너뜀")
            return None
        
        # 드라이버 경로 설정
        try:
            # chrome driver manager 사용
            from webdriver_manager.chrome import ChromeDriverManager
            from selenium.webdriver.chrome.service import Service
            from selenium.webdriver.chrome.options import Options as ChromeOptions
            
            # 운영체제 확인
            import platform
            is_windows = platform.system() == 'Windows'
            
            # 크롬 옵션 설정
            chrome_options = ChromeOptions()
            
            # 헤드리스 모드 설정
            if self.headless:
                chrome_options.add_argument('--headless=new')  # 최신 헤드리스 모드 사용
                chrome_options.add_argument('--no-sandbox')
                chrome_options.add_argument('--disable-dev-shm-usage')
                chrome_options.add_argument('--disable-gpu')
            
            # 추가 크롬 옵션 설정
            chrome_options.add_argument('--start-maximized')
            chrome_options.add_argument('--disable-extensions')
            chrome_options.add_argument('--disable-popup-blocking')
            chrome_options.add_argument(f'user-agent={self.user_agent}')
            
            # 환경 변수로 지정된 ChromeDriver 경로 사용
            if os.environ.get('SELENIUM_DRIVER_PATH'):
                driver_path = os.environ.get('SELENIUM_DRIVER_PATH')
                self.logger.info(f"환경 변수에서 지정된 ChromeDriver 사용: {driver_path}")
                service = Service(driver_path)
            else:
                # 자동 설치된 ChromeDriver 사용
                chrome_path = ChromeDriverManager().install()
                
                # THIRD_PARTY_NOTICES.chromedriver 파일 대신 실제 chromedriver 실행 파일 사용
                if "THIRD_PARTY_NOTICES.chromedriver" in chrome_path:
                    self.logger.warning(f"잘못된 ChromeDriver 경로 감지: {chrome_path}")
                    
                    if is_windows:
                        # Windows 환경에서는 chromedriver.exe 파일 찾기
                        driver_dir = os.path.dirname(chrome_path)
                        chromedriver_exe = os.path.join(driver_dir, "chromedriver.exe")
                        if os.path.exists(chromedriver_exe):
                            chrome_path = chromedriver_exe
                            self.logger.info(f"ChromeDriver 경로 수정: {chrome_path}")
                    else:
                        # Linux/Mac 환경에서 chromedriver 파일 찾기
                        driver_dir = os.path.dirname(os.path.dirname(chrome_path))
                        chromedriver_bin = os.path.join(driver_dir, "chromedriver")
                        if os.path.exists(chromedriver_bin):
                            chrome_path = chromedriver_bin
                            self.logger.info(f"ChromeDriver 경로 수정: {chrome_path}")
                
                service = Service(chrome_path)
            
            # 드라이버 초기화
            self.driver = webdriver.Chrome(service=service, options=chrome_options)
            
            # 페이지 로딩 타임아웃 설정
            self.driver.set_page_load_timeout(self.wait_timeout)
            
            return self.driver
            
        except Exception as e:
            self.logger.error(f"WebDriver 초기화 중 오류 발생: {e}")
            import traceback
            self.logger.error(f"상세 오류: {traceback.format_exc()}")
            return None

    def _close_driver(self):
        """WebDriver 종료"""
        if is_github_actions or not use_selenium:
            self.logger.info("GitHub Actions 또는 USE_SELENIUM=false 환경에서는 WebDriver 종료 건너뜀")
            return
            
        if self.driver:
            try:
                self.driver.quit()
            except Exception as e:
                self.logger.error(f"WebDriver 종료 중 오류 발생: {str(e)}")
            finally:
                self.driver = None
                self.wait = None

    def _extract_product_info(self, item_element) -> Optional[Bean]:
        """
        제품 요소에서 원두 정보 추출
        
        Args:
            item_element: 제품 요소
            
        Returns:
            추출된 원두 정보 또는 None
        """
        # GitHub Actions이나 USE_SELENIUM=false 환경에서는 사용하지 않음
        if is_github_actions or not use_selenium:
            self.logger.info("GitHub Actions 또는 USE_SELENIUM=false 환경에서는 Selenium 정보 추출 건너뜀")
            return None
        
        try:
            # 제품 링크 추출
            link_element = None
            if self.product_link_selector:
                link_elements = item_element.find_elements(By.CSS_SELECTOR, self.product_link_selector)
                if link_elements:
                    link_element = link_elements[0]
            
            # 제품 URL
            product_url = link_element.get_attribute("href") if link_element else None
            
            # 제품 이름
            name = None
            if self.product_title_selector:
                title_elements = item_element.find_elements(By.CSS_SELECTOR, self.product_title_selector)
                if title_elements:
                    name = title_elements[0].text.strip()
            
            # 이름이 없으면 링크 텍스트 사용
            if not name and link_element:
                name = link_element.text.strip()
            
            if not name:
                return None
            
            # 제품 가격
            price = None
            if self.product_price_selector:
                price_elements = item_element.find_elements(By.CSS_SELECTOR, self.product_price_selector)
                if price_elements:
                    price_text = price_elements[0].text.strip()
                    # 가격에서 숫자만 추출
                    price_numbers = re.findall(r'\d+,?\d*', price_text)
                    if price_numbers:
                        # 쉼표 제거 후 정수로 변환
                        price = int(''.join(price_numbers[0].split(',')))
            
            # 제품 이미지 URL
            image_url = None
            if self.product_image_selector:
                image_elements = item_element.find_elements(By.CSS_SELECTOR, self.product_image_selector)
                if image_elements:
                    image_url = image_elements[0].get_attribute("src")
            
            # 상세 정보 가져오기
            description = ""
            if self.fetch_product_detail and product_url:
                description = self._fetch_product_detail(product_url)
            
            # Bean 객체 생성
            bean = Bean(
                id=self._generate_id(name),
                name=name,
                price=price,
                cafe=self.cafe_name,
                url=product_url,
                image_url=image_url,
                description=description,
                metadata={
                    "source_url": self.url,
                    "crawled_at": self._get_current_time()
                }
            )
            
            return bean
            
        except Exception as e:
            self.logger.error(f"제품 정보 추출 중 오류 발생: {str(e)}")
            return None

    def _fetch_product_detail(self, product_url) -> str:
        """
        제품 상세 페이지에서 추가 정보 가져오기
        
        Args:
            product_url: 제품 상세 페이지 URL
            
        Returns:
            제품 상세 설명
        """
        if is_github_actions:
            return ""  # GitHub Actions에서는 사용하지 않음
            
        try:
            # 현재 페이지 URL 저장
            current_url = self.driver.current_url
            
            # 상세 페이지로 이동
            self.driver.get(product_url)
            time.sleep(self.page_load_delay)  # 페이지 로딩 대기
            
            description = ""
            
            # 상세 정보 컨테이너 찾기
            if self.product_detail_container_selector:
                try:
                    detail_container = WebDriverWait(self.driver, self.wait_timeout).until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, self.product_detail_container_selector))
                    )
                except TimeoutException:
                    self.logger.warning(f"상세 정보 컨테이너를 찾을 수 없음: {self.product_detail_container_selector}")
                    return description
            else:
                detail_container = self.driver.find_element(By.TAG_NAME, "body")
            
            # 상세 설명 추출
            if self.product_description_selector:
                desc_elements = detail_container.find_elements(By.CSS_SELECTOR, self.product_description_selector)
                if desc_elements:
                    description = desc_elements[0].text.strip()
            
            # 원래 페이지로 돌아가기
            self.driver.get(current_url)
            time.sleep(self.page_load_delay)  # 페이지 로딩 대기
            
            return description
            
        except Exception as e:
            self.logger.error(f"상세 정보 가져오기 중 오류 발생: {str(e)}")
            
            # 오류가 발생하면 원래 페이지로 돌아가기 시도
            try:
                self.driver.get(current_url)
                time.sleep(self.page_load_delay)
            except:
                pass
                
            return ""

    def _go_to_next_page(self) -> bool:
        """
        다음 페이지로 이동
        
        Returns:
            다음 페이지 이동 성공 여부
        """
        if is_github_actions:
            return False  # GitHub Actions에서는 사용하지 않음
            
        try:
            # 페이지네이션 컨테이너 찾기
            if self.pagination_container_selector:
                try:
                    pagination_container = WebDriverWait(self.driver, self.wait_timeout).until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, self.pagination_container_selector))
                    )
                except TimeoutException:
                    self.logger.warning(f"페이지네이션 컨테이너를 찾을 수 없음: {self.pagination_container_selector}")
                    return False
            else:
                pagination_container = self.driver.find_element(By.TAG_NAME, "body")
            
            # 다음 페이지 버튼 찾기
            next_page_elements = pagination_container.find_elements(By.CSS_SELECTOR, self.next_page_selector)
            
            if not next_page_elements:
                self.logger.info("다음 페이지 버튼을 찾을 수 없음")
                return False
            
            # 다음 페이지 버튼 클릭
            next_page_elements[0].click()
            time.sleep(self.page_load_delay)  # 페이지 로딩 대기
            
            return True
            
        except Exception as e:
            self.logger.error(f"다음 페이지 이동 중 오류 발생: {str(e)}")
            return False 

    def _filter_beans(self, beans: List[Bean]) -> List[Bean]:
        """
        원두 정보 필터링
        
        Args:
            beans: 원두 정보 목록
            
        Returns:
            필터링된 원두 정보 목록
        """
        if not beans:
            self.logger.warning("필터링할 결과가 없습니다.")
            return []
            
        filtered = []
        excluded_count = 0
        
        for bean in beans:
            # 제품명이 없으면 건너뜀
            if not bean.name:
                self.logger.debug("제품명이 없는 항목 제외")
                excluded_count += 1
                continue
                
            # 제외 키워드 확인
            excluded = False
            name_lower = bean.name.lower()
            description_lower = bean.description.lower() if bean.description else ""
            
            for keyword in self.config.get('exclude', []):
                keyword_lower = keyword.lower()
                if keyword_lower in name_lower or keyword_lower in description_lower:
                    self.logger.debug(f"제외 키워드 '{keyword}' 포함: {bean.name}")
                    excluded = True
                    break
            
            if not excluded:
                filtered.append(bean)
            else:
                excluded_count += 1
                
        self.logger.info(f"필터링 결과: {len(filtered)}개 포함, {excluded_count}개 제외")
        return filtered

    def _generate_id(self, name: str) -> str:
        """
        원두 ID 생성
        
        Args:
            name: 원두 이름
            
        Returns:
            생성된 ID
        """
        # 카페 ID와 이름으로 고유 ID 생성
        safe_name = re.sub(r'[^\w가-힣]', '_', name)
        return f"{self.cafe_id}_{safe_name}"
        
    def _get_current_time(self) -> str:
        """
        현재 시간 문자열 반환
        
        Returns:
            현재 시간 문자열 (ISO 포맷)
        """
        return datetime.now().isoformat() 
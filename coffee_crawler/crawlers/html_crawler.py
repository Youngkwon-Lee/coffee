"""
HTML 파싱 크롤러

이 모듈은 HTML 웹페이지를 크롤링하여 원두 정보를 수집하는 크롤러를 구현합니다.
주로 프릳츠와 같은 커피 브랜드의 웹사이트를 대상으로 합니다.
"""

import re
import logging
import time
import requests
from typing import Dict, List, Any, Optional, Tuple
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
try:
    import easyocr
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False

from coffee_crawler.crawlers.base_crawler import BaseCrawler
from coffee_crawler.models.bean import Bean

# 로거 설정
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

# 콘솔 핸들러 추가
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.DEBUG)
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
console_handler.setFormatter(formatter)
logger.addHandler(console_handler)

class HtmlCrawler(BaseCrawler):
    """HTML 파싱 크롤러 클래스"""
    
    def __init__(self, cafe_id: str, config: Dict[str, Any]):
        """
        HTML 크롤러 초기화
        
        Args:
            cafe_id: 카페 ID
            config: 카페 설정
        """
        super().__init__(cafe_id, config)
        
        # 기본 설정
        self.product_list_url = config.get('url', '')
        self.page_delay = config.get('page_delay', 1.0)
        self.selectors = config.get('selectors', {})
        self.encoding = config.get('encoding', 'utf-8')  # 인코딩 설정 추가
        
        # OCR 초기화
        self.ocr_reader = None
        if OCR_AVAILABLE:
            try:
                import os
                os.environ['CUDA_VISIBLE_DEVICES'] = ''  # CPU 사용 강제
                self.ocr_reader = easyocr.Reader(['ko', 'en'], gpu=False)
                self.logger.info("OCR 초기화 완료 (CPU 모드)")
            except Exception as e:
                self.logger.warning(f"OCR 초기화 실패: {e}")
                self.ocr_reader = None
        else:
            self.logger.warning("EasyOCR이 설치되지 않았습니다. 이미지 텍스트 추출 기능을 사용할 수 없습니다.")
        
        # 설정 검증
        self._validate_selectors()
        
        # 가격 정규식 패턴
        self.price_pattern = re.compile(r'(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*원')
        
        # 테스트 모드 제한 수
        self.test_limit = 3
        
        logger.debug(f"크롤러 초기화 완료: {cafe_id}")
        logger.debug(f"상품 목록 URL: {self.product_list_url}")
        logger.debug(f"선택자: {self.selectors}")
        
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
        
        # 상품 목록 페이지 요청 (인코딩 설정 추가)
        headers = {'Accept-Charset': self.encoding}
        response, success = self._safe_request(self.product_list_url, headers=headers)
        
        if not success:
            self.logger.error("상품 목록 페이지 요청 실패")
            return []
        
        # HTML 파싱 (인코딩 명시)
        try:
            # 명시적으로 인코딩 설정
            response.encoding = self.encoding
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
        
        # 상품 상세 페이지 요청 (인코딩 설정 추가)
        headers = {'Accept-Charset': self.encoding}
        response, success = self._safe_request(product_url, headers=headers)
        
        if not success:
            self.logger.warning(f"상품 상세 페이지 요청 실패: {product_url}")
            return None
        
        # HTML 파싱 (인코딩 명시)
        try:
            # 명시적으로 인코딩 설정
            response.encoding = self.encoding
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 상세 정보 딕셔너리
            details = {}
            
            # 설명 추출
            if 'product_description' in self.selectors:
                desc_elem = soup.select_one(self.selectors['product_description'])
                if desc_elem:
                    details['description'] = desc_elem.get_text().strip()
                    self.logger.debug(f"설명 추출 성공: {details['description'][:100]}...")
                else:
                    self.logger.debug(f"설명 요소를 찾을 수 없음: {self.selectors['product_description']}")
            
            # 원산지/가공방식 추출 (같은 div에서)
            origin, process = None, None
            
            # 먼저 HTML에서 시도
            # 먼저 모든 요소에서 '과테말라', '워시드' 등 실제 값으로 찾기
            page_text = soup.get_text()
            self.logger.info(f"DEBUG: 페이지에서 '과테말라' 포함 여부: {'과테말라' in page_text}")
            self.logger.info(f"DEBUG: 페이지에서 '워시드' 포함 여부: {'워시드' in page_text}")
            self.logger.info(f"DEBUG: 페이지에서 'Guatemala' 포함 여부: {'Guatemala' in page_text}")
            self.logger.info(f"DEBUG: 페이지에서 'Washed' 포함 여부: {'Washed' in page_text}")
            
            # 모든 div에서 원산지/가공방식 관련 키워드 찾기
            all_divs = soup.find_all('div')
            self.logger.info(f"DEBUG: 전체 div 개수: {len(all_divs)}")
            
            found_origin_divs = []
            found_process_divs = []
            
            for i, div in enumerate(all_divs):
                div_text = div.get_text().strip()
                
                # 원산지 관련 키워드 찾기
                if any(keyword in div_text for keyword in ['과테말라', 'Guatemala', '국가', 'Nation', '원산지']):
                    found_origin_divs.append((i, div_text[:200]))
                
                # 가공방식 관련 키워드 찾기  
                if any(keyword in div_text for keyword in ['워시드', 'Washed', '가공방식', 'Processing']):
                    found_process_divs.append((i, div_text[:200]))
            
            self.logger.info(f"DEBUG: 원산지 관련 div 개수: {len(found_origin_divs)}")
            for i, text in found_origin_divs[:3]:  # 처음 3개만 출력
                self.logger.info(f"DEBUG: 원산지 div {i}: '{text}...'")
            
            self.logger.info(f"DEBUG: 가공방식 관련 div 개수: {len(found_process_divs)}")
            for i, text in found_process_divs[:3]:  # 처음 3개만 출력
                self.logger.info(f"DEBUG: 가공방식 div {i}: '{text}...'")
            
            # 가장 많은 정보를 포함한 div 찾기
            best_div = None
            max_keywords = 0
            
            for div in all_divs:
                div_text = div.get_text().strip()
                keyword_count = 0
                
                # 키워드 개수 세기
                keywords = ['과테말라', 'Guatemala', '워시드', 'Washed', '국가', 'Nation', '가공방식', 'Processing']
                for keyword in keywords:
                    if keyword in div_text:
                        keyword_count += 1
                
                if keyword_count > max_keywords:
                    max_keywords = keyword_count
                    best_div = div
            
            if best_div and max_keywords > 0:
                text = best_div.get_text().strip()
                self.logger.info(f"DEBUG: 최고 점수 div (키워드 {max_keywords}개): '{text[:300]}...'")
                
                # 다양한 패턴으로 원산지 추출
                origin_patterns = [
                    r'과테말라\s*Guatemala',
                    r'Guatemala',
                    r'과테말라',
                    r'국가[^:]*:\s*([^\n\r]+)',
                    r'Nation[^:]*:\s*([^\n\r]+)'
                ]
                
                for pattern in origin_patterns:
                    match = re.search(pattern, text, re.IGNORECASE)
                    if match:
                        if match.groups():
                            origin = match.group(1).strip()
                        else:
                            origin = match.group(0).strip()
                        details['origin'] = origin
                        self.logger.info(f"원산지 추출 성공: '{origin}' (패턴: {pattern})")
                        break
                
                # 다양한 패턴으로 가공방식 추출
                process_patterns = [
                    r'워시드\s*Washed',
                    r'Washed',
                    r'워시드',
                    r'가공방식[^:]*:\s*([^\n\r]+)',
                    r'Processing[^:]*:\s*([^\n\r]+)'
                ]
                
                for pattern in process_patterns:
                    match = re.search(pattern, text, re.IGNORECASE)
                    if match:
                        if match.groups():
                            process = match.group(1).strip()
                        else:
                            process = match.group(0).strip()
                        details['processing'] = process
                        self.logger.info(f"가공방식 추출 성공: '{process}' (패턴: {pattern})")
                        break
            else:
                self.logger.info("DEBUG: HTML에서 원산지/가공방식 정보를 찾을 수 없음")
            
            # HTML에서 찾지 못했고 OCR이 사용 가능하다면 이미지에서 시도
            if (not origin or not process) and self.ocr_reader:
                self.logger.info("HTML에서 정보를 찾지 못했습니다. 이미지 OCR을 시도합니다.")
                
                # 상품 이미지들에서 OCR 시도
                image_elements = soup.find_all('img')
                for img in image_elements:
                    img_url = img.get('src', '') or img.get('data-src', '')
                    if img_url and not img_url.startswith('data:'):
                        # 상대 URL을 절대 URL로 변환
                        if not img_url.startswith('http'):
                            img_url = urljoin(product_url, img_url)
                        
                        self.logger.info(f"이미지 OCR 시도: {img_url}")
                        
                        # 이미지에서 텍스트 추출
                        image_text = self._extract_text_from_image(img_url)
                        if image_text:
                            img_origin, img_process = self._extract_origin_and_process_from_text(image_text)
                            
                            if img_origin and not origin:
                                origin = img_origin
                                details['origin'] = origin
                            
                            if img_process and not process:
                                process = img_process
                                details['processing'] = process
                            
                            # 둘 다 찾았으면 중단
                            if origin and process:
                                break
            
            # 향미 노트 추출
            if 'product_flavor_notes' in self.selectors:
                flavor_elem = soup.select_one(self.selectors['product_flavor_notes'])
                if flavor_elem:
                    flavors_text = flavor_elem.get_text().strip()
                    # 쉼표, 점, 슬래시 등으로 구분된 향미 노트 분리
                    flavors = []
                    for flavor in re.split(r'[,·/]', flavors_text):
                        flavor = flavor.strip()
                        if flavor:
                            flavors.append(flavor)
                    details['flavor_note'] = flavors
                    self.logger.debug(f"향미 노트 추출 성공: {flavors}")
                else:
                    self.logger.debug(f"향미 노트 요소를 찾을 수 없음: {self.selectors['product_flavor_notes']}")
            
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
            
        # 다양한 가격 패턴 처리
        # 1. ₩16,000 형태
        won_pattern = re.compile(r'₩\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)')
        match = won_pattern.search(price_text)
        if match:
            price_str = match.group(1)
            try:
                price = int(price_str.replace(',', ''))
                return price
            except ValueError:
                pass
        
        # 2. 16,000원 형태
        standard_pattern = re.compile(r'(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*원')
        match = standard_pattern.search(price_text)
        if match:
            price_str = match.group(1)
            try:
                price = int(price_str.replace(',', ''))
                return price
            except ValueError:
                pass
        
        # 3. 판매가 : 20,000원 형태
        sale_pattern = re.compile(r'판매가\s*[:：]\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*원')
        match = sale_pattern.search(price_text)
        if match:
            price_str = match.group(1)
            try:
                price = int(price_str.replace(',', ''))
                return price
            except ValueError:
                pass
        
        # 4. 기존 패턴 (호환성을 위해 유지)
        match = self.price_pattern.search(price_text)
        if match:
            price_str = match.group(1)
            try:
                price = int(price_str.replace(',', ''))
                return price
            except ValueError:
                pass
        
        # 5. 숫자만 추출 (마지막 수단)
        nums = re.findall(r'\d{3,}', price_text)  # 최소 3자리 숫자
        if nums:
            try:
                # 가장 큰 숫자를 가격으로 간주 (단, 1000 이상)
                valid_prices = [int(n.replace(',', '')) for n in nums if int(n.replace(',', '')) >= 1000]
                if valid_prices:
                    return max(valid_prices)
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

    def _extract_text_from_image(self, image_url: str) -> str:
        """
        이미지에서 OCR을 통해 텍스트 추출
        
        Args:
            image_url: 이미지 URL
            
        Returns:
            추출된 텍스트
        """
        if not self.ocr_reader or not image_url:
            return ""
        
        try:
            # 브라우저 헤더로 접근 시도
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Referer': self.product_list_url,
                'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
                'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
            
            # 이미지 다운로드
            response = requests.get(image_url, headers=headers, timeout=10)
            response.raise_for_status()
            
            # OCR로 텍스트 추출
            results = self.ocr_reader.readtext(response.content)
            
            # 텍스트들을 합치기
            extracted_text = " ".join([result[1] for result in results])
            self.logger.info(f"이미지에서 추출된 텍스트: {extracted_text[:200]}...")
            
            return extracted_text
            
        except Exception as e:
            self.logger.warning(f"이미지 텍스트 추출 실패 ({image_url}): {e}")
            return ""
    
    def _extract_origin_and_process_from_text(self, text: str) -> Tuple[Optional[str], Optional[str]]:
        """
        텍스트에서 원산지와 가공방식 추출
        
        Args:
            text: 추출할 텍스트
            
        Returns:
            (원산지, 가공방식) 튜플
        """
        origin = None
        process = None
        
        # 원산지 패턴들 (더 다양하게 확장)
        origin_patterns = [
            # 한국어 + 영어 조합
            r'과테말라\s*Guatemala',
            r'에티오피아\s*Ethiopia', 
            r'케냐\s*Kenya',
            r'콜롬비아\s*Colombia',
            r'브라질\s*Brazil',
            r'코스타리카\s*Costa\s*Rica',
            r'온두라스\s*Honduras',
            r'파나마\s*Panama',
            r'페루\s*Peru',
            r'볼리비아\s*Bolivia',
            r'에콰도르\s*Ecuador',
            r'베네수엘라\s*Venezuela',
            r'자메이카\s*Jamaica',
            r'하와이\s*Hawaii',
            r'인도\s*India',
            r'인도네시아\s*Indonesia',
            r'베트남\s*Vietnam',
            r'미얀마\s*Myanmar',
            r'예멘\s*Yemen',
            r'르완다\s*Rwanda',
            r'부룬디\s*Burundi',
            r'탄자니아\s*Tanzania',
            r'우간다\s*Uganda',
            r'짐바브웨\s*Zimbabwe',
            r'말라위\s*Malawi',
            r'마다가스카르\s*Madagascar',
            
            # 영어만
            r'Guatemala(?!\w)',
            r'Ethiopia(?!\w)',
            r'Kenya(?!\w)', 
            r'Colombia(?!\w)',
            r'Brazil(?!\w)',
            r'Costa\s*Rica(?!\w)',
            r'Honduras(?!\w)',
            r'Panama(?!\w)',
            r'Peru(?!\w)',
            r'Bolivia(?!\w)',
            r'Ecuador(?!\w)',
            r'Venezuela(?!\w)',
            r'Jamaica(?!\w)',
            r'Hawaii(?!\w)',
            r'India(?!\w)',
            r'Indonesia(?!\w)',
            r'Vietnam(?!\w)',
            r'Myanmar(?!\w)',
            r'Yemen(?!\w)',
            r'Rwanda(?!\w)',
            r'Burundi(?!\w)',
            r'Tanzania(?!\w)',
            r'Uganda(?!\w)',
            r'Zimbabwe(?!\w)',
            r'Malawi(?!\w)',
            r'Madagascar(?!\w)',
            
            # 한국어만
            r'과테말라(?!\w)',
            r'에티오피아(?!\w)',
            r'케냐(?!\w)',
            r'콜롬비아(?!\w)',
            r'브라질(?!\w)',
            r'코스타리카(?!\w)',
            r'온두라스(?!\w)',
            r'파나마(?!\w)',
            r'페루(?!\w)',
            r'볼리비아(?!\w)',
            r'에콰도르(?!\w)',
            r'베네수엘라(?!\w)',
            r'자메이카(?!\w)',
            r'하와이(?!\w)',
            r'인도(?!\w)',
            r'인도네시아(?!\w)',
            r'베트남(?!\w)',
            r'미얀마(?!\w)',
            r'예멘(?!\w)',
            r'르완다(?!\w)',
            r'부룬디(?!\w)',
            r'탄자니아(?!\w)',
            r'우간다(?!\w)',
            r'짐바브웨(?!\w)',
            r'말라위(?!\w)',
            r'마다가스카르(?!\w)',
            
            # 지역명 포함 패턴
            r'(?:국가|Nation|Origin|원산지)[:：\s]*([^\n\r,]+)',
            r'([가-힣A-Za-z\s]+)(?:\s+지역|\s+농장|\s+플랜테이션)'
        ]
        
        # 가공방식 패턴들 (더 다양하게 확장)
        process_patterns = [
            # 한국어 + 영어 조합
            r'워시드\s*Washed',
            r'내추럴\s*Natural',
            r'허니\s*Honey',
            r'펄프드\s*내추럴\s*Pulped\s*Natural',
            r'세미워시드\s*Semi\s*Washed',
            r'웻헐드\s*Wet\s*Hulled',
            r'아나에로빅\s*Anaerobic',
            r'카보닉\s*마세레이션\s*Carbonic\s*Maceration',
            r'더블\s*퍼멘테이션\s*Double\s*Fermentation',
            
            # 영어만
            r'Washed(?!\w)',
            r'Natural(?!\w)',
            r'Honey(?!\w)',
            r'Pulped\s*Natural(?!\w)',
            r'Semi\s*Washed(?!\w)',
            r'Wet\s*Hulled(?!\w)',
            r'Anaerobic(?!\w)',
            r'Carbonic\s*Maceration(?!\w)',
            r'Double\s*Fermentation(?!\w)',
            r'Extended\s*Fermentation(?!\w)',
            r'Thermal\s*Shock(?!\w)',
            r'Co2\s*Decaffeination(?!\w)',
            r'Swiss\s*Water(?!\w)',
            r'Black\s*Honey(?!\w)',
            r'Red\s*Honey(?!\w)',
            r'Yellow\s*Honey(?!\w)',
            r'White\s*Honey(?!\w)',
            r'Fully\s*Washed(?!\w)',
            r'Semi\s*Natural(?!\w)',
            
            # 한국어만
            r'워시드(?!\w)',
            r'내추럴(?!\w)',
            r'허니(?!\w)',
            r'펄프드\s*내추럴(?!\w)',
            r'세미\s*워시드(?!\w)',
            r'웻\s*헐드(?!\w)',
            r'아나에로빅(?!\w)',
            r'카보닉\s*마세레이션(?!\w)',
            r'더블\s*퍼멘테이션(?!\w)',
            r'블랙\s*허니(?!\w)',
            r'레드\s*허니(?!\w)',
            r'옐로우\s*허니(?!\w)',
            r'화이트\s*허니(?!\w)',
            r'워터\s*프로세스(?!\w)',
            r'건식\s*가공(?!\w)',
            r'습식\s*가공(?!\w)',
            r'반건식\s*가공(?!\w)',
            r'물\s*세척(?!\w)',
            
            # 패턴으로 찾기
            r'(?:가공방식|Processing|Process|Method)[:：\s]*([^\n\r,]+)',
            r'([가-힣A-Za-z\s]+)(?:\s+프로세스|\s+가공|\s+방식)'
        ]
        
        # 원산지 추출
        for pattern in origin_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                if match.groups():
                    origin = match.group(1).strip()
                else:
                    origin = match.group(0).strip()
                # 불필요한 단어들 제거
                origin = re.sub(r'(국가|Nation|Origin|원산지)[:：\s]*', '', origin).strip()
                if len(origin) > 1 and not origin.isdigit():
                    self.logger.info(f"원산지 추출: '{origin}' (패턴: {pattern})")
                    break
        
        # 가공방식 추출
        for pattern in process_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                if match.groups():
                    process = match.group(1).strip()
                else:
                    process = match.group(0).strip()
                # 불필요한 단어들 제거
                process = re.sub(r'(가공방식|Processing|Process|Method)[:：\s]*', '', process).strip()
                if len(process) > 1 and not process.isdigit():
                    self.logger.info(f"가공방식 추출: '{process}' (패턴: {pattern})")
                    break
        
        return origin, process

if __name__ == "__main__":
    import argparse
    import yaml
    from typing import Dict, Any, List, Optional
    from bs4 import BeautifulSoup
    from urllib.parse import urljoin, urlparse
    from coffee_crawler.crawlers.base_crawler import BaseCrawler
    from coffee_crawler.models.bean import Bean

    # 로깅 설정
    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    logger = logging.getLogger(__name__)

    # 커맨드 라인 인자 파싱
    parser = argparse.ArgumentParser(description='HTML 크롤러 테스트')
    parser.add_argument('--cafe', required=True, help='카페 ID')
    parser.add_argument('--test', action='store_true', help='테스트 모드')
    args = parser.parse_args()

    try:
        # 설정 파일 로드
        with open('config/crawler_config.yaml', 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)
        
        # 카페 설정 가져오기
        cafe_config = config['cafes'].get(args.cafe)
        if not cafe_config:
            logger.error(f"카페 설정을 찾을 수 없음: {args.cafe}")
            exit(1)

        # 크롤러 생성 및 실행
        crawler = HtmlCrawler(args.cafe, cafe_config)
        results = crawler._crawl_impl(test_mode=args.test)
        
        # 결과 출력
        logger.info(f"크롤링 결과: {len(results)}개 항목")
        for i, bean in enumerate(results, 1):
            logger.info(f"\n[{i}] {bean['name']}")
            logger.info(f"가격: {bean['price']}원")
            logger.info(f"URL: {bean['url']}")
            if 'origin' in bean:
                logger.info(f"원산지: {bean['origin']}")
            if 'processing' in bean:
                logger.info(f"가공방식: {bean['processing']}")
            if 'flavor_note' in bean:
                logger.info(f"향미: {', '.join(bean['flavor_note'])}")
            logger.info(f"전체 데이터: {bean}")

    except Exception as e:
        logger.error(f"크롤링 중 오류 발생: {e}", exc_info=True)
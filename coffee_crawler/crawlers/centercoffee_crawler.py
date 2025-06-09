"""
센터커피 크롤러 모듈

이 모듈은 센터커피 웹사이트에서 원두 정보를 크롤링하는 기능을 제공합니다.
"""

import logging
import requests
from bs4 import BeautifulSoup
from typing import Dict, List, Optional
from datetime import datetime
import re

from coffee_crawler.storage.bean_repository import get_repository
from coffee_crawler.utils.url_utils import make_absolute_url

# 로거 설정
logger = logging.getLogger(__name__)

class CenterCoffeeCrawler:
    """센터커피 크롤러 클래스"""
    
    def __init__(self):
        """크롤러 초기화"""
        self.base_url = "https://centercoffee.co.kr"
        self.repository = get_repository()
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    
    def crawl(self) -> List[Dict]:
        """
        원두 정보 크롤링 실행
        
        Returns:
            수집된 원두 정보 목록
        """
        try:
            # 1. 원두 목록 페이지에서 기본 정보 수집
            beans = self.get_bean_list()
            logger.info(f"원두 목록 {len(beans)}개 수집 완료")
            
            # 2. 각 원두의 상세 정보 수집
            for bean in beans:
                try:
                    detail = self.get_bean_detail(bean['detail_url'])
                    bean.update(detail)
                    logger.info(f"원두 상세 정보 수집 완료: {bean['name']}")
                except Exception as e:
                    logger.error(f"원두 상세 정보 수집 실패: {bean['name']} - {e}")
            
            # 3. Firebase에 저장
            self.repository.add_beans(beans)
            logger.info("원두 정보 저장 완료")
            
            return beans
        except Exception as e:
            logger.error(f"크롤링 실패: {e}")
            raise
    
    def get_bean_list(self) -> List[Dict]:
        """
        원두 목록 페이지에서 기본 정보 수집
        
        Returns:
            원두 기본 정보 목록
        """
        try:
            # 목록 페이지 URL
            url = f"{self.base_url}/67"
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            beans = []
            
            # 원두 상품 목록 찾기
            product_items = soup.select('.product-list .product-item')  # 실제 선택자로 수정
            
            for item in product_items:
                try:
                    # 기본 정보 추출
                    name = item.select_one('.product-name').text.strip()
                    price_text = item.select_one('.product-price').text.strip()
                    price = int(''.join(filter(str.isdigit, price_text)))
                    
                    # 이미지 URL 추출
                    img_tag = item.select_one('.product-image img')
                    image_url = img_tag['src'] if img_tag else None
                    
                    # 상세 페이지 URL 추출
                    link_tag = item.select_one('a.product-link')
                    detail_url = link_tag['href'] if link_tag else None
                    
                    if not all([name, price, image_url, detail_url]):
                        logger.warning(f"필수 정보 누락: {name}")
                        continue
                    
                    # 상대 URL을 절대 URL로 변환
                    image_url = make_absolute_url(self.base_url, image_url)
                    detail_url = make_absolute_url(self.base_url, detail_url)
                    
                    bean = {
                        'name': name,
                        'brand': '센터커피',
                        'price': price,
                        'image_url': image_url,
                        'detail_url': detail_url,
                        'active': True,
                        'createdAt': datetime.now().isoformat(),
                        'updatedAt': datetime.now().isoformat()
                    }
                    
                    beans.append(bean)
                except Exception as e:
                    logger.error(f"원두 정보 추출 실패: {e}")
                    continue
            
            return beans
        except Exception as e:
            logger.error(f"원두 목록 수집 실패: {e}")
            raise
    
    def get_bean_detail(self, url: str) -> Dict:
        """
        원두 상세 페이지에서 추가 정보 수집
        
        Args:
            url: 원두 상세 페이지 URL
            
        Returns:
            원두 상세 정보
        """
        try:
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            detail = {}
            
            # 상세 정보 추출
            # 원산지
            origin_text = soup.select_one('.product-info .origin').text.strip()
            detail['origin'] = re.search(r'원산지\s*:\s*(.+)', origin_text).group(1)
            
            # 가공 방식
            processing_text = soup.select_one('.product-info .processing').text.strip()
            detail['processing'] = re.search(r'가공방식\s*:\s*(.+)', processing_text).group(1)
            
            # 로스팅 레벨
            roast_text = soup.select_one('.product-info .roast-level').text.strip()
            detail['roast_level'] = re.search(r'로스팅\s*:\s*(.+)', roast_text).group(1)
            
            # 고도
            altitude_text = soup.select_one('.product-info .altitude').text.strip()
            detail['altitude'] = re.search(r'고도\s*:\s*(.+)', altitude_text).group(1)
            
            # 풍미 정보
            flavor_text = soup.select_one('.product-info .flavor').text.strip()
            flavors = [f.strip() for f in flavor_text.split(',')]
            detail['flavors'] = flavors
            
            # 무게 정보
            weight_text = soup.select_one('.product-info .weight').text.strip()
            weight = re.search(r'(\d+)g', weight_text)
            detail['weight_g'] = int(weight.group(1)) if weight else 200  # 기본값 200g
            
            # 상세 설명
            description = soup.select_one('.product-description').text.strip()
            detail['description'] = description
            
            return detail
        except Exception as e:
            logger.error(f"상세 정보 수집 실패: {url} - {e}")
            raise

# 테스트 코드
if __name__ == "__main__":
    # 로깅 설정
    logging.basicConfig(level=logging.INFO)
    
    # 크롤러 실행
    crawler = CenterCoffeeCrawler()
    beans = crawler.crawl()
    print(f"수집된 원두 수: {len(beans)}") 
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
카페 이미지 크롤러

카페 웹사이트에서 대표 이미지를 수집하는 크롤러
"""

import logging
import re
import requests
from typing import Dict, List, Any, Optional
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup

from coffee_crawler.crawlers.base_crawler import BaseCrawler
from coffee_crawler.models.cafe import Cafe

logger = logging.getLogger(__name__)

class CafeImageCrawler(BaseCrawler):
    """카페 이미지 전용 크롤러"""
    
    def __init__(self, cafe_id: str, config: Dict[str, Any]):
        super().__init__(cafe_id, config)
        
        # 이미지 검색 키워드 (카페별로 커스터마이즈 가능)
        self.image_keywords = config.get('image_keywords', [
            'store', 'shop', 'interior', 'cafe', 'coffee',
            '매장', '카페', '인테리어', '외관', '내부'
        ])
        
        # 이미지 품질 기준
        self.min_image_width = config.get('min_image_width', 400)
        self.min_image_height = config.get('min_image_height', 300)
        
        # 제외할 이미지 패턴
        self.exclude_patterns = [
            r'logo', r'icon', r'favicon', r'avatar',
            r'product', r'bean', r'coffee-bag',
            r'thumbnail', r'thumb'
        ]
    
    def crawl_cafe_images(self) -> Dict[str, Any]:
        """카페 이미지 크롤링 실행"""
        try:
            self.logger.info(f"카페 이미지 크롤링 시작: {self.cafe_id}")
            
            # 1. 카페 웹사이트에서 이미지 수집
            website_images = self._crawl_website_images()
            
            # 2. 소셜 미디어에서 이미지 수집 (Instagram, Facebook)
            social_images = self._crawl_social_images()
            
            # 3. Google Places에서 이미지 수집
            places_images = self._crawl_places_images()
            
            # 4. 최고 품질 이미지 선택
            best_image = self._select_best_image([
                *website_images,
                *social_images, 
                *places_images
            ])
            
            result = {
                'cafe_id': self.cafe_id,
                'image_url': best_image['url'] if best_image else None,
                'image_source': best_image['source'] if best_image else None,
                'total_found': len(website_images) + len(social_images) + len(places_images),
                'crawled_at': self._get_current_time()
            }
            
            self.logger.info(f"카페 이미지 크롤링 완료: {self.cafe_id}, 선택된 이미지: {result['image_url']}")
            return result
            
        except Exception as e:
            self.logger.error(f"카페 이미지 크롤링 실패: {self.cafe_id}, 에러: {str(e)}")
            return {
                'cafe_id': self.cafe_id,
                'image_url': None,
                'error': str(e),
                'crawled_at': self._get_current_time()
            }
    
    def _crawl_website_images(self) -> List[Dict[str, Any]]:
        """카페 웹사이트에서 이미지 수집"""
        images = []
        
        try:
            # 카페 메인 URL
            main_url = self.config.get('url')
            if not main_url:
                return images
            
            # 추가 URL들 (about, store, gallery 페이지)
            urls_to_check = [
                main_url,
                urljoin(main_url, '/about'),
                urljoin(main_url, '/store'),
                urljoin(main_url, '/gallery'),
                urljoin(main_url, '/location'),
                urljoin(main_url, '/매장소개'),
                urljoin(main_url, '/갤러리')
            ]
            
            for url in urls_to_check:
                try:
                    response = self.http_client.get(url)
                    if response.status_code == 200:
                        page_images = self._extract_images_from_page(url, response.text)
                        images.extend(page_images)
                except Exception as e:
                    self.logger.debug(f"URL 크롤링 실패: {url}, 에러: {str(e)}")
                    continue
            
            return self._filter_cafe_images(images)
            
        except Exception as e:
            self.logger.error(f"웹사이트 이미지 크롤링 실패: {str(e)}")
            return images
    
    def _extract_images_from_page(self, url: str, html: str) -> List[Dict[str, Any]]:
        """HTML 페이지에서 이미지 추출"""
        images = []
        
        try:
            soup = BeautifulSoup(html, 'html.parser')
            
            # img 태그에서 이미지 추출
            for img in soup.find_all('img'):
                src = img.get('src') or img.get('data-src') or img.get('data-lazy')
                if src:
                    # 상대 URL을 절대 URL로 변환
                    full_url = urljoin(url, src)
                    
                    # 이미지 메타데이터 수집
                    alt_text = img.get('alt', '')
                    title = img.get('title', '')
                    css_classes = ' '.join(img.get('class', []))
                    
                    images.append({
                        'url': full_url,
                        'alt': alt_text,
                        'title': title,
                        'classes': css_classes,
                        'source': 'website',
                        'page_url': url
                    })
            
            # CSS background-image에서 이미지 추출
            for element in soup.find_all(style=True):
                style = element.get('style', '')
                bg_images = re.findall(r'background-image:\s*url\(["\']?([^"\']+)["\']?\)', style)
                for bg_img in bg_images:
                    full_url = urljoin(url, bg_img)
                    images.append({
                        'url': full_url,
                        'alt': '',
                        'title': '',
                        'classes': ' '.join(element.get('class', [])),
                        'source': 'website_bg',
                        'page_url': url
                    })
            
            return images
            
        except Exception as e:
            self.logger.error(f"페이지 이미지 추출 실패: {url}, 에러: {str(e)}")
            return images
    
    def _filter_cafe_images(self, images: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """카페 관련 이미지만 필터링"""
        filtered_images = []
        
        for img in images:
            url = img['url'].lower()
            alt = img['alt'].lower()
            title = img['title'].lower()
            classes = img['classes'].lower()
            
            # 제외 패턴 체크
            skip = False
            for pattern in self.exclude_patterns:
                if re.search(pattern, url) or re.search(pattern, alt) or re.search(pattern, classes):
                    skip = True
                    break
            
            if skip:
                continue
            
            # 이미지 크기 체크 (가능한 경우)
            if self._is_valid_image_size(img['url']):
                # 카페 관련 키워드 점수 계산
                relevance_score = self._calculate_relevance_score(img)
                img['relevance_score'] = relevance_score
                
                if relevance_score > 0:
                    filtered_images.append(img)
        
        # 관련성 점수순으로 정렬
        filtered_images.sort(key=lambda x: x.get('relevance_score', 0), reverse=True)
        return filtered_images[:10]  # 상위 10개만 반환
    
    def _calculate_relevance_score(self, img: Dict[str, Any]) -> float:
        """이미지 관련성 점수 계산"""
        score = 0.0
        
        text_to_check = f"{img['url']} {img['alt']} {img['title']} {img['classes']}".lower()
        
        # 키워드 매칭
        for keyword in self.image_keywords:
            if keyword.lower() in text_to_check:
                score += 1.0
        
        # 파일명에 카페명이 포함되어 있으면 가산점
        cafe_name = self.config.get('label', '').lower()
        if cafe_name and cafe_name in text_to_check:
            score += 2.0
        
        # 이미지 크기에 따른 가산점 (큰 이미지 선호)
        if 'width' in img and 'height' in img:
            if img['width'] >= 800 and img['height'] >= 600:
                score += 1.5
            elif img['width'] >= 400 and img['height'] >= 300:
                score += 1.0
        
        return score
    
    def _is_valid_image_size(self, image_url: str) -> bool:
        """이미지 크기 유효성 검사"""
        try:
            response = requests.head(image_url, timeout=5)
            
            # Content-Type 체크
            content_type = response.headers.get('content-type', '')
            if not content_type.startswith('image/'):
                return False
            
            # Content-Length 체크 (너무 작은 이미지 제외)
            content_length = response.headers.get('content-length')
            if content_length and int(content_length) < 10000:  # 10KB 이하 제외
                return False
            
            return True
            
        except Exception:
            return True  # 확인할 수 없으면 일단 유효하다고 가정
    
    def _crawl_social_images(self) -> List[Dict[str, Any]]:
        """소셜 미디어에서 이미지 수집 (Instagram, Facebook 등)"""
        # Instagram Graph API나 Facebook Graph API 사용
        # 현재는 기본 구현만 제공
        return []
    
    def _crawl_places_images(self) -> List[Dict[str, Any]]:
        """Google Places API에서 이미지 수집"""
        # Google Places API 사용 필요
        # 현재는 기본 구현만 제공
        return []
    
    def _select_best_image(self, images: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """최고 품질 이미지 선택"""
        if not images:
            return None
        
        # 관련성 점수가 가장 높은 이미지 선택
        images.sort(key=lambda x: x.get('relevance_score', 0), reverse=True)
        return images[0]
    
    def _get_current_time(self) -> str:
        """현재 시간 반환"""
        from datetime import datetime
        return datetime.now().isoformat()
    
    # BaseCrawler의 추상 메서드 구현
    def _crawl_impl(self, test_mode: bool = False) -> List[Dict[str, Any]]:
        """기본 크롤링 인터페이스 (원두 대신 카페 이미지 반환)"""
        result = self.crawl_cafe_images()
        return [result] if result['image_url'] else []
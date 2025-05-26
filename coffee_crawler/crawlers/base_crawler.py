"""
크롤러 기본 클래스

이 모듈은 모든 크롤러가 상속받는 기본 클래스를 정의합니다.
"""

import os
import logging
import time
import traceback
from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime

from coffee_crawler.utils.logger import get_crawler_logger
from coffee_crawler.utils.http_client import HttpClient
from coffee_crawler.models.bean import Bean
from coffee_crawler.models.cafe import Cafe

class BaseCrawler(ABC):
    """크롤러 기본 추상 클래스"""
    
    def __init__(self, cafe_id: str, config: Dict[str, Any]):
        """
        BaseCrawler 초기화
        
        Args:
            cafe_id: 카페 ID
            config: 카페 설정 딕셔너리
        """
        self.cafe_id = cafe_id
        self.config = config
        self.logger = get_crawler_logger(cafe_id)
        
        # HTTP 클라이언트 초기화
        user_agent = config.get('user_agent', None)
        self.http_client = HttpClient(user_agent=user_agent)
        
        # 카페 정보 초기화
        self.cafe = Cafe.from_config(cafe_id, config)
        
        # 필터 설정
        self.include_keywords = config.get('include_keywords', [])
        self.exclude_keywords = config.get('exclude_keywords', [])
        
        # 카페별 필터 설정이 없는 경우 기본 필터 사용
        if not self.include_keywords or not self.exclude_keywords:
            from coffee_crawler.utils.config_loader import load_crawler_config
            crawler_config = load_crawler_config()
            filters = crawler_config.get('filters', {})
            
            if not self.include_keywords:
                self.include_keywords = filters.get('include_keywords', [])
            if not self.exclude_keywords:
                self.exclude_keywords = filters.get('exclude_keywords', [])
                
        # 재시도 설정
        self.max_retries = config.get('max_retries', 3)
        self.retry_delay = config.get('retry_delay', 2.0)
        
        # 테스트 모드 제한 수
        self.test_limit = config.get('test_limit', 3)
        
        self.logger.info(f"{self.cafe.name} 크롤러 초기화 완료")
        
    def crawl(self, test_mode: bool = False) -> List[Dict[str, Any]]:
        """
        원두 정보 크롤링 실행
        
        Args:
            test_mode: 테스트 모드 여부 (테스트 모드일 경우 제한된 개수만 수집)
            
        Returns:
            수집된 원두 정보 목록
        """
        self.logger.info(f"{self.cafe.name} 크롤링 시작...")
        start_time = time.time()
        
        try:
            # 실제 크롤링 수행 (자식 클래스에서 구현)
            results = self._crawl_impl(test_mode)
            
            # 결과 필터링
            filtered_results = self._filter_results(results)
            
            # 카페 ID 추가
            for item in filtered_results:
                if 'cafe_id' not in item:
                    item['cafe_id'] = self.cafe_id
            
            # 크롤링 완료 시간 기록
            self.cafe.last_crawled_at = datetime.now()
            
            # 결과 요약 로깅
            elapsed_time = time.time() - start_time
            self.logger.info(f"{self.cafe.name} 크롤링 완료: {len(filtered_results)}개 원두 정보 수집 (총 {len(results)}개 중), 소요시간: {elapsed_time:.2f}초")
            
            return filtered_results
            
        except Exception as e:
            elapsed_time = time.time() - start_time
            self.logger.error(
                f"{self.cafe.name} 크롤링 중 오류 발생: {e}\n"
                f"소요시간: {elapsed_time:.2f}초\n"
                f"스택 트레이스: {traceback.format_exc()}"
            )
            # 빈 결과 반환
            return []
        finally:
            # HTTP 클라이언트 세션 종료
            self.http_client.close()
    
    @abstractmethod
    def _crawl_impl(self, test_mode: bool = False) -> List[Dict[str, Any]]:
        """
        실제 크롤링 구현 (자식 클래스에서 구현해야 함)
        
        Args:
            test_mode: 테스트 모드 여부
            
        Returns:
            수집된 원두 정보 목록
        """
        pass
    
    def _filter_results(self, results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        수집된 결과 필터링
        
        Args:
            results: 원두 정보 목록
            
        Returns:
            필터링된 원두 정보 목록
        """
        if not results:
            self.logger.warning("필터링할 결과가 없습니다.")
            return []
            
        filtered = []
        excluded_count = 0
        
        for item in results:
            # 제품명이 없으면 건너뜀
            if 'name' not in item or not item['name']:
                self.logger.debug("제품명이 없는 항목 제외")
                excluded_count += 1
                continue
                
            # 키워드 기반 필터링
            if self._should_include(item):
                filtered.append(item)
            else:
                excluded_count += 1
                
        self.logger.info(f"필터링 결과: {len(filtered)}개 포함, {excluded_count}개 제외")
        return filtered
    
    def _should_include(self, item: Dict[str, Any]) -> bool:
        """
        항목이 포함되어야 하는지 확인
        
        Args:
            item: 원두 정보 딕셔너리
            
        Returns:
            포함 여부
        """
        name = item.get('name', '').lower()
        description = item.get('description', '').lower()
        
        # 제외 키워드 확인
        for keyword in self.exclude_keywords:
            keyword_lower = keyword.lower()
            if keyword_lower in name or keyword_lower in description:
                self.logger.debug(f"제외 키워드 '{keyword}' 포함: {name}")
                return False
        
        # 포함 키워드 확인
        if self.include_keywords:
            for keyword in self.include_keywords:
                keyword_lower = keyword.lower()
                if keyword_lower in name or keyword_lower in description:
                    return True
            
            # 포함 키워드가 있는데 일치하는 것이 없으면 제외
            self.logger.debug(f"포함 키워드 없음: {name}")
            return False
        
        # 포함 키워드가 없으면 기본적으로 포함
        return True
    
    def _download_image(self, image_url: str, save_path: Optional[str] = None) -> Tuple[Optional[bytes], Optional[str]]:
        """
        이미지 다운로드
        
        Args:
            image_url: 이미지 URL
            save_path: 저장 경로 (None이면 저장하지 않고 바이트 데이터만 반환)
            
        Returns:
            (이미지 바이트 데이터, 저장된 파일 경로) 튜플
        """
        if not image_url:
            self.logger.warning("이미지 URL이 없습니다.")
            return None, None
            
        # URL 검증
        try:
            # URL 스키마가 없으면 기본 스키마 추가
            if not image_url.startswith(('http://', 'https://')):
                image_url = f"https:{image_url}" if image_url.startswith('//') else f"https://{image_url}"
                
            self.logger.debug(f"이미지 다운로드 시도: {image_url}")
            
            # 최대 재시도 횟수만큼 시도
            for attempt in range(1, self.max_retries + 1):
                try:
                    response, success = self.http_client.get(image_url)
                    
                    if not success or response.status_code != 200:
                        self.logger.warning(
                            f"이미지 다운로드 실패 (시도 {attempt}/{self.max_retries}): "
                            f"{image_url}, 상태 코드: {response.status_code}"
                        )
                        if attempt < self.max_retries:
                            time.sleep(self.retry_delay)
                            continue
                        return None, None
                    
                    image_data = response.content
                    
                    # 파일로 저장
                    if save_path:
                        os.makedirs(os.path.dirname(save_path), exist_ok=True)
                        with open(save_path, 'wb') as f:
                            f.write(image_data)
                        self.logger.debug(f"이미지 저장 완료: {save_path}")
                        return image_data, save_path
                    
                    return image_data, None
                    
                except Exception as e:
                    self.logger.error(
                        f"이미지 다운로드 중 오류 발생 (시도 {attempt}/{self.max_retries}): {e}"
                    )
                    if attempt < self.max_retries:
                        time.sleep(self.retry_delay)
                    else:
                        return None, None
                        
        except Exception as e:
            self.logger.error(f"이미지 URL 처리 중 오류 발생: {e}")
            return None, None
    
    def _extract_bean_info(self, title: str) -> Dict[str, Any]:
        """
        제목에서 원두 정보 추출
        
        Args:
            title: 원두 제목
            
        Returns:
            추출된 정보 딕셔너리 (origin, processing, variety 등)
        """
        info = {}
        title_lower = title.lower()
        
        # 원산지 추출
        origins = [
            "에티오피아", "ethiopia", "케냐", "kenya", "콜롬비아", "colombia", 
            "과테말라", "guatemala", "코스타리카", "costa rica", "브라질", "brazil",
            "인도네시아", "indonesia", "르완다", "rwanda", "부룬디", "burundi",
            "예멘", "yemen", "파나마", "panama", "엘살바도르", "el salvador",
            "니카라과", "nicaragua", "온두라스", "honduras", "탄자니아", "tanzania",
            "멕시코", "mexico"
        ]
        
        for origin in origins:
            if origin.lower() in title_lower:
                info['origin'] = origin.title()
                self.logger.debug(f"원산지 추출: {origin}")
                break
        
        # 가공방식 추출
        processes = [
            "워시드", "washed", "내추럴", "natural", "허니", "honey", 
            "펄프드", "pulped", "프로세스", "process", "수세식", "건조식",
            "anaerobic", "혐기성"
        ]
        
        for process in processes:
            if process.lower() in title_lower:
                info['processing'] = process.title()
                self.logger.debug(f"가공방식 추출: {process}")
                break
        
        # 품종 추출
        varieties = [
            "게이샤", "geisha", "게샤", "세투아이", "sl28", "sl-28",
            "티피카", "typica", "카투아이", "catuai", "버번", "bourbon",
            "시다모", "sidamo", "카투라", "caturra", "파카마라", "pacamara"
        ]
        
        for variety in varieties:
            if variety.lower() in title_lower:
                info['variety'] = variety.title()
                self.logger.debug(f"품종 추출: {variety}")
                break
                
        return info
        
    def _safe_request(self, url: str, method: str = 'get', **kwargs) -> Tuple[Optional[Any], bool]:
        """
        안전한 HTTP 요청 (재시도 로직 포함)
        
        Args:
            url: 요청 URL
            method: HTTP 메소드 ('get' 또는 'post')
            **kwargs: HTTP 클라이언트에 전달할 추가 인수
            
        Returns:
            (응답 객체, 성공 여부) 튜플
        """
        for attempt in range(1, self.max_retries + 1):
            try:
                self.logger.debug(f"{method.upper()} 요청 시도 ({attempt}/{self.max_retries}): {url}")
                
                if method.lower() == 'get':
                    response, success = self.http_client.get(url, **kwargs)
                elif method.lower() == 'post':
                    response, success = self.http_client.post(url, **kwargs)
                else:
                    self.logger.error(f"지원하지 않는 HTTP 메소드: {method}")
                    return None, False
                
                if not success or (response.status_code != 200 and response.status_code != 201):
                    self.logger.warning(
                        f"HTTP 요청 실패 (시도 {attempt}/{self.max_retries}): "
                        f"{url}, 상태 코드: {response.status_code}"
                    )
                    if attempt < self.max_retries:
                        time.sleep(self.retry_delay)
                        continue
                    return response, False
                
                return response, True
                
            except Exception as e:
                self.logger.error(
                    f"HTTP 요청 중 오류 발생 (시도 {attempt}/{self.max_retries}): {e}"
                )
                if attempt < self.max_retries:
                    time.sleep(self.retry_delay)
                else:
                    return None, False
        
        return None, False 
"""
HTTP 클라이언트 모듈

이 모듈은 HTTP 요청을 보내고 응답을 처리하는 기능을 제공합니다.
"""

import time
import logging
import requests
from typing import Dict, Any, Optional, Union, Tuple
from requests.exceptions import RequestException

from coffee_crawler.utils.config_loader import load_crawler_config

# 로거 설정
logger = logging.getLogger(__name__)

class HttpClient:
    """HTTP 요청 처리 클래스"""
    
    def __init__(self, user_agent: Optional[str] = None, timeout: int = 30, retry_count: int = 3, retry_delay: int = 5):
        """
        HttpClient 초기화
        
        Args:
            user_agent: User-Agent 헤더 값
            timeout: 요청 타임아웃 (초)
            retry_count: 재시도 횟수
            retry_delay: 재시도 간격 (초)
        """
        config = load_crawler_config()
        self.user_agent = user_agent or config.get('crawler', {}).get('user_agent', 'Coffee Bean Crawler/0.1.0')
        self.timeout = timeout or config.get('crawler', {}).get('request_timeout', 30)
        self.retry_count = retry_count or config.get('crawler', {}).get('retry_count', 3)
        self.retry_delay = retry_delay or config.get('crawler', {}).get('retry_delay', 5)
        
        # 기본 세션 생성
        self.session = requests.Session()
        self.session.headers.update({'User-Agent': self.user_agent})
    
    def get(self, url: str, params: Optional[Dict[str, Any]] = None, headers: Optional[Dict[str, str]] = None) -> Tuple[requests.Response, bool]:
        """
        GET 요청 수행
        
        Args:
            url: 요청 URL
            params: 쿼리 파라미터
            headers: 추가 헤더
            
        Returns:
            (응답 객체, 성공 여부) 튜플
        """
        return self._request_with_retry('GET', url, params=params, headers=headers)
    
    def post(self, url: str, data: Optional[Dict[str, Any]] = None, json: Optional[Dict[str, Any]] = None, 
             headers: Optional[Dict[str, str]] = None) -> Tuple[requests.Response, bool]:
        """
        POST 요청 수행
        
        Args:
            url: 요청 URL
            data: 폼 데이터
            json: JSON 데이터
            headers: 추가 헤더
            
        Returns:
            (응답 객체, 성공 여부) 튜플
        """
        return self._request_with_retry('POST', url, data=data, json=json, headers=headers)
    
    def _request_with_retry(self, method: str, url: str, **kwargs) -> Tuple[requests.Response, bool]:
        """
        재시도 로직이 포함된 HTTP 요청 처리
        
        Args:
            method: HTTP 메소드
            url: 요청 URL
            **kwargs: requests 라이브러리에 전달할 추가 인자
            
        Returns:
            (응답 객체, 성공 여부) 튜플
        """
        # 타임아웃 설정
        if 'timeout' not in kwargs:
            kwargs['timeout'] = self.timeout
        
        # 헤더 설정
        headers = kwargs.get('headers', {})
        if headers:
            # 기존 헤더와 병합
            merged_headers = self.session.headers.copy()
            merged_headers.update(headers)
            kwargs['headers'] = merged_headers
        
        # 최대 재시도 횟수만큼 시도
        for attempt in range(self.retry_count + 1):
            try:
                logger.debug(f"{method} 요청: {url}")
                response = self.session.request(method, url, **kwargs)
                
                # 성공적인 응답인지 확인
                response.raise_for_status()
                return response, True
                
            except RequestException as e:
                logger.warning(f"요청 실패 ({attempt+1}/{self.retry_count+1}): {url}, 오류: {e}")
                
                # 마지막 시도인 경우
                if attempt == self.retry_count:
                    logger.error(f"최대 재시도 횟수 초과: {url}")
                    # 응답이 있는 경우 반환
                    if 'response' in locals():
                        return response, False
                    # 응답이 없는 경우 예외 발생
                    raise
                
                # 일시적인 오류로 간주하고 대기 후 재시도
                time.sleep(self.retry_delay)
    
    def close(self) -> None:
        """세션 종료"""
        self.session.close()
        logger.debug("HTTP 세션 종료")

# 싱글톤 인스턴스
_http_client = None

def get_http_client() -> HttpClient:
    """
    HttpClient 싱글톤 인스턴스 반환
    
    Returns:
        HttpClient 인스턴스
    """
    global _http_client
    if _http_client is None:
        _http_client = HttpClient()
    return _http_client

# 편의 함수
def get(url: str, params: Optional[Dict[str, Any]] = None, headers: Optional[Dict[str, str]] = None) -> Tuple[requests.Response, bool]:
    """
    GET 요청 수행
    
    Args:
        url: 요청 URL
        params: 쿼리 파라미터
        headers: 추가 헤더
        
    Returns:
        (응답 객체, 성공 여부) 튜플
    """
    return get_http_client().get(url, params, headers)

def post(url: str, data: Optional[Dict[str, Any]] = None, json: Optional[Dict[str, Any]] = None, 
         headers: Optional[Dict[str, str]] = None) -> Tuple[requests.Response, bool]:
    """
    POST 요청 수행
    
    Args:
        url: 요청 URL
        data: 폼 데이터
        json: JSON 데이터
        headers: 추가 헤더
        
    Returns:
        (응답 객체, 성공 여부) 튜플
    """
    return get_http_client().post(url, data, json, headers) 
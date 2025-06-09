"""
URL 관련 유틸리티 함수 모듈
"""

from urllib.parse import urljoin

def make_absolute_url(base_url: str, relative_url: str) -> str:
    """
    상대 URL을 절대 URL로 변환
    
    Args:
        base_url: 기본 URL
        relative_url: 상대 URL
        
    Returns:
        절대 URL
    """
    if not relative_url:
        return None
    return urljoin(base_url, relative_url) 
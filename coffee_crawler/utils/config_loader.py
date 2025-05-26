"""
설정 로더 모듈

이 모듈은 YAML 설정 파일을 로드하고 관리하는 기능을 제공합니다.
"""

import os
import yaml
import logging
from typing import Dict, Any, Optional

# 로거 설정
logger = logging.getLogger(__name__)

class ConfigLoader:
    """설정 파일 로더 클래스"""
    
    def __init__(self, config_dir: str = "config"):
        """
        ConfigLoader 초기화
        
        Args:
            config_dir: 설정 파일 디렉토리
        """
        self.config_dir = config_dir
        self.config_cache = {}
    
    def load_config(self, config_name: str, force_reload: bool = False) -> Dict[str, Any]:
        """
        설정 파일 로드
        
        Args:
            config_name: 설정 파일 이름 (확장자 제외)
            force_reload: 캐시된 설정을 무시하고 강제로 다시 로드할지 여부
            
        Returns:
            설정 딕셔너리
        """
        # 이미 로드된 설정이 있고 강제 리로드가 아니면 캐시에서 반환
        if config_name in self.config_cache and not force_reload:
            return self.config_cache[config_name]
        
        # 환경별 설정 파일 경로 (prod, local, 기본)
        env = os.environ.get('COFFEE_CRAWLER_ENV', 'dev')
        
        file_paths = [
            f"{self.config_dir}/{config_name}_{env}.yaml",  # 환경별 설정
            f"{self.config_dir}/{config_name}_local.yaml",  # 로컬 설정
            f"{self.config_dir}/{config_name}.yaml"         # 기본 설정
        ]
        
        config_data = {}
        
        for file_path in file_paths:
            if os.path.exists(file_path):
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        data = yaml.safe_load(f)
                        if data:
                            # 기존 설정에 업데이트 (깊은 병합 아님)
                            config_data.update(data)
                    
                    logger.debug(f"설정 파일 로드: {file_path}")
                except Exception as e:
                    logger.error(f"설정 파일 로드 실패: {file_path}, 오류: {e}")
        
        if not config_data:
            logger.warning(f"사용 가능한 설정 파일을 찾을 수 없음: {config_name}")
        
        # 캐시에 저장
        self.config_cache[config_name] = config_data
        return config_data
    
    def get_crawler_config(self) -> Dict[str, Any]:
        """
        크롤러 설정 로드
        
        Returns:
            크롤러 설정 딕셔너리
        """
        return self.load_config('crawler_config')
    
    def get_firebase_config(self) -> Dict[str, Any]:
        """
        Firebase 설정 로드
        
        Returns:
            Firebase 설정 딕셔너리
        """
        return self.load_config('firebase_config')
    
    def clear_cache(self) -> None:
        """설정 캐시 초기화"""
        self.config_cache.clear()
        logger.debug("설정 캐시 초기화 완료")

# 싱글톤 인스턴스
_config_loader = None

def get_config_loader() -> ConfigLoader:
    """
    ConfigLoader 싱글톤 인스턴스 반환
    
    Returns:
        ConfigLoader 인스턴스
    """
    global _config_loader
    if _config_loader is None:
        _config_loader = ConfigLoader()
    return _config_loader

# 편의 함수
def load_crawler_config() -> Dict[str, Any]:
    """
    크롤러 설정 로드
    
    Returns:
        크롤러 설정 딕셔너리
    """
    return get_config_loader().get_crawler_config()

def load_firebase_config() -> Dict[str, Any]:
    """
    Firebase 설정 로드
    
    Returns:
        Firebase 설정 딕셔너리
    """
    return get_config_loader().get_firebase_config() 
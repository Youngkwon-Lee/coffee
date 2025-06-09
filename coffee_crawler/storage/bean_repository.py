"""
원두 데이터 저장소 모듈

이 모듈은 원두 데이터를 Firebase Firestore에 저장하고 관리하는 기능을 제공합니다.
"""

import logging
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime

from coffee_crawler.storage.firebase_client import FirebaseClient
from coffee_crawler.processors.bean_mapper import to_firestore, merge_with_existing

# 로거 설정
logger = logging.getLogger(__name__)

class BeanRepository:
    """원두 데이터 저장소 클래스"""
    
    def __init__(self, config_path: str = "config/firebase_config.yaml"):
        """
        BeanRepository 초기화
        
        Args:
            config_path: Firebase 설정 파일 경로
        """
        self.firebase_client = FirebaseClient(config_path)
        logger.info("원두 저장소 초기화 완료")
    
    def add_bean(self, bean_data: Dict[str, Any], user_id: str = "system") -> str:
        """
        새 원두 정보 추가
        
        Args:
            bean_data: 원두 데이터 딕셔너리
            user_id: 작업을 수행하는 사용자 ID
            
        Returns:
            추가된 원두 ID
        """
        try:
            # 데이터를 Firestore 형식으로 변환
            firestore_data = to_firestore(bean_data, user_id)
            
            # ID가 없으면 저장할 수 없음
            if 'id' not in firestore_data or not firestore_data['id']:
                raise ValueError("원두 ID가 없습니다")
            
            # 중복 확인
            existing_bean = self.firebase_client.get_bean(firestore_data['id'])
            
            # 기존 데이터가 있으면 업데이트, 없으면 추가
            if existing_bean:
                self.update_bean(firestore_data['id'], bean_data, user_id)
                logger.info(f"기존 원두 업데이트: {firestore_data['id']}")
            else:
                self.firebase_client.add_bean(firestore_data)
                logger.info(f"새 원두 추가: {firestore_data['id']}")
            
            return firestore_data['id']
        except Exception as e:
            logger.error(f"원두 추가 실패: {e}")
            raise
    
    def update_bean(self, bean_id: str, bean_data: Dict[str, Any], user_id: str = "system") -> None:
        """
        원두 정보 업데이트
        
        Args:
            bean_id: 원두 ID
            bean_data: 업데이트할 원두 데이터
            user_id: 작업을 수행하는 사용자 ID
        """
        try:
            # 기존 데이터 조회
            existing_bean = self.firebase_client.get_bean(bean_id)
            
            if not existing_bean:
                raise ValueError(f"ID가 {bean_id}인 원두를 찾을 수 없습니다")
            
            # 기존 데이터와 병합
            merged_data = merge_with_existing(bean_data, existing_bean, user_id)
            
            # ID 확인
            if merged_data['id'] != bean_id:
                raise ValueError(f"병합된 데이터의 ID({merged_data['id']})가 원본 ID({bean_id})와 다릅니다")
            
            # 업데이트
            self.firebase_client.update_bean(bean_id, merged_data)
            logger.info(f"원두 업데이트 완료: {bean_id}")
        except Exception as e:
            logger.error(f"원두 업데이트 실패: {e}")
            raise
    
    def deactivate_bean(self, bean_id: str, user_id: str = "system") -> None:
        """
        원두 비활성화 (active = False)
        
        Args:
            bean_id: 원두 ID
            user_id: 작업을 수행하는 사용자 ID
        """
        try:
            # 기존 데이터 조회
            existing_bean = self.firebase_client.get_bean(bean_id)
            
            if not existing_bean:
                raise ValueError(f"ID가 {bean_id}인 원두를 찾을 수 없습니다")
            
            # 이미 비활성화되어 있으면 건너뜀
            if not existing_bean.get('active', True):
                logger.info(f"원두가 이미 비활성화되어 있음: {bean_id}")
                return
            
            # 비활성화 및 업데이트 정보 추가
            update_data = {
                'active': False,
                'updatedAt': datetime.now().isoformat(),
                'updatedBy': user_id
            }
            
            # 업데이트
            self.firebase_client.update_bean(bean_id, update_data)
            logger.info(f"원두 비활성화 완료: {bean_id}")
        except Exception as e:
            logger.error(f"원두 비활성화 실패: {e}")
            raise
    
    def get_bean(self, bean_id: str) -> Optional[Dict[str, Any]]:
        """
        원두 정보 조회
        
        Args:
            bean_id: 원두 ID
            
        Returns:
            원두 정보 딕셔너리
        """
        try:
            return self.firebase_client.get_bean(bean_id)
        except Exception as e:
            logger.error(f"원두 조회 실패: {e}")
            raise
    
    def get_all_beans(self, active_only: bool = True) -> List[Dict[str, Any]]:
        """
        모든 원두 정보 조회
        
        Args:
            active_only: 활성화된 원두만 조회할지 여부
            
        Returns:
            원두 정보 목록
        """
        try:
            filter_dict = None
            if active_only:
                filter_dict = {'active': True}
            
            return self.firebase_client.get_beans(filter_dict)
        except Exception as e:
            logger.error(f"전체 원두 조회 실패: {e}")
            raise
    
    def restore_bean(self, bean_id: str, user_id: str = "system") -> None:
        """
        비활성화된 원두 복원 (active = True)
        
        Args:
            bean_id: 원두 ID
            user_id: 작업을 수행하는 사용자 ID
        """
        try:
            # 기존 데이터 조회
            existing_bean = self.firebase_client.get_bean(bean_id)
            
            if not existing_bean:
                raise ValueError(f"ID가 {bean_id}인 원두를 찾을 수 없습니다")
            
            # 이미 활성화되어 있으면 건너뜀
            if existing_bean.get('active', False):
                logger.info(f"원두가 이미 활성화되어 있음: {bean_id}")
                return
            
            # 활성화 및 업데이트 정보 추가
            update_data = {
                'active': True,
                'updatedAt': datetime.now().isoformat(),
                'updatedBy': user_id
            }
            
            # 업데이트
            self.firebase_client.update_bean(bean_id, update_data)
            logger.info(f"원두 복원 완료: {bean_id}")
        except Exception as e:
            logger.error(f"원두 복원 실패: {e}")
            raise
    
    def add_beans(self, beans_data: List[Dict[str, Any]], user_id: str = "system") -> List[str]:
        """
        여러 원두 정보 일괄 추가
        
        Args:
            beans_data: 원두 데이터 목록
            user_id: 작업을 수행하는 사용자 ID
            
        Returns:
            추가된 원두 ID 목록
        """
        bean_ids = []
        for bean_data in beans_data:
            try:
                bean_id = self.add_bean(bean_data, user_id)
                bean_ids.append(bean_id)
            except Exception as e:
                logger.error(f"원두 추가 실패 (일괄 처리 중): {e}")
                # 개별 실패는 무시하고 계속 진행
        
        return bean_ids
    
    def add_crawl_log(self, log_data: Dict[str, Any]) -> None:
        """
        크롤링 로그 추가
        
        Args:
            log_data: 로그 데이터
        """
        try:
            self.firebase_client.add_crawl_log(log_data)
        except Exception as e:
            logger.error(f"크롤링 로그 추가 실패: {e}")
            # 로그 추가 실패는 크리티컬하지 않으므로 예외를 다시 발생시키지 않음
            pass

# 글로벌 저장소 인스턴스
_repository = None

def get_repository(config_path: str = "config/firebase_config.yaml") -> BeanRepository:
    """
    저장소 인스턴스 반환
    
    Args:
        config_path: Firebase 설정 파일 경로
        
    Returns:
        BeanRepository 인스턴스
    """
    global _repository
    if _repository is None:
        _repository = BeanRepository(config_path)
    return _repository

def add_bean(bean_data: Dict[str, Any], user_id: str = "system") -> str:
    """
    새 원두 정보 추가 함수
    
    Args:
        bean_data: 원두 데이터
        user_id: 작업을 수행하는 사용자 ID
        
    Returns:
        추가된 원두 ID
    """
    repository = get_repository()
    return repository.add_bean(bean_data, user_id)

def update_bean(bean_id: str, bean_data: Dict[str, Any], user_id: str = "system") -> None:
    """
    원두 정보 업데이트 함수
    
    Args:
        bean_id: 원두 ID
        bean_data: 업데이트할 원두 데이터
        user_id: 작업을 수행하는 사용자 ID
    """
    repository = get_repository()
    repository.update_bean(bean_id, bean_data, user_id)

def deactivate_bean(bean_id: str, user_id: str = "system") -> None:
    """
    원두 비활성화 함수
    
    Args:
        bean_id: 원두 ID
        user_id: 작업을 수행하는 사용자 ID
    """
    repository = get_repository()
    repository.deactivate_bean(bean_id, user_id)

def restore_bean(bean_id: str, user_id: str = "system") -> None:
    """
    원두 복원 함수
    
    Args:
        bean_id: 원두 ID
        user_id: 작업을 수행하는 사용자 ID
    """
    repository = get_repository()
    repository.restore_bean(bean_id, user_id)

def get_bean(bean_id: str) -> Optional[Dict[str, Any]]:
    """
    원두 정보 조회 함수
    
    Args:
        bean_id: 원두 ID
        
    Returns:
        원두 정보 딕셔너리
    """
    repository = get_repository()
    return repository.get_bean(bean_id)

def get_all_beans(active_only: bool = True) -> List[Dict[str, Any]]:
    """
    모든 원두 정보 조회 함수
    
    Args:
        active_only: 활성화된 원두만 조회할지 여부
        
    Returns:
        원두 정보 목록
    """
    repository = get_repository()
    return repository.get_all_beans(active_only)

def add_beans(beans_data: List[Dict[str, Any]], user_id: str = "system") -> List[str]:
    """
    여러 원두 정보 일괄 추가 함수
    
    Args:
        beans_data: 원두 데이터 목록
        user_id: 작업을 수행하는 사용자 ID
        
    Returns:
        추가된 원두 ID 목록
    """
    repository = get_repository()
    return repository.add_beans(beans_data, user_id)

def add_crawl_log(log_data: Dict[str, Any]) -> None:
    """
    크롤링 로그 추가 함수
    
    Args:
        log_data: 로그 데이터
    """
    repository = get_repository()
    repository.add_crawl_log(log_data) 
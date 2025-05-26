"""
원두 변경 감지 모듈

이 모듈은 수집된 원두 데이터와 기존 데이터베이스의 원두 데이터를 비교하여
신규, 수정, 삭제, 복원 상태를 감지하는 기능을 제공합니다.
"""

import logging
import hashlib
import json
from typing import Dict, Any, List, Tuple, Set
from datetime import datetime

# 로거 설정
logger = logging.getLogger(__name__)

# 변경 유형 정의
CHANGE_TYPE_NEW = 'new'        # 신규 원두
CHANGE_TYPE_UPDATED = 'updated'  # 정보 수정
CHANGE_TYPE_DELETED = 'deleted'  # 판매 중단
CHANGE_TYPE_RESTORED = 'restored'  # 판매 재개
CHANGE_TYPE_UNCHANGED = 'unchanged'  # 변경 없음

class BeanChangeDetector:
    """원두 변경 감지 클래스"""
    
    def __init__(self):
        """BeanChangeDetector 초기화"""
        pass
    
    def compute_content_hash(self, bean: Dict[str, Any]) -> str:
        """
        원두 콘텐츠 해시 계산
        
        Args:
            bean: 원두 데이터
            
        Returns:
            해시 문자열
        """
        # 메타데이터를 제외한 콘텐츠만 추출
        content = {
            'name': bean.get('name', ''),
            'brand': bean.get('brand', ''),
            'price': bean.get('price', 0),
            'origin': bean.get('origin', ''),
            'weight_g': bean.get('weight_g', 0),
            'roast_level': bean.get('roast_level', ''),
            'flavors': sorted(bean.get('flavors', [])) if isinstance(bean.get('flavors'), list) else bean.get('flavors', ''),
            'processing': bean.get('processing', ''),
            'variety': bean.get('variety', ''),
            'description': bean.get('description', '')
        }
        
        # None 값 필드 제거
        content = {k: v for k, v in content.items() if v is not None}
        
        # 해시 계산
        content_str = json.dumps(content, sort_keys=True, ensure_ascii=False)
        return hashlib.md5(content_str.encode('utf-8')).hexdigest()
    
    def detect_changes(self, new_beans: List[Dict[str, Any]], existing_beans: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """
        원두 변경 감지
        
        Args:
            new_beans: 새로 수집된 원두 데이터 목록
            existing_beans: 기존 데이터베이스의 원두 데이터 목록
            
        Returns:
            변경 유형별 원두 목록
        """
        # 결과 초기화
        changes = {
            CHANGE_TYPE_NEW: [],        # 신규 원두
            CHANGE_TYPE_UPDATED: [],    # 정보 수정
            CHANGE_TYPE_DELETED: [],    # 판매 중단
            CHANGE_TYPE_RESTORED: [],   # 판매 재개
            CHANGE_TYPE_UNCHANGED: []   # 변경 없음
        }
        
        # 기존 원두 딕셔너리 생성 (ID -> 원두 데이터)
        existing_beans_dict = {bean.get('id'): bean for bean in existing_beans if bean.get('id')}
        
        # 현재 크롤링된 원두 ID 집합
        new_bean_ids = {bean.get('id') for bean in new_beans if bean.get('id')}
        
        # 새로 수집된 원두 처리
        for new_bean in new_beans:
            # ID가 없으면 건너뜀
            if not new_bean.get('id'):
                logger.warning(f"ID가 없는 원두: {new_bean.get('name')}")
                continue
            
            bean_id = new_bean['id']
            
            # 해시 계산
            content_hash = self.compute_content_hash(new_bean)
            new_bean['hash'] = content_hash
            
            # 현재 시간
            now = datetime.now().isoformat()
            
            # 기존 원두 확인
            if bean_id in existing_beans_dict:
                existing_bean = existing_beans_dict[bean_id]
                
                # 활성 상태 확인
                is_active = existing_bean.get('isActive', True)
                
                # 해시 비교
                existing_hash = existing_bean.get('hash', '')
                
                if content_hash != existing_hash:
                    # 해시가 다르면 정보가 수정된 것
                    new_bean['lastUpdated'] = now
                    
                    # 비활성 상태였으면 복원, 그렇지 않으면 수정
                    if not is_active:
                        new_bean['isActive'] = True
                        changes[CHANGE_TYPE_RESTORED].append(new_bean)
                    else:
                        new_bean['isActive'] = True
                        changes[CHANGE_TYPE_UPDATED].append(new_bean)
                else:
                    # 해시가 같으면 변경 없음
                    new_bean['lastUpdated'] = existing_bean.get('lastUpdated', now)
                    new_bean['isActive'] = True
                    changes[CHANGE_TYPE_UNCHANGED].append(new_bean)
            else:
                # 새로운 원두
                new_bean['createdAt'] = now
                new_bean['lastUpdated'] = now
                new_bean['isActive'] = True
                changes[CHANGE_TYPE_NEW].append(new_bean)
        
        # 삭제된 원두 처리 (기존에 있었지만 새로 수집되지 않은 원두)
        for bean_id, existing_bean in existing_beans_dict.items():
            if bean_id not in new_bean_ids:
                # 이미 비활성 상태이면 변경 없음
                if not existing_bean.get('isActive', True):
                    changes[CHANGE_TYPE_UNCHANGED].append(existing_bean)
                else:
                    # 비활성 상태로 변경
                    existing_bean['isActive'] = False
                    existing_bean['lastUpdated'] = datetime.now().isoformat()
                    changes[CHANGE_TYPE_DELETED].append(existing_bean)
        
        return changes
    
    def get_all_beans(self, changes: Dict[str, List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
        """
        모든 변경된 원두 목록 반환
        
        Args:
            changes: 변경 감지 결과
            
        Returns:
            모든 원두 목록
        """
        all_beans = []
        all_beans.extend(changes[CHANGE_TYPE_NEW])
        all_beans.extend(changes[CHANGE_TYPE_UPDATED])
        all_beans.extend(changes[CHANGE_TYPE_RESTORED])
        all_beans.extend(changes[CHANGE_TYPE_UNCHANGED])
        all_beans.extend(changes[CHANGE_TYPE_DELETED])
        return all_beans
    
    def get_summary(self, changes: Dict[str, List[Dict[str, Any]]]) -> Dict[str, int]:
        """
        변경 감지 결과 요약
        
        Args:
            changes: 변경 감지 결과
            
        Returns:
            변경 유형별 개수
        """
        return {change_type: len(beans) for change_type, beans in changes.items()}

# 글로벌 변경 감지기 인스턴스
_change_detector = None

def get_change_detector() -> BeanChangeDetector:
    """
    변경 감지기 인스턴스 반환
    
    Returns:
        BeanChangeDetector 인스턴스
    """
    global _change_detector
    if _change_detector is None:
        _change_detector = BeanChangeDetector()
    return _change_detector

def detect_changes(new_beans: List[Dict[str, Any]], existing_beans: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """
    원두 변경 감지 함수
    
    Args:
        new_beans: 새로 수집된 원두 데이터 목록
        existing_beans: 기존 데이터베이스의 원두 데이터 목록
        
    Returns:
        변경 유형별 원두 목록
    """
    detector = get_change_detector()
    return detector.detect_changes(new_beans, existing_beans)

def get_summary(changes: Dict[str, List[Dict[str, Any]]]) -> Dict[str, int]:
    """
    변경 감지 결과 요약 함수
    
    Args:
        changes: 변경 감지 결과
        
    Returns:
        변경 유형별 개수
    """
    detector = get_change_detector()
    return detector.get_summary(changes)

def get_all_beans(changes: Dict[str, List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    """
    모든 변경된 원두 목록 반환 함수
    
    Args:
        changes: 변경 감지 결과
        
    Returns:
        모든 원두 목록
    """
    detector = get_change_detector()
    return detector.get_all_beans(changes) 
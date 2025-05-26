"""
일괄 처리 트랜잭션 모듈

이 모듈은 여러 원두 데이터 변경사항을 Firebase Firestore에 일괄적으로 적용하는 기능을 제공합니다.
트랜잭션을 사용하여 원자적 업데이트를 보장합니다.
"""

import logging
from typing import Dict, List, Any, Optional, Tuple, Set
from datetime import datetime

import firebase_admin
from firebase_admin import firestore

from coffee_crawler.storage.firebase_client import FirebaseClient
from coffee_crawler.processors.bean_mapper import to_firestore, merge_with_existing
from coffee_crawler.processors.change_detector import CHANGE_TYPE_NEW, CHANGE_TYPE_UPDATED, CHANGE_TYPE_DELETED, CHANGE_TYPE_RESTORED, CHANGE_TYPE_UNCHANGED

# 로거 설정
logger = logging.getLogger(__name__)

class BatchProcessor:
    """원두 데이터 일괄 처리 클래스"""
    
    def __init__(self, config_path: str = "config/firebase_config.yaml"):
        """
        BatchProcessor 초기화
        
        Args:
            config_path: Firebase 설정 파일 경로
        """
        self.firebase_client = FirebaseClient(config_path)
        self.db = self.firebase_client.db
        self.config = self.firebase_client.config
        logger.info("일괄 처리 프로세서 초기화 완료")
    
    def process_changes(self, changes: Dict[str, List[Dict[str, Any]]], user_id: str = "system") -> Dict[str, int]:
        """
        변경사항 일괄 처리
        
        Args:
            changes: 변경 유형별 원두 목록
            user_id: 작업을 수행하는 사용자 ID
            
        Returns:
            처리 결과 통계
        """
        # 컬렉션 정보 가져오기
        collection = self.config['firebase']['firestore']['collection_beans']
        
        # 배치 생성
        batch = self.db.batch()
        
        # 처리 통계
        stats = {
            'new': 0,
            'updated': 0,
            'deleted': 0,
            'restored': 0,
            'unchanged': 0,
            'error': 0
        }
        
        try:
            # 신규 원두 추가
            for bean in changes.get(CHANGE_TYPE_NEW, []):
                try:
                    # Firestore 형식으로 변환
                    firestore_data = to_firestore(bean, user_id)
                    
                    # ID 확인
                    if 'id' not in firestore_data or not firestore_data['id']:
                        logger.warning("ID가 없는 원두 건너뜀")
                        stats['error'] += 1
                        continue
                    
                    # 문서 참조 생성
                    doc_ref = self.db.collection(collection).document(firestore_data['id'])
                    
                    # 배치에 추가
                    batch.set(doc_ref, firestore_data)
                    stats['new'] += 1
                except Exception as e:
                    logger.error(f"신규 원두 처리 실패: {e}")
                    stats['error'] += 1
            
            # 업데이트된 원두 처리
            for bean in changes.get(CHANGE_TYPE_UPDATED, []):
                try:
                    # ID 확인
                    if 'id' not in bean or not bean['id']:
                        logger.warning("ID가 없는 원두 건너뜀")
                        stats['error'] += 1
                        continue
                    
                    # Firestore 형식으로 변환
                    firestore_data = to_firestore(bean, user_id)
                    
                    # 문서 참조 생성
                    doc_ref = self.db.collection(collection).document(bean['id'])
                    
                    # 배치에 추가
                    batch.update(doc_ref, firestore_data)
                    stats['updated'] += 1
                except Exception as e:
                    logger.error(f"업데이트 원두 처리 실패: {e}")
                    stats['error'] += 1
            
            # 복원된 원두 처리
            for bean in changes.get(CHANGE_TYPE_RESTORED, []):
                try:
                    # ID 확인
                    if 'id' not in bean or not bean['id']:
                        logger.warning("ID가 없는 원두 건너뜀")
                        stats['error'] += 1
                        continue
                    
                    # 문서 참조 생성
                    doc_ref = self.db.collection(collection).document(bean['id'])
                    
                    # 업데이트 데이터
                    update_data = {
                        'isActive': True,
                        'lastUpdated': firestore.SERVER_TIMESTAMP,
                        'lastUpdatedBy': user_id
                    }
                    
                    # 배치에 추가
                    batch.update(doc_ref, update_data)
                    stats['restored'] += 1
                except Exception as e:
                    logger.error(f"복원 원두 처리 실패: {e}")
                    stats['error'] += 1
            
            # 삭제된(비활성화) 원두 처리
            for bean in changes.get(CHANGE_TYPE_DELETED, []):
                try:
                    # ID 확인
                    if 'id' not in bean or not bean['id']:
                        logger.warning("ID가 없는 원두 건너뜀")
                        stats['error'] += 1
                        continue
                    
                    # 문서 참조 생성
                    doc_ref = self.db.collection(collection).document(bean['id'])
                    
                    # 업데이트 데이터 (완전 삭제가 아닌 비활성화)
                    update_data = {
                        'isActive': False,
                        'lastUpdated': firestore.SERVER_TIMESTAMP,
                        'lastUpdatedBy': user_id
                    }
                    
                    # 배치에 추가
                    batch.update(doc_ref, update_data)
                    stats['deleted'] += 1
                except Exception as e:
                    logger.error(f"삭제 원두 처리 실패: {e}")
                    stats['error'] += 1
            
            # 변경없는 원두는 처리하지 않음
            stats['unchanged'] = len(changes.get(CHANGE_TYPE_UNCHANGED, []))
            
            # 변경사항이 있는 경우만 커밋
            total_changes = stats['new'] + stats['updated'] + stats['deleted'] + stats['restored']
            if total_changes > 0:
                # 배치 커밋
                batch.commit()
                logger.info(f"일괄 처리 완료: 총 {total_changes}개 원두 처리됨")
            else:
                logger.info("변경사항 없음, 일괄 처리 건너뜀")
            
            return stats
        except Exception as e:
            logger.error(f"일괄 처리 실패: {e}")
            # 전체 에러로 처리
            stats['error'] = sum(len(beans) for beans in changes.values())
            stats['new'] = 0
            stats['updated'] = 0
            stats['deleted'] = 0
            stats['restored'] = 0
            return stats
    
    def safe_process_changes(self, changes: Dict[str, List[Dict[str, Any]]], user_id: str = "system") -> Dict[str, int]:
        """
        변경사항 안전 일괄 처리 (트랜잭션 사용)
        
        Args:
            changes: 변경 유형별 원두 목록
            user_id: 작업을 수행하는 사용자 ID
            
        Returns:
            처리 결과 통계
        """
        # 컬렉션 정보 가져오기
        collection = self.config['firebase']['firestore']['collection_beans']
        
        # 처리 통계
        stats = {
            'new': 0,
            'updated': 0,
            'deleted': 0,
            'restored': 0,
            'unchanged': 0,
            'error': 0
        }
        
        # 각 유형별로 개별 트랜잭션 실행
        # 전체를 한 트랜잭션으로 처리하면 작업량이 많을 때 시간 초과 가능성 있음
        
        # 1. 신규 원두 추가
        if changes.get(CHANGE_TYPE_NEW):
            try:
                # 배치 생성
                batch = self.db.batch()
                
                for bean in changes.get(CHANGE_TYPE_NEW, []):
                    try:
                        # Firestore 형식으로 변환
                        firestore_data = to_firestore(bean, user_id)
                        
                        # ID 확인
                        if 'id' not in firestore_data or not firestore_data['id']:
                            logger.warning("ID가 없는 원두 건너뜀")
                            stats['error'] += 1
                            continue
                        
                        # 문서 참조 생성
                        doc_ref = self.db.collection(collection).document(firestore_data['id'])
                        
                        # 배치에 추가
                        batch.set(doc_ref, firestore_data)
                        stats['new'] += 1
                    except Exception as e:
                        logger.error(f"신규 원두 처리 실패: {e}")
                        stats['error'] += 1
                
                # 배치 커밋
                if stats['new'] > 0:
                    batch.commit()
                    logger.info(f"신규 원두 처리 완료: {stats['new']}개")
            except Exception as e:
                logger.error(f"신규 원두 일괄 처리 실패: {e}")
                stats['error'] += len(changes.get(CHANGE_TYPE_NEW, []))
                stats['new'] = 0
        
        # 2. 업데이트된 원두 처리
        if changes.get(CHANGE_TYPE_UPDATED):
            try:
                # 배치 생성
                batch = self.db.batch()
                
                for bean in changes.get(CHANGE_TYPE_UPDATED, []):
                    try:
                        # ID 확인
                        if 'id' not in bean or not bean['id']:
                            logger.warning("ID가 없는 원두 건너뜀")
                            stats['error'] += 1
                            continue
                        
                        # Firestore 형식으로 변환
                        firestore_data = to_firestore(bean, user_id)
                        
                        # 문서 참조 생성
                        doc_ref = self.db.collection(collection).document(bean['id'])
                        
                        # 배치에 추가
                        batch.update(doc_ref, firestore_data)
                        stats['updated'] += 1
                    except Exception as e:
                        logger.error(f"업데이트 원두 처리 실패: {e}")
                        stats['error'] += 1
                
                # 배치 커밋
                if stats['updated'] > 0:
                    batch.commit()
                    logger.info(f"업데이트 원두 처리 완료: {stats['updated']}개")
            except Exception as e:
                logger.error(f"업데이트 원두 일괄 처리 실패: {e}")
                stats['error'] += len(changes.get(CHANGE_TYPE_UPDATED, []))
                stats['updated'] = 0
        
        # 3. 복원된 원두 처리
        if changes.get(CHANGE_TYPE_RESTORED):
            try:
                # 배치 생성
                batch = self.db.batch()
                
                for bean in changes.get(CHANGE_TYPE_RESTORED, []):
                    try:
                        # ID 확인
                        if 'id' not in bean or not bean['id']:
                            logger.warning("ID가 없는 원두 건너뜀")
                            stats['error'] += 1
                            continue
                        
                        # 문서 참조 생성
                        doc_ref = self.db.collection(collection).document(bean['id'])
                        
                        # 업데이트 데이터
                        update_data = {
                            'isActive': True,
                            'lastUpdated': firestore.SERVER_TIMESTAMP,
                            'lastUpdatedBy': user_id
                        }
                        
                        # 배치에 추가
                        batch.update(doc_ref, update_data)
                        stats['restored'] += 1
                    except Exception as e:
                        logger.error(f"복원 원두 처리 실패: {e}")
                        stats['error'] += 1
                
                # 배치 커밋
                if stats['restored'] > 0:
                    batch.commit()
                    logger.info(f"복원 원두 처리 완료: {stats['restored']}개")
            except Exception as e:
                logger.error(f"복원 원두 일괄 처리 실패: {e}")
                stats['error'] += len(changes.get(CHANGE_TYPE_RESTORED, []))
                stats['restored'] = 0
        
        # 4. 삭제된(비활성화) 원두 처리
        if changes.get(CHANGE_TYPE_DELETED):
            try:
                # 배치 생성
                batch = self.db.batch()
                
                for bean in changes.get(CHANGE_TYPE_DELETED, []):
                    try:
                        # ID 확인
                        if 'id' not in bean or not bean['id']:
                            logger.warning("ID가 없는 원두 건너뜀")
                            stats['error'] += 1
                            continue
                        
                        # 문서 참조 생성
                        doc_ref = self.db.collection(collection).document(bean['id'])
                        
                        # 업데이트 데이터 (완전 삭제가 아닌 비활성화)
                        update_data = {
                            'isActive': False,
                            'lastUpdated': firestore.SERVER_TIMESTAMP,
                            'lastUpdatedBy': user_id
                        }
                        
                        # 배치에 추가
                        batch.update(doc_ref, update_data)
                        stats['deleted'] += 1
                    except Exception as e:
                        logger.error(f"삭제 원두 처리 실패: {e}")
                        stats['error'] += 1
                
                # 배치 커밋
                if stats['deleted'] > 0:
                    batch.commit()
                    logger.info(f"삭제 원두 처리 완료: {stats['deleted']}개")
            except Exception as e:
                logger.error(f"삭제 원두 일괄 처리 실패: {e}")
                stats['error'] += len(changes.get(CHANGE_TYPE_DELETED, []))
                stats['deleted'] = 0
        
        # 변경없는 원두는 처리하지 않음
        stats['unchanged'] = len(changes.get(CHANGE_TYPE_UNCHANGED, []))
        
        # 처리 결과 반환
        total_changes = stats['new'] + stats['updated'] + stats['deleted'] + stats['restored']
        logger.info(f"안전 일괄 처리 완료: 총 {total_changes}개 원두 처리됨")
        
        return stats
    
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

# 글로벌 배치 프로세서 인스턴스
_batch_processor = None

def get_batch_processor(config_path: str = "config/firebase_config.yaml") -> BatchProcessor:
    """
    배치 프로세서 인스턴스 반환
    
    Args:
        config_path: Firebase 설정 파일 경로
        
    Returns:
        BatchProcessor 인스턴스
    """
    global _batch_processor
    if _batch_processor is None:
        _batch_processor = BatchProcessor(config_path)
    return _batch_processor

def process_changes(changes: Dict[str, List[Dict[str, Any]]], user_id: str = "system") -> Dict[str, int]:
    """
    변경사항 일괄 처리 함수
    
    Args:
        changes: 변경 유형별 원두 목록
        user_id: 작업을 수행하는 사용자 ID
        
    Returns:
        처리 결과 통계
    """
    processor = get_batch_processor()
    return processor.process_changes(changes, user_id)

def safe_process_changes(changes: Dict[str, List[Dict[str, Any]]], user_id: str = "system") -> Dict[str, int]:
    """
    변경사항 안전 일괄 처리 함수 (트랜잭션 사용)
    
    Args:
        changes: 변경 유형별 원두 목록
        user_id: 작업을 수행하는 사용자 ID
        
    Returns:
        처리 결과 통계
    """
    processor = get_batch_processor()
    return processor.safe_process_changes(changes, user_id)

def add_crawl_log(log_data: Dict[str, Any]) -> None:
    """
    크롤링 로그 추가 함수
    
    Args:
        log_data: 로그 데이터
    """
    processor = get_batch_processor()
    processor.add_crawl_log(log_data) 
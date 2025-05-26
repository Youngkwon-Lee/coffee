"""
일괄 처리 트랜잭션 테스트
"""

import pytest
import os
import sys
import json
from unittest.mock import patch, MagicMock, call
from datetime import datetime

# 프로젝트 루트 경로 추가
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from coffee_crawler.storage.batch_processor import BatchProcessor, process_changes, safe_process_changes
from coffee_crawler.processors.change_detector import CHANGE_TYPE_NEW, CHANGE_TYPE_UPDATED, CHANGE_TYPE_DELETED, CHANGE_TYPE_RESTORED, CHANGE_TYPE_UNCHANGED

# 테스트 데이터
TEST_BEANS = {
    CHANGE_TYPE_NEW: [
        {
            "id": "testcafe_new_bean",
            "name": "New Bean",
            "brand": "Test Cafe",
            "price": 18000,
            "origin": "Ethiopia",
            "weight_g": 200
        }
    ],
    CHANGE_TYPE_UPDATED: [
        {
            "id": "testcafe_updated_bean",
            "name": "Updated Bean",
            "brand": "Test Cafe",
            "price": 19000,
            "origin": "Kenya",
            "weight_g": 200
        }
    ],
    CHANGE_TYPE_DELETED: [
        {
            "id": "testcafe_deleted_bean",
            "name": "Deleted Bean",
            "brand": "Test Cafe",
            "price": 17000,
            "origin": "Colombia",
            "weight_g": 200
        }
    ],
    CHANGE_TYPE_RESTORED: [
        {
            "id": "testcafe_restored_bean",
            "name": "Restored Bean",
            "brand": "Test Cafe",
            "price": 16000,
            "origin": "Brazil",
            "weight_g": 200
        }
    ],
    CHANGE_TYPE_UNCHANGED: [
        {
            "id": "testcafe_unchanged_bean",
            "name": "Unchanged Bean",
            "brand": "Test Cafe",
            "price": 15000,
            "origin": "Guatemala",
            "weight_g": 200
        }
    ]
}

@pytest.fixture
def mock_firebase_client():
    """FirebaseClient 모의 객체 생성"""
    with patch('coffee_crawler.storage.batch_processor.FirebaseClient') as mock:
        # 모의 객체 설정
        mock_instance = mock.return_value
        
        # 모의 Firestore DB 생성
        mock_db = MagicMock()
        mock_instance.db = mock_db
        
        # 모의 배치 생성
        mock_batch = MagicMock()
        mock_db.batch.return_value = mock_batch
        
        # 모의 컬렉션 참조 생성
        mock_collection = MagicMock()
        mock_db.collection.return_value = mock_collection
        
        # 모의 문서 참조 생성
        mock_doc = MagicMock()
        mock_collection.document.return_value = mock_doc
        
        # 설정 객체 모의
        mock_instance.config = {
            'firebase': {
                'firestore': {
                    'collection_beans': 'beans',
                    'collection_logs': 'crawl_logs'
                }
            }
        }
        
        yield mock_instance

@pytest.fixture
def mock_firestore():
    """Firestore 모듈 모의 객체 생성"""
    with patch('coffee_crawler.storage.batch_processor.firestore') as mock:
        # SERVER_TIMESTAMP 설정
        mock.SERVER_TIMESTAMP = "server_timestamp"
        yield mock

class TestBatchProcessor:
    """일괄 처리 프로세서 테스트 클래스"""
    
    def test_process_changes(self, mock_firebase_client, mock_firestore):
        """변경사항 일괄 처리 테스트"""
        # BatchProcessor 인스턴스 생성
        processor = BatchProcessor()
        processor.firebase_client = mock_firebase_client
        processor.db = mock_firebase_client.db
        
        # 변경사항 처리
        stats = processor.process_changes(TEST_BEANS)
        
        # 검증
        assert stats['new'] == 1
        assert stats['updated'] == 1
        assert stats['deleted'] == 1
        assert stats['restored'] == 1
        assert stats['unchanged'] == 1
        assert stats['error'] == 0
        
        # 배치 커밋 확인
        mock_firebase_client.db.batch.return_value.commit.assert_called_once()
        
        # 배치 명령 호출 확인 (set, update)
        batch = mock_firebase_client.db.batch.return_value
        assert batch.set.call_count == 1  # 새 원두
        assert batch.update.call_count == 3  # 수정, 삭제, 복원 원두
    
    def test_process_changes_no_changes(self, mock_firebase_client):
        """변경사항 없는 경우 테스트"""
        # BatchProcessor 인스턴스 생성
        processor = BatchProcessor()
        processor.firebase_client = mock_firebase_client
        processor.db = mock_firebase_client.db
        
        # 변경사항 없음
        empty_changes = {
            CHANGE_TYPE_NEW: [],
            CHANGE_TYPE_UPDATED: [],
            CHANGE_TYPE_DELETED: [],
            CHANGE_TYPE_RESTORED: [],
            CHANGE_TYPE_UNCHANGED: TEST_BEANS[CHANGE_TYPE_UNCHANGED]
        }
        
        # 변경사항 처리
        stats = processor.process_changes(empty_changes)
        
        # 검증
        assert stats['new'] == 0
        assert stats['updated'] == 0
        assert stats['deleted'] == 0
        assert stats['restored'] == 0
        assert stats['unchanged'] == 1
        assert stats['error'] == 0
        
        # 배치 커밋이 호출되지 않아야 함
        mock_firebase_client.db.batch.return_value.commit.assert_not_called()
    
    def test_safe_process_changes(self, mock_firebase_client, mock_firestore):
        """안전 일괄 처리 테스트"""
        # BatchProcessor 인스턴스 생성
        processor = BatchProcessor()
        processor.firebase_client = mock_firebase_client
        processor.db = mock_firebase_client.db
        
        # 변경사항 처리
        stats = processor.safe_process_changes(TEST_BEANS)
        
        # 검증
        assert stats['new'] == 1
        assert stats['updated'] == 1
        assert stats['deleted'] == 1
        assert stats['restored'] == 1
        assert stats['unchanged'] == 1
        assert stats['error'] == 0
        
        # 배치 커밋 4번 호출 확인 (각 유형별 1번씩)
        assert mock_firebase_client.db.batch.return_value.commit.call_count == 4
    
    def test_error_handling(self, mock_firebase_client):
        """오류 처리 테스트"""
        # BatchProcessor 인스턴스 생성
        processor = BatchProcessor()
        processor.firebase_client = mock_firebase_client
        processor.db = mock_firebase_client.db
        
        # 배치 커밋 실패 설정
        mock_firebase_client.db.batch.return_value.commit.side_effect = Exception("테스트 오류")
        
        # 변경사항 처리
        stats = processor.process_changes(TEST_BEANS)
        
        # 검증 - 전체 오류로 처리되어야 함
        assert stats['new'] == 0
        assert stats['updated'] == 0
        assert stats['deleted'] == 0
        assert stats['restored'] == 0
        assert stats['error'] > 0

def test_module_functions():
    """모듈 함수 테스트"""
    with patch('coffee_crawler.storage.batch_processor.get_batch_processor') as mock_get_processor:
        # 모의 프로세서 생성
        mock_processor = MagicMock()
        mock_get_processor.return_value = mock_processor
        
        # process_changes 함수 테스트
        process_changes(TEST_BEANS)
        mock_processor.process_changes.assert_called_once_with(TEST_BEANS, "system")
        
        # safe_process_changes 함수 테스트
        safe_process_changes(TEST_BEANS, "test_user")
        mock_processor.safe_process_changes.assert_called_once_with(TEST_BEANS, "test_user")

if __name__ == "__main__":
    # 직접 실행용 테스트 코드
    pytest.main(["-xvs", __file__]) 
"""
원두 데이터 저장소 테스트
"""

import pytest
import os
import sys
import json
from unittest.mock import patch, MagicMock
from datetime import datetime

# 프로젝트 루트 경로 추가
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from coffee_crawler.storage.bean_repository import BeanRepository, add_bean, update_bean, deactivate_bean
from coffee_crawler.storage.firebase_client import FirebaseClient

# 테스트 데이터
TEST_BEAN = {
    "id": "testcafe_test_bean",
    "name": "Test Bean",
    "brand": "Test Cafe",
    "price": 18000,
    "origin": "Ethiopia",
    "weight_g": 200,
    "roast_level": "Medium",
    "processing": "Washed",
    "flavors": ["Fruity", "Floral"],
    "description": "테스트용 원두입니다."
}

@pytest.fixture
def mock_firebase_client():
    """FirebaseClient 모의 객체 생성"""
    with patch('coffee_crawler.storage.bean_repository.FirebaseClient') as mock:
        # get_bean 메소드 설정
        mock_instance = mock.return_value
        mock_instance.get_bean.return_value = None  # 기본적으로 원두 없음
        
        # add_bean 메소드 설정
        mock_instance.add_bean.return_value = TEST_BEAN["id"]
        
        # update_bean 메소드 설정
        mock_instance.update_bean.return_value = None
        
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

class TestBeanRepository:
    """원두 저장소 테스트 클래스"""
    
    def test_add_bean_new(self, mock_firebase_client):
        """새 원두 추가 테스트"""
        # BeanRepository 인스턴스 생성
        repo = BeanRepository()
        repo.firebase_client = mock_firebase_client
        
        # 원두 추가
        bean_id = repo.add_bean(TEST_BEAN)
        
        # 검증
        assert bean_id == TEST_BEAN["id"]
        mock_firebase_client.add_bean.assert_called_once()
    
    def test_add_bean_existing(self, mock_firebase_client):
        """기존 원두 업데이트 테스트"""
        # 기존 원두 존재하도록 설정
        mock_firebase_client.get_bean.return_value = TEST_BEAN.copy()
        
        # BeanRepository 인스턴스 생성
        repo = BeanRepository()
        repo.firebase_client = mock_firebase_client
        
        # 업데이트할 원두 데이터
        updated_bean = TEST_BEAN.copy()
        updated_bean["price"] = 19000
        
        # 원두 추가 (실제로는 업데이트됨)
        with patch.object(repo, 'update_bean') as mock_update:
            bean_id = repo.add_bean(updated_bean)
            
            # 검증
            assert bean_id == TEST_BEAN["id"]
            mock_update.assert_called_once_with(TEST_BEAN["id"], updated_bean, "system")
    
    def test_update_bean(self, mock_firebase_client):
        """원두 업데이트 테스트"""
        # 기존 원두 존재하도록 설정
        existing_bean = TEST_BEAN.copy()
        existing_bean["lastUpdated"] = datetime.now().isoformat()
        mock_firebase_client.get_bean.return_value = existing_bean
        
        # BeanRepository 인스턴스 생성
        repo = BeanRepository()
        repo.firebase_client = mock_firebase_client
        
        # 업데이트할 원두 데이터
        updated_bean = {
            "price": 19000,
            "flavors": ["Fruity", "Floral", "Chocolate"]
        }
        
        # bean_mapper.merge_with_existing 함수 모의
        with patch('coffee_crawler.storage.bean_repository.merge_with_existing') as mock_merge:
            # 병합 결과 설정
            merged_data = existing_bean.copy()
            merged_data.update(updated_bean)
            mock_merge.return_value = merged_data
            
            # 원두 업데이트
            repo.update_bean(TEST_BEAN["id"], updated_bean)
            
            # 검증
            mock_firebase_client.update_bean.assert_called_once()
            mock_merge.assert_called_once()
    
    def test_deactivate_bean(self, mock_firebase_client):
        """원두 비활성화 테스트"""
        # 기존 원두 존재하도록 설정
        existing_bean = TEST_BEAN.copy()
        existing_bean["isActive"] = True
        mock_firebase_client.get_bean.return_value = existing_bean
        
        # BeanRepository 인스턴스 생성
        repo = BeanRepository()
        repo.firebase_client = mock_firebase_client
        
        # 원두 비활성화
        repo.deactivate_bean(TEST_BEAN["id"])
        
        # 검증
        mock_firebase_client.update_bean.assert_called_once()
        # 업데이트 데이터에 isActive=False가 포함되었는지 확인
        args, kwargs = mock_firebase_client.update_bean.call_args
        assert args[0] == TEST_BEAN["id"]
        assert args[1]["isActive"] is False
    
    def test_get_bean(self, mock_firebase_client):
        """원두 조회 테스트"""
        # 기존 원두 존재하도록 설정
        mock_firebase_client.get_bean.return_value = TEST_BEAN.copy()
        
        # BeanRepository 인스턴스 생성
        repo = BeanRepository()
        repo.firebase_client = mock_firebase_client
        
        # 원두 조회
        bean = repo.get_bean(TEST_BEAN["id"])
        
        # 검증
        assert bean is not None
        assert bean["id"] == TEST_BEAN["id"]
        assert bean["name"] == TEST_BEAN["name"]
        mock_firebase_client.get_bean.assert_called_once_with(TEST_BEAN["id"])
    
    def test_get_all_beans(self, mock_firebase_client):
        """모든 원두 조회 테스트"""
        # 원두 목록 설정
        mock_firebase_client.get_beans.return_value = [TEST_BEAN.copy()]
        
        # BeanRepository 인스턴스 생성
        repo = BeanRepository()
        repo.firebase_client = mock_firebase_client
        
        # 원두 목록 조회
        beans = repo.get_all_beans()
        
        # 검증
        assert len(beans) == 1
        assert beans[0]["id"] == TEST_BEAN["id"]
        mock_firebase_client.get_beans.assert_called_once()

def test_module_functions():
    """모듈 함수 테스트"""
    with patch('coffee_crawler.storage.bean_repository.get_repository') as mock_get_repo:
        # 모의 저장소 생성
        mock_repo = MagicMock()
        mock_get_repo.return_value = mock_repo
        
        # add_bean 함수 테스트
        add_bean(TEST_BEAN)
        mock_repo.add_bean.assert_called_once_with(TEST_BEAN, "system")
        
        # update_bean 함수 테스트
        update_bean(TEST_BEAN["id"], TEST_BEAN)
        mock_repo.update_bean.assert_called_once_with(TEST_BEAN["id"], TEST_BEAN, "system")
        
        # deactivate_bean 함수 테스트
        deactivate_bean(TEST_BEAN["id"])
        mock_repo.deactivate_bean.assert_called_once_with(TEST_BEAN["id"], "system")

if __name__ == "__main__":
    # 직접 실행용 테스트 코드
    pytest.main(["-xvs", __file__]) 
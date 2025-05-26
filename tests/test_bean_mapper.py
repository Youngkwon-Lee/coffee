"""
원두 데이터 매핑 테스트
"""

import pytest
import os
import sys
import json
from datetime import datetime, timedelta
from typing import Dict, Any, List

# 프로젝트 루트 경로 추가
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from coffee_crawler.processors.bean_mapper import BeanMapper, to_firestore, map_beans, merge_with_existing

# 테스트 데이터
TEST_BEAN = {
    "name": "에티오피아 예가체프 G1 워시드 (200g)",
    "brand": "테스트 카페",
    "price": 18000,
    "origin": "에티오피아",
    "weight_g": 200,
    "roast_level": "미디엄",
    "processing": "워시드",
    "flavors": ["꽃향", "감귤", "베리"],
    "image_url": "https://example.com/image.jpg",
    "product_url": "https://example.com/product"
}

EXISTING_BEAN = {
    "id": "testcafe_ethiopia_yirgacheffe",
    "name": "에티오피아 예가체프 G1 워시드 (200g)",
    "brand": "테스트 카페",
    "price": 17000,  # 이전 가격
    "origin": "에티오피아",
    "originCountry": "에티오피아",
    "weight_g": 200,
    "roastLevel": "미디엄",
    "processing": "워시드",
    "flavors": ["꽃향", "감귤"],  # 이전 향미
    "isActive": True,
    "isPublic": True,
    "isCrawled": True,
    "hash": "old_hash",
    "createdAt": (datetime.now() - timedelta(days=30)).isoformat(),
    "lastUpdated": (datetime.now() - timedelta(days=5)).isoformat(),
    "createdBy": "system",
    "lastUpdatedBy": "system",
    "notes": "맛있는 원두",  # 사용자 추가 필드
    "userRating": 4.5,  # 사용자 추가 필드
    "favorite": True  # 사용자 추가 필드
}

class TestBeanMapper:
    """매핑 테스트 클래스"""
    
    def setup_method(self):
        """테스트 설정"""
        self.mapper = BeanMapper(user_id="test_user")
    
    def test_generate_id(self):
        """ID 생성 테스트"""
        # ID가 없는 경우
        bean_id = self.mapper.generate_id(TEST_BEAN)
        assert bean_id is not None
        assert "test" in bean_id.lower() or "testcafe" in bean_id.lower()
        assert "ethiopia" in bean_id.lower() or "yirgacheffe" in bean_id.lower()
        
        # ID가 있는 경우
        bean_with_id = TEST_BEAN.copy()
        bean_with_id["id"] = "existing_id"
        bean_id = self.mapper.generate_id(bean_with_id)
        assert bean_id == "existing_id"
        
        # 브랜드나 이름이 없는 경우
        bean_without_brand = TEST_BEAN.copy()
        bean_without_brand.pop("brand", None)
        bean_id = self.mapper.generate_id(bean_without_brand)
        assert bean_id.startswith("bean_")
    
    def test_to_firestore(self):
        """Firestore 형식으로 변환 테스트"""
        firestore_bean = self.mapper.to_firestore(TEST_BEAN)
        
        # 필수 필드 확인
        assert 'id' in firestore_bean
        assert 'name' in firestore_bean
        assert 'brand' in firestore_bean
        assert 'price' in firestore_bean
        assert 'origin' in firestore_bean
        assert 'originCountry' in firestore_bean
        assert 'weight_g' in firestore_bean
        assert 'roastLevel' in firestore_bean
        assert 'flavors' in firestore_bean
        assert 'processing' in firestore_bean
        assert 'imageUrl' in firestore_bean
        assert 'productUrl' in firestore_bean
        assert 'isActive' in firestore_bean
        assert 'isPublic' in firestore_bean
        assert 'isCrawled' in firestore_bean
        assert 'createdAt' in firestore_bean
        assert 'lastUpdated' in firestore_bean
        assert 'createdBy' in firestore_bean
        assert 'lastUpdatedBy' in firestore_bean
        
        # 값 확인
        assert firestore_bean['name'] == TEST_BEAN['name']
        assert firestore_bean['brand'] == TEST_BEAN['brand']
        assert firestore_bean['price'] == TEST_BEAN['price']
        assert firestore_bean['origin'] == TEST_BEAN['origin']
        assert firestore_bean['originCountry'] == TEST_BEAN['origin']
        assert firestore_bean['weight_g'] == TEST_BEAN['weight_g']
        assert firestore_bean['roastLevel'] == TEST_BEAN['roast_level']
        assert firestore_bean['flavors'] == TEST_BEAN['flavors']
        assert firestore_bean['processing'] == TEST_BEAN['processing']
        assert firestore_bean['imageUrl'] == TEST_BEAN['image_url']
        assert firestore_bean['productUrl'] == TEST_BEAN['product_url']
        assert firestore_bean['isActive'] is True
        assert firestore_bean['isPublic'] is True
        assert firestore_bean['isCrawled'] is True
        assert firestore_bean['lastUpdatedBy'] == "test_user"
    
    def test_map_beans(self):
        """원두 목록 변환 테스트"""
        beans = [TEST_BEAN, TEST_BEAN.copy()]
        firestore_beans = self.mapper.map_beans(beans)
        
        assert len(firestore_beans) == 2
        assert all('id' in bean for bean in firestore_beans)
        assert all('name' in bean for bean in firestore_beans)
        assert all('brand' in bean for bean in firestore_beans)
    
    def test_merge_with_existing(self):
        """기존 데이터와 병합 테스트"""
        # 새 데이터
        new_bean = TEST_BEAN.copy()
        new_bean['id'] = EXISTING_BEAN['id']  # ID 일치를 위해 추가
        new_bean['price'] = 18000  # 가격 변경
        new_bean['flavors'] = ["꽃향", "감귤", "베리"]  # 향미 추가
        
        # 병합
        merged_bean = self.mapper.merge_with_existing(new_bean, EXISTING_BEAN)
        
        # 기본 필드 확인
        assert merged_bean['id'] == EXISTING_BEAN['id']
        assert merged_bean['price'] == new_bean['price']  # 새 가격으로 업데이트
        assert merged_bean['flavors'] == new_bean['flavors']  # 새 향미로 업데이트
        
        # 사용자 추가 필드 유지 확인
        assert 'notes' in merged_bean
        assert merged_bean['notes'] == EXISTING_BEAN['notes']
        assert 'userRating' in merged_bean
        assert merged_bean['userRating'] == EXISTING_BEAN['userRating']
        assert 'favorite' in merged_bean
        assert merged_bean['favorite'] == EXISTING_BEAN['favorite']
        
        # 생성 정보 유지 확인
        assert merged_bean['createdAt'] == EXISTING_BEAN['createdAt']
        assert merged_bean['createdBy'] == EXISTING_BEAN['createdBy']
        
        # 업데이트 정보 변경 확인
        assert merged_bean['lastUpdatedBy'] == "test_user"

# 샘플 데이터 파일 테스트
def test_map_sample_data():
    """샘플 데이터 매핑 테스트"""
    # 샘플 데이터 파일 경로
    sample_file = os.path.join(os.path.dirname(__file__), 'samples', 'centercoffee_beans.json')
    
    # 파일 존재 확인
    if not os.path.exists(sample_file):
        pytest.skip(f"샘플 데이터 파일 없음: {sample_file}")
    
    # 샘플 데이터 로드
    with open(sample_file, 'r', encoding='utf-8') as f:
        beans = json.load(f)
    
    # 매핑
    mapper = BeanMapper()
    firestore_beans = mapper.map_beans(beans)
    
    # 결과 확인
    assert len(firestore_beans) == len(beans)
    
    # 첫 번째 원두 검증
    first_bean = firestore_beans[0]
    assert 'id' in first_bean
    assert 'name' in first_bean
    assert 'brand' in first_bean
    assert 'price' in first_bean
    assert 'origin' in first_bean
    assert 'originCountry' in first_bean
    assert 'weight_g' in first_bean
    assert 'isActive' in first_bean
    assert 'isPublic' in first_bean
    assert 'isCrawled' in first_bean
    
    # 저장 여부 확인 (선택 사항)
    save_option = False  # 테스트에서는 저장하지 않음
    if save_option:
        output_file = os.path.join(os.path.dirname(__file__), 'samples', 'firestore_beans.json')
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(firestore_beans, f, ensure_ascii=False, indent=2)
        print(f"Firestore 형식 데이터 저장: {output_file}")

if __name__ == "__main__":
    # 테스트 인스턴스 생성
    test_instance = TestBeanMapper()
    test_instance.setup_method()
    
    # 개별 테스트 함수 실행
    test_instance.test_generate_id()
    test_instance.test_to_firestore()
    test_instance.test_map_beans()
    test_instance.test_merge_with_existing()
    
    # 샘플 데이터 테스트
    test_map_sample_data() 
"""
원두 데이터 정규화 테스트
"""

import pytest
import os
import sys
import json
from typing import Dict, Any

# 프로젝트 루트 경로 추가
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from coffee_crawler.processors.normalizer import normalize_bean, normalize_beans

# 테스트 데이터
TEST_BEAN_1 = {
    "name": "Ethiopia Yirgacheffe 200g",
    "brand": "Test Coffee",
    "price": "18,000원",
    "description": "Washed process coffee with floral notes"
}

TEST_BEAN_2 = {
    "name": "Kenya AA",
    "brand": "Test Coffee",
    "price": 25000,
    "processing": "washed",
    "origin": "kenya",
    "weight_g": "250g",
    "roast_level": "medium",
    "flavors": "Berry, Citrus, Chocolate"
}

TEST_BEAN_3 = {
    "name": "브라질 세하도 내추럴",
    "brand": "테스트 카페",
    "description": "500g, 미디엄 다크 로스팅, 견과류와 초콜릿 풍미"
}

class TestNormalizer:
    """정규화 테스트 클래스"""
    
    def test_normalize_price(self):
        """가격 정규화 테스트"""
        # 문자열 가격 정규화
        result = normalize_bean(TEST_BEAN_1)
        assert isinstance(result['price'], int)
        assert result['price'] == 18000
        
        # 이미 숫자인 가격 정규화
        result = normalize_bean(TEST_BEAN_2)
        assert isinstance(result['price'], int)
        assert result['price'] == 25000
        
        # 설명에서 가격 추출 (이 경우 추출 안됨)
        result = normalize_bean(TEST_BEAN_3)
        assert 'price' in result
        assert isinstance(result['price'], int)
    
    def test_normalize_origin(self):
        """원산지 정규화 테스트"""
        # 영문 원산지 정규화
        result = normalize_bean(TEST_BEAN_1)
        assert 'origin' in result
        assert result['origin'] == '에티오피아'
        
        # 이미 있는 원산지 정규화
        result = normalize_bean(TEST_BEAN_2)
        assert 'origin' in result
        assert result['origin'] == '케냐'
        
        # 한글 원산지 유지
        result = normalize_bean(TEST_BEAN_3)
        assert 'origin' in result
        assert result['origin'] == '브라질'
    
    def test_normalize_processing(self):
        """가공방식 정규화 테스트"""
        # 설명에서 가공방식 추출
        result = normalize_bean(TEST_BEAN_1)
        assert 'processing' in result
        assert result['processing'] == '워시드'
        
        # 이미 있는 가공방식 정규화
        result = normalize_bean(TEST_BEAN_2)
        assert 'processing' in result
        assert result['processing'] == '워시드'
        
        # 이름에서 가공방식 추출
        result = normalize_bean(TEST_BEAN_3)
        assert 'processing' in result
        assert result['processing'] == '내추럴'
    
    def test_normalize_weight(self):
        """무게 정규화 테스트"""
        # 이름에서 무게 추출
        result = normalize_bean(TEST_BEAN_1)
        assert 'weight_g' in result
        assert result['weight_g'] == 200
        
        # 이미 있는 무게 정규화
        result = normalize_bean(TEST_BEAN_2)
        assert 'weight_g' in result
        assert result['weight_g'] == 250
        
        # 설명에서 무게 추출
        result = normalize_bean(TEST_BEAN_3)
        assert 'weight_g' in result
        assert result['weight_g'] == 500
    
    def test_normalize_roast_level(self):
        """로스팅 레벨 정규화 테스트"""
        # 기본값은 없음
        result = normalize_bean(TEST_BEAN_1)
        # 로스팅 레벨은 설정되지 않을 수 있음
        if 'roast_level' in result:
            assert isinstance(result['roast_level'], str)
        
        # 이미 있는 로스팅 레벨 정규화
        result = normalize_bean(TEST_BEAN_2)
        assert 'roast_level' in result
        assert result['roast_level'] == '미디엄'
        
        # 설명에서 로스팅 레벨 추출
        result = normalize_bean(TEST_BEAN_3)
        assert 'roast_level' in result
        assert result['roast_level'] == '미디엄 다크'
    
    def test_normalize_flavors(self):
        """향미 노트 정규화 테스트"""
        # 기본값은 빈 목록
        result = normalize_bean(TEST_BEAN_1)
        assert 'flavors' in result
        assert isinstance(result['flavors'], list)
        
        # 문자열에서 목록으로 변환
        result = normalize_bean(TEST_BEAN_2)
        assert 'flavors' in result
        assert isinstance(result['flavors'], list)
        assert len(result['flavors']) == 3
        assert 'Berry' in result['flavors']
        assert 'Citrus' in result['flavors']
        assert 'Chocolate' in result['flavors']
    
    def test_normalize_beans(self):
        """원두 목록 정규화 테스트"""
        beans = [TEST_BEAN_1, TEST_BEAN_2, TEST_BEAN_3]
        results = normalize_beans(beans)
        
        assert len(results) == 3
        assert all('price' in bean for bean in results)
        assert all(isinstance(bean['price'], int) for bean in results)
        assert all('weight_g' in bean for bean in results)

# 샘플 데이터 파일 테스트
def test_normalize_sample_data():
    """샘플 데이터 정규화 테스트"""
    # 샘플 데이터 파일 경로
    sample_file = os.path.join(os.path.dirname(__file__), 'samples', 'centercoffee_beans.json')
    
    # 파일 존재 확인
    if not os.path.exists(sample_file):
        pytest.skip(f"샘플 데이터 파일 없음: {sample_file}")
    
    # 샘플 데이터 로드
    with open(sample_file, 'r', encoding='utf-8') as f:
        beans = json.load(f)
    
    # 정규화
    normalized_beans = normalize_beans(beans)
    
    # 결과 확인
    assert len(normalized_beans) == len(beans)
    
    # 첫 번째 원두 검증
    first_bean = normalized_beans[0]
    assert 'name' in first_bean
    assert 'price' in first_bean
    assert 'origin' in first_bean
    assert 'weight_g' in first_bean
    assert isinstance(first_bean['price'], int)
    assert isinstance(first_bean['weight_g'], int)
    
    # 저장 여부 확인 (선택 사항)
    save_option = False  # 테스트에서는 저장하지 않음
    if save_option:
        output_file = os.path.join(os.path.dirname(__file__), 'samples', 'normalized_beans.json')
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(normalized_beans, f, ensure_ascii=False, indent=2)
        print(f"정규화된 데이터 저장: {output_file}")

if __name__ == "__main__":
    # 개별 테스트 함수 실행
    test_instance = TestNormalizer()
    test_instance.test_normalize_price()
    test_instance.test_normalize_origin()
    test_instance.test_normalize_processing()
    test_instance.test_normalize_weight()
    test_instance.test_normalize_roast_level()
    test_instance.test_normalize_flavors()
    test_instance.test_normalize_beans()
    
    # 샘플 데이터 테스트
    test_normalize_sample_data() 
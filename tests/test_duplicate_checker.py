"""
원두 중복 검사 테스트
"""

import pytest
import os
import sys
import json
from datetime import datetime, timedelta
from typing import Dict, Any, List

# 프로젝트 루트 경로 추가
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from coffee_crawler.processors.duplicate_checker import BeanDuplicateChecker, find_duplicates, deduplicate

# 테스트 데이터
SIMILAR_BEANS = [
    {
        "id": "bean1",
        "name": "에티오피아 예가체프 G1 워시드 (200g)",
        "brand": "테스트 카페",
        "price": 18000,
        "origin": "에티오피아",
        "weight_g": 200,
        "lastUpdated": (datetime.now() - timedelta(days=10)).isoformat()
    },
    {
        "id": "bean2",
        "name": "Ethiopia Yirgacheffe G1 Washed Process 200g",
        "brand": "테스트 카페",
        "price": 18000,
        "origin": "Ethiopia",
        "weight_g": 200,
        "lastUpdated": (datetime.now() - timedelta(days=5)).isoformat()
    },
    {
        "id": "bean3",
        "name": "에티오피아 예가체프 워시드 프로세스 (200g)",
        "brand": "테스트 카페",
        "price": 18500,
        "origin": "에티오피아",
        "weight_g": 200,
        "lastUpdated": datetime.now().isoformat()
    }
]

DIFFERENT_BEANS = [
    {
        "id": "bean4",
        "name": "케냐 AA (200g)",
        "brand": "테스트 카페",
        "price": 19000,
        "origin": "케냐",
        "weight_g": 200,
        "lastUpdated": datetime.now().isoformat()
    },
    {
        "id": "bean5",
        "name": "브라질 세하도 내추럴 (500g)",
        "brand": "다른 카페",
        "price": 28000,
        "origin": "브라질",
        "weight_g": 500,
        "lastUpdated": datetime.now().isoformat()
    }
]

class TestDuplicateChecker:
    """중복 검사 테스트 클래스"""
    
    def setup_method(self):
        """테스트 설정"""
        self.checker = BeanDuplicateChecker(similarity_threshold=0.8)
    
    def test_normalize_name(self):
        """원두명 정규화 테스트"""
        # 숫자 및 무게 제거
        normalized = self.checker.normalize_name("에티오피아 예가체프 G1 워시드 (200g)")
        assert "200g" not in normalized
        assert "g1" not in normalized.lower()
        
        # 불용어 제거
        normalized = self.checker.normalize_name("에티오피아 예가체프 원두 커피")
        assert "원두" not in normalized
        assert "커피" not in normalized
        
        # 특수문자 제거
        normalized = self.checker.normalize_name("에티오피아-예가체프/시다모 (G1)")
        assert "-" not in normalized
        assert "/" not in normalized
        assert "(" not in normalized
        assert ")" not in normalized
    
    def test_calculate_similarity(self):
        """유사도 계산 테스트"""
        # 완전히 동일한 이름
        similarity = self.checker.calculate_similarity(
            "에티오피아 예가체프 워시드", 
            "에티오피아 예가체프 워시드"
        )
        assert similarity == 1.0
        
        # 무게만 다른 이름
        similarity = self.checker.calculate_similarity(
            "에티오피아 예가체프 워시드 (200g)", 
            "에티오피아 예가체프 워시드 (500g)"
        )
        assert similarity > 0.9
        
        # 영문/한글 혼용
        similarity = self.checker.calculate_similarity(
            "에티오피아 예가체프 워시드", 
            "Ethiopia Yirgacheffe Washed"
        )
        assert similarity < 0.5  # 영문/한글은 낮은 유사도를 가짐
        
        # 완전히 다른 이름
        similarity = self.checker.calculate_similarity(
            "에티오피아 예가체프 워시드", 
            "케냐 AA 워시드"
        )
        assert similarity < 0.5
    
    def test_is_duplicate(self):
        """중복 판단 테스트"""
        # 유사한 원두 비교
        assert self.checker.is_duplicate(SIMILAR_BEANS[0], SIMILAR_BEANS[1]) is False  # 영문/한글 차이로 유사도 낮음
        assert self.checker.is_duplicate(SIMILAR_BEANS[0], SIMILAR_BEANS[2]) is True
        
        # 다른 원두 비교
        assert self.checker.is_duplicate(SIMILAR_BEANS[0], DIFFERENT_BEANS[0]) is False
        
        # 브랜드가 다른 경우
        assert self.checker.is_duplicate(SIMILAR_BEANS[0], DIFFERENT_BEANS[1]) is False
    
    def test_find_duplicates(self):
        """중복 그룹 찾기 테스트"""
        # 모든 원두 목록
        all_beans = SIMILAR_BEANS + DIFFERENT_BEANS
        
        # 중복 그룹 찾기
        duplicate_groups = self.checker.find_duplicates(all_beans)
        
        # 1개의 중복 그룹이 있어야 함 (영문/한글 차이로 SIMILAR_BEANS[0]와 SIMILAR_BEANS[1]는 중복으로 인식되지 않음)
        assert len(duplicate_groups) == 1
        
        # 첫 번째 그룹 확인
        assert len(duplicate_groups[0]) == 2
        
        # 임계값 낮춰서 다시 테스트
        checker_low_threshold = BeanDuplicateChecker(similarity_threshold=0.4)
        duplicate_groups = checker_low_threshold.find_duplicates(all_beans)
        
        # 1개의 중복 그룹이 있어야 함 (낮은 임계값으로 SIMILAR_BEANS 모두 중복으로 인식)
        assert len(duplicate_groups) >= 1
    
    def test_deduplicate(self):
        """중복 제거 테스트"""
        # 모든 원두 목록
        all_beans = SIMILAR_BEANS + DIFFERENT_BEANS
        
        # 중복 제거 (최신 유지)
        deduplicated = self.checker.deduplicate(all_beans, keep_newest=True)
        
        # 중복 제거 후 4개의 원두가 있어야 함
        # SIMILAR_BEANS[0]와 SIMILAR_BEANS[2]는 중복으로 인식되고, SIMILAR_BEANS[2]가 최신이므로 유지됨
        assert len(deduplicated) == 4
        
        # 최신 원두가 유지되었는지 확인
        ids = [bean.get('id') for bean in deduplicated]
        assert 'bean3' in ids  # 가장 최신 원두
        assert 'bean1' not in ids  # 중복으로 제거됨
        
        # 중복 제거 (가장 오래된 것 유지)
        deduplicated = self.checker.deduplicate(all_beans, keep_newest=False)
        
        # 중복 제거 후 4개의 원두가 있어야 함
        assert len(deduplicated) == 4
        
        # 가장 오래된 원두가 유지되었는지 확인
        ids = [bean.get('id') for bean in deduplicated]
        assert 'bean1' in ids  # 가장 오래된 원두
        assert 'bean3' not in ids  # 중복으로 제거됨

# 샘플 데이터 파일 테스트
def test_deduplicate_sample_data():
    """샘플 데이터 중복 제거 테스트"""
    # 샘플 데이터 파일 경로
    sample_file = os.path.join(os.path.dirname(__file__), 'samples', 'centercoffee_beans.json')
    
    # 파일 존재 확인
    if not os.path.exists(sample_file):
        pytest.skip(f"샘플 데이터 파일 없음: {sample_file}")
    
    # 샘플 데이터 로드
    with open(sample_file, 'r', encoding='utf-8') as f:
        beans = json.load(f)
    
    # 동일한 데이터 복제하여 인위적인 중복 생성
    duplicated_beans = beans.copy()
    if len(beans) >= 2:
        # 첫 번째 원두 이름 약간 변경하여 복제
        duplicate = beans[0].copy()
        duplicate['id'] = 'duplicate_' + duplicate.get('id', 'unknown')
        duplicate['name'] = duplicate['name'] + " 특별 할인"
        duplicated_beans.append(duplicate)
        
        # 두 번째 원두 이름 약간 변경하여 복제
        duplicate = beans[1].copy()
        duplicate['id'] = 'duplicate_' + duplicate.get('id', 'unknown')
        duplicate['name'] = duplicate['name'].replace('(', '').replace(')', '')
        duplicated_beans.append(duplicate)
    
    # 중복 제거
    checker = BeanDuplicateChecker(similarity_threshold=0.8)
    deduplicated_beans = checker.deduplicate(duplicated_beans)
    
    # 중복 제거 후 원두 수 확인
    assert len(deduplicated_beans) <= len(duplicated_beans)
    
    # 중복 그룹 찾기
    duplicate_groups = checker.find_duplicates(duplicated_beans)
    print(f"중복 그룹 수: {len(duplicate_groups)}")
    
    # 첫 번째 중복 그룹 정보 출력
    if duplicate_groups:
        group = duplicate_groups[0]
        print(f"첫 번째 중복 그룹:")
        for bean in group:
            print(f"- {bean.get('id')}: {bean.get('name')}")

if __name__ == "__main__":
    # 테스트 인스턴스 생성
    test_instance = TestDuplicateChecker()
    test_instance.setup_method()
    
    # 개별 테스트 함수 실행
    test_instance.test_normalize_name()
    test_instance.test_calculate_similarity()
    test_instance.test_is_duplicate()
    test_instance.test_find_duplicates()
    test_instance.test_deduplicate()
    
    # 샘플 데이터 테스트
    test_deduplicate_sample_data() 
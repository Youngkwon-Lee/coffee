"""
원두 중복 검사 모듈

이 모듈은 수집된 원두 데이터의 중복을 검사하는 기능을 제공합니다.
중복 검사는 원두명과 브랜드를 기반으로 수행됩니다.
"""

import re
import logging
import difflib
from typing import Dict, Any, List, Tuple, Optional, Set

# 로거 설정
logger = logging.getLogger(__name__)

class BeanDuplicateChecker:
    """원두 중복 검사 클래스"""
    
    def __init__(self, similarity_threshold: float = 0.85):
        """
        BeanDuplicateChecker 초기화
        
        Args:
            similarity_threshold: 중복으로 판단할 유사도 임계값 (0.0 ~ 1.0)
        """
        self.similarity_threshold = similarity_threshold
        
        # 불용어 목록 (중복 검사 시 제외할 단어)
        self.stop_words = [
            '원두', '커피', 'coffee', 'bean', 'beans',
            'g', 'kg', '그램', '킬로그램',
            '로스팅', 'roast', 'roasted',
            '무료배송', '당일발송', '당일배송',
            '할인', 'sale', '세일', '특가',
            '신상', '신제품', 'new'
        ]
        
        # 불용어 정규식 패턴
        self.stop_words_pattern = re.compile(
            r'\b(' + '|'.join(re.escape(word) for word in self.stop_words) + r')\b', 
            re.IGNORECASE
        )
        
        # 무게 패턴 (200g, 1kg 등)
        self.weight_pattern = re.compile(r'\d+\s*[gG]|\d+\s*[kK][gG]')
        
        # 특수문자 패턴
        self.special_chars_pattern = re.compile(r'[^\w\s]')
        
        # 숫자 패턴
        self.numbers_pattern = re.compile(r'\d+')
        
        # 공백 패턴
        self.whitespace_pattern = re.compile(r'\s+')
    
    def normalize_name(self, name: str) -> str:
        """
        원두명 정규화 (중복 검사용)
        
        Args:
            name: 원본 원두명
            
        Returns:
            정규화된 원두명
        """
        # 소문자 변환
        normalized = name.lower()
        
        # 무게 제거
        normalized = self.weight_pattern.sub('', normalized)
        
        # 불용어 제거
        normalized = self.stop_words_pattern.sub('', normalized)
        
        # 특수문자 제거
        normalized = self.special_chars_pattern.sub('', normalized)
        
        # 숫자 제거
        normalized = self.numbers_pattern.sub('', normalized)
        
        # 연속된 공백 제거 및 트림
        normalized = self.whitespace_pattern.sub(' ', normalized).strip()
        
        return normalized
    
    def calculate_similarity(self, name1: str, name2: str) -> float:
        """
        두 원두명 사이의 유사도 계산
        
        Args:
            name1: 첫 번째 원두명
            name2: 두 번째 원두명
            
        Returns:
            유사도 (0.0 ~ 1.0)
        """
        # 정규화
        norm_name1 = self.normalize_name(name1)
        norm_name2 = self.normalize_name(name2)
        
        # 공백 또는 비어있는 경우 처리
        if not norm_name1 or not norm_name2:
            return 0.0
        
        # 정확히 일치하는 경우
        if norm_name1 == norm_name2:
            return 1.0
        
        # 유사도 계산 (difflib의 SequenceMatcher 사용)
        similarity = difflib.SequenceMatcher(None, norm_name1, norm_name2).ratio()
        
        return similarity
    
    def is_duplicate(self, bean1: Dict[str, Any], bean2: Dict[str, Any]) -> bool:
        """
        두 원두가 중복인지 확인
        
        Args:
            bean1: 첫 번째 원두 데이터
            bean2: 두 번째 원두 데이터
            
        Returns:
            중복 여부
        """
        # 브랜드가 다르면 중복이 아님
        if bean1.get('brand', '') != bean2.get('brand', ''):
            return False
        
        # 원두명이 없으면 중복 판단 불가
        if 'name' not in bean1 or 'name' not in bean2:
            return False
        
        # 유사도 계산
        similarity = self.calculate_similarity(bean1['name'], bean2['name'])
        
        # 가격 비교 (가격이 같으면 유사도 가중치 증가)
        if bean1.get('price') == bean2.get('price') and bean1.get('price') is not None:
            similarity += 0.1
            # 최대값 제한
            similarity = min(similarity, 1.0)
        
        # 무게 비교 (무게가 같으면 유사도 가중치 증가)
        if bean1.get('weight_g') == bean2.get('weight_g') and bean1.get('weight_g') is not None:
            similarity += 0.05
            # 최대값 제한
            similarity = min(similarity, 1.0)
        
        # 유사도가 임계값보다 크면 중복으로 판단
        return similarity >= self.similarity_threshold
    
    def find_duplicates(self, beans: List[Dict[str, Any]]) -> List[List[Dict[str, Any]]]:
        """
        원두 목록에서 중복 그룹 찾기
        
        Args:
            beans: 원두 데이터 목록
            
        Returns:
            중복 그룹 목록 (각 그룹은 중복된 원두 목록)
        """
        if not beans:
            return []
        
        # 중복 그룹 목록
        duplicate_groups = []
        
        # 처리된 원두 인덱스 집합
        processed_indices = set()
        
        # 모든 원두에 대해 중복 검사
        for i in range(len(beans)):
            # 이미 처리된 원두는 건너뜀
            if i in processed_indices:
                continue
            
            # 현재 원두
            current_bean = beans[i]
            
            # 현재 원두와 중복된 원두 목록
            duplicates = [current_bean]
            
            # 나머지 원두와 비교
            for j in range(i+1, len(beans)):
                # 이미 처리된 원두는 건너뜀
                if j in processed_indices:
                    continue
                
                # 비교 대상 원두
                compare_bean = beans[j]
                
                # 중복 여부 확인
                if self.is_duplicate(current_bean, compare_bean):
                    duplicates.append(compare_bean)
                    processed_indices.add(j)
            
            # 중복이 있으면 그룹에 추가
            if len(duplicates) > 1:
                duplicate_groups.append(duplicates)
            
            # 현재 원두 처리 완료
            processed_indices.add(i)
        
        return duplicate_groups
    
    def deduplicate(self, beans: List[Dict[str, Any]], keep_newest: bool = True) -> List[Dict[str, Any]]:
        """
        원두 목록에서 중복 제거
        
        Args:
            beans: 원두 데이터 목록
            keep_newest: True면 최신 원두 유지, False면 가장 오래된 원두 유지
            
        Returns:
            중복 제거된 원두 데이터 목록
        """
        if not beans:
            return []
        
        # 중복 그룹 찾기
        duplicate_groups = self.find_duplicates(beans)
        
        # 처리된 원두 ID 집합
        processed_ids = set()
        
        # 결과 목록
        deduplicated_beans = []
        
        # 중복 그룹 처리
        for group in duplicate_groups:
            # 그룹에서 유지할 원두 선택
            if keep_newest:
                # 최신 업데이트 기준으로 정렬
                sorted_group = sorted(
                    group, 
                    key=lambda x: x.get('lastUpdated', ''),
                    reverse=True
                )
            else:
                # 가장 오래된 업데이트 기준으로 정렬
                sorted_group = sorted(
                    group, 
                    key=lambda x: x.get('lastUpdated', '')
                )
            
            # 첫 번째 원두 유지
            keep_bean = sorted_group[0]
            deduplicated_beans.append(keep_bean)
            
            # 처리된 원두 ID 추가
            for bean in group:
                if 'id' in bean:
                    processed_ids.add(bean['id'])
        
        # 중복되지 않은 원두 추가
        for bean in beans:
            if 'id' in bean and bean['id'] in processed_ids:
                continue
            if bean not in deduplicated_beans:
                deduplicated_beans.append(bean)
        
        return deduplicated_beans

# 글로벌 중복 검사기 인스턴스
_duplicate_checker = None

def get_duplicate_checker(similarity_threshold: float = 0.85) -> BeanDuplicateChecker:
    """
    중복 검사기 인스턴스 반환
    
    Args:
        similarity_threshold: 중복으로 판단할 유사도 임계값 (0.0 ~ 1.0)
        
    Returns:
        BeanDuplicateChecker 인스턴스
    """
    global _duplicate_checker
    if _duplicate_checker is None or _duplicate_checker.similarity_threshold != similarity_threshold:
        _duplicate_checker = BeanDuplicateChecker(similarity_threshold)
    return _duplicate_checker

def find_duplicates(beans: List[Dict[str, Any]], similarity_threshold: float = 0.85) -> List[List[Dict[str, Any]]]:
    """
    원두 목록에서 중복 그룹 찾기
    
    Args:
        beans: 원두 데이터 목록
        similarity_threshold: 중복으로 판단할 유사도 임계값 (0.0 ~ 1.0)
        
    Returns:
        중복 그룹 목록 (각 그룹은 중복된 원두 목록)
    """
    checker = get_duplicate_checker(similarity_threshold)
    return checker.find_duplicates(beans)

def deduplicate(beans: List[Dict[str, Any]], keep_newest: bool = True, similarity_threshold: float = 0.85) -> List[Dict[str, Any]]:
    """
    원두 목록에서 중복 제거
    
    Args:
        beans: 원두 데이터 목록
        keep_newest: True면 최신 원두 유지, False면 가장 오래된 원두 유지
        similarity_threshold: 중복으로 판단할 유사도 임계값 (0.0 ~ 1.0)
        
    Returns:
        중복 제거된 원두 데이터 목록
    """
    checker = get_duplicate_checker(similarity_threshold)
    return checker.deduplicate(beans, keep_newest) 
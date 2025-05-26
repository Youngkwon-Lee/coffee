"""
원두 데이터 매핑 모듈

이 모듈은 원두 데이터를 Firestore 형식으로 변환하는 기능을 제공합니다.
크롤링된 원두 데이터를 Firestore 컬렉션에 맞게 변환합니다.
"""

import logging
import uuid
from typing import Dict, Any, List, Optional
from datetime import datetime

# 로거 설정
logger = logging.getLogger(__name__)

class BeanMapper:
    """원두 데이터 매핑 클래스"""
    
    def __init__(self, user_id: str = "system"):
        """
        BeanMapper 초기화
        
        Args:
            user_id: 작업을 수행하는 사용자 ID
        """
        self.user_id = user_id
    
    def generate_id(self, bean: Dict[str, Any]) -> str:
        """
        원두 ID 생성
        
        Args:
            bean: 원두 데이터
            
        Returns:
            생성된 ID
        """
        # 이미 ID가 있으면 그대로 사용
        if 'id' in bean and bean['id']:
            return bean['id']
        
        # 브랜드와 이름을 조합하여 ID 생성
        brand = bean.get('brand', '').strip().lower()
        name = bean.get('name', '').strip().lower()
        
        if brand and name:
            # 한글 -> 영문 변환 (일부 대표적인 경우만)
            korean_to_english = {
                '테스트': 'test',
                '테스트카페': 'testcafe',
                '테스트 카페': 'testcafe',
                '센터': 'center',
                '센터커피': 'centercoffee',
                '센터 커피': 'centercoffee',
                '에티오피아': 'ethiopia',
                '예가체프': 'yirgacheffe',
                '케냐': 'kenya',
                '콜롬비아': 'colombia',
                '과테말라': 'guatemala',
                '코스타리카': 'costarica',
                '브라질': 'brazil',
                '워시드': 'washed',
                '내추럴': 'natural',
                '허니': 'honey'
            }
            
            for kr, en in korean_to_english.items():
                brand = brand.replace(kr, en)
                name = name.replace(kr, en)
            
            # 특수문자 제거 및 공백을 언더스코어로 변환
            brand = ''.join(c if c.isalnum() or c.isspace() else '' for c in brand)
            name = ''.join(c if c.isalnum() or c.isspace() else '' for c in name)
            
            brand = brand.replace(' ', '_')
            name = name.replace(' ', '_')
            
            # 최종 ID 생성
            bean_id = f"{brand}_{name}"
            
            # ID 길이 제한 (Firestore는 1500바이트 제한)
            if len(bean_id) > 100:
                bean_id = bean_id[:100]
            
            return bean_id
        
        # 브랜드나 이름이 없으면 UUID 생성
        return f"bean_{uuid.uuid4().hex[:8]}"
    
    def to_firestore(self, bean: Dict[str, Any]) -> Dict[str, Any]:
        """
        원두 데이터를 Firestore 형식으로 변환
        
        Args:
            bean: 원두 데이터
            
        Returns:
            Firestore 형식 데이터
        """
        # 현재 시간
        now = datetime.now().isoformat()
        
        # ID 생성 (없는 경우)
        bean_id = self.generate_id(bean)
        
        # Firestore 데이터 구성
        firestore_data = {
            'id': bean_id,
            'name': bean.get('name', '알 수 없는 원두'),
            'brand': bean.get('brand', '알 수 없는 브랜드'),
            'price': bean.get('price', 0),
            'origin': bean.get('origin', ''),
            'originCountry': bean.get('origin', ''),  # 하위 호환성
            'weight_g': bean.get('weight_g', 0),
            'roastLevel': bean.get('roast_level', ''),
            'flavors': bean.get('flavors', []),
            'processing': bean.get('processing', ''),
            'variety': bean.get('variety', ''),
            'description': bean.get('description', ''),
            'imageUrl': bean.get('image_url', ''),
            'productUrl': bean.get('product_url', ''),
            'isActive': bean.get('isActive', True),
            'isPublic': True,
            'isCrawled': True,
            'hash': bean.get('hash', ''),
            'createdBy': bean.get('createdBy', self.user_id),
            'lastUpdatedBy': self.user_id
        }
        
        # 생성일자 (없는 경우에만 설정)
        if 'createdAt' not in bean:
            firestore_data['createdAt'] = now
        else:
            firestore_data['createdAt'] = bean['createdAt']
            
        # 최종 수정일자
        firestore_data['lastUpdated'] = bean.get('lastUpdated', now)
        
        return firestore_data
    
    def map_beans(self, beans: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        원두 데이터 목록을 Firestore 형식으로 변환
        
        Args:
            beans: 원두 데이터 목록
            
        Returns:
            Firestore 형식 데이터 목록
        """
        return [self.to_firestore(bean) for bean in beans]
    
    def merge_with_existing(self, new_bean: Dict[str, Any], existing_bean: Dict[str, Any]) -> Dict[str, Any]:
        """
        새 원두 데이터와 기존 Firestore 데이터 병합
        
        Args:
            new_bean: 새 원두 데이터
            existing_bean: 기존 Firestore 데이터
            
        Returns:
            병합된 데이터
        """
        # 새 데이터를 Firestore 형식으로 변환
        firestore_bean = self.to_firestore(new_bean)
        
        # 기존 데이터에서 유지할 필드 목록
        preserve_fields = [
            'createdAt', 
            'createdBy',
            'notes',
            'ratings',
            'userNotes',
            'userRating',
            'tags',
            'favorite'
        ]
        
        # 기존 데이터의 필드 중 유지할 필드만 복사
        for field in preserve_fields:
            if field in existing_bean:
                firestore_bean[field] = existing_bean[field]
        
        return firestore_bean

# 글로벌 매퍼 인스턴스
_mapper = None

def get_mapper(user_id: str = "system") -> BeanMapper:
    """
    매퍼 인스턴스 반환
    
    Args:
        user_id: 작업을 수행하는 사용자 ID
        
    Returns:
        BeanMapper 인스턴스
    """
    global _mapper
    if _mapper is None or _mapper.user_id != user_id:
        _mapper = BeanMapper(user_id)
    return _mapper

def to_firestore(bean: Dict[str, Any], user_id: str = "system") -> Dict[str, Any]:
    """
    원두 데이터를 Firestore 형식으로 변환 함수
    
    Args:
        bean: 원두 데이터
        user_id: 작업을 수행하는 사용자 ID
        
    Returns:
        Firestore 형식 데이터
    """
    mapper = get_mapper(user_id)
    return mapper.to_firestore(bean)

def map_beans(beans: List[Dict[str, Any]], user_id: str = "system") -> List[Dict[str, Any]]:
    """
    원두 데이터 목록을 Firestore 형식으로 변환 함수
    
    Args:
        beans: 원두 데이터 목록
        user_id: 작업을 수행하는 사용자 ID
        
    Returns:
        Firestore 형식 데이터 목록
    """
    mapper = get_mapper(user_id)
    return mapper.map_beans(beans)

def merge_with_existing(new_bean: Dict[str, Any], existing_bean: Dict[str, Any], user_id: str = "system") -> Dict[str, Any]:
    """
    새 원두 데이터와 기존 Firestore 데이터 병합 함수
    
    Args:
        new_bean: 새 원두 데이터
        existing_bean: 기존 Firestore 데이터
        user_id: 작업을 수행하는 사용자 ID
        
    Returns:
        병합된 데이터
    """
    mapper = get_mapper(user_id)
    return mapper.merge_with_existing(new_bean, existing_bean) 
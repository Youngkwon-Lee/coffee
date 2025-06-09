"""
원두 데이터 모델

이 모듈은 원두 정보를 나타내는 데이터 모델 클래스를 정의합니다.
"""

from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional
from datetime import datetime
import hashlib

@dataclass
class Bean:
    """원두 정보 데이터 클래스"""
    
    # 필수 필드
    name: str                        # 원두명
    brand: str                       # 브랜드(카페)명
    price: int                       # 가격 (원)
    
    # 선택 필드
    origin: Optional[str] = None     # 원산지
    weight_g: Optional[int] = None   # 무게 (g)
    roast_level: Optional[str] = None  # 로스팅 레벨
    flavors: List[str] = field(default_factory=list)  # 향미 노트
    processing: Optional[str] = None  # 가공방식
    variety: Optional[str] = None    # 품종
    
    # 상품 정보
    description: Optional[str] = None  # 설명
    images: List[str] = field(default_factory=list)  # 이미지 URL 목록
    url: Optional[str] = None        # 상품 URL
    
    # 메타데이터
    id: Optional[str] = None         # 고유 ID (생성 시 자동 할당)
    cafe_id: Optional[str] = None    # 카페 식별자
    isActive: bool = True            # 활성 상태
    createdAt: Optional[datetime] = None  # 생성 시간
    lastUpdated: Optional[datetime] = None  # 마지막 업데이트 시간
    hash: Optional[str] = None       # 콘텐츠 해시 (변경 감지용)
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Bean 객체를 딕셔너리로 변환
        
        Returns:
            딕셔너리 형태의 원두 데이터
        """
        bean_dict = asdict(self)
        
        # None 값 필드 제거
        bean_dict = {k: v for k, v in bean_dict.items() if v is not None}
        
        # 빈 리스트 제거
        for k in list(bean_dict.keys()):
            if isinstance(bean_dict[k], list) and len(bean_dict[k]) == 0:
                del bean_dict[k]
        
        return bean_dict
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Bean':
        """
        딕셔너리에서 Bean 객체 생성
        
        Args:
            data: 원두 데이터 딕셔너리
            
        Returns:
            Bean 객체
        """
        # 날짜 필드 처리
        for date_field in ['createdAt', 'lastUpdated']:
            if date_field in data and not isinstance(data[date_field], datetime):
                # Firestore 타임스탬프인 경우
                if hasattr(data[date_field], 'timestamp'):
                    data[date_field] = datetime.fromtimestamp(data[date_field].timestamp())
                # ISO 문자열인 경우
                elif isinstance(data[date_field], str):
                    data[date_field] = datetime.fromisoformat(data[date_field].replace('Z', '+00:00'))
        
        # 알 수 없는 필드 필터링
        known_fields = {f.name for f in cls.__dataclass_fields__.values()}
        filtered_data = {k: v for k, v in data.items() if k in known_fields}
        
        return cls(**filtered_data)
    
    def compute_hash(self) -> str:
        """
        콘텐츠 해시 계산 (변경 감지용)
        
        Returns:
            해시 문자열
        """
        import json
        
        # 메타데이터 제외한 콘텐츠만 해시 계산
        content = {
            'name': self.name,
            'brand': self.brand,
            'price': self.price,
            'origin': self.origin,
            'weight_g': self.weight_g,
            'roast_level': self.roast_level,
            'flavors': sorted(self.flavors) if self.flavors else [],
            'processing': self.processing,
            'variety': self.variety,
            'description': self.description
        }
        
        # None 값 필드 제거
        content = {k: v for k, v in content.items() if v is not None}
        
        # 해시 계산
        content_str = json.dumps(content, sort_keys=True)
        return hashlib.md5(content_str.encode('utf-8')).hexdigest()
    
    def update_hash(self) -> None:
        """해시 값 업데이트"""
        self.hash = self.compute_hash()
        
    def __post_init__(self):
        """초기화 후 처리"""
        # 해시 생성
        if not self.hash:
            self.update_hash()
        
        # ID 생성 (없는 경우)
        if not self.id and self.brand and self.name:
            import re
            # 브랜드명과 원두명으로 ID 생성
            brand = re.sub(r'[^\w]', '_', self.brand.lower())
            name = re.sub(r'[^\w]', '_', self.name.lower())
            self.id = f"{brand}_{name}"
            
            # 특수문자 제거
            self.id = ''.join(c for c in self.id if c.isalnum() or c == '_')
            
            # 중복 언더스코어 제거
            while '__' in self.id:
                self.id = self.id.replace('__', '_')
            
            # 앞뒤 언더스코어 제거
            self.id = self.id.strip('_')
            
        # 현재 시간 설정
        now = datetime.now()
        if not self.createdAt:
            self.createdAt = now
        if not self.lastUpdated:
            self.lastUpdated = now 

    @property
    def id(self) -> str:
        """고유 ID 생성 (이름 + 브랜드 + URL 기반 해시)"""
        if self._id is None:
            # 이름, 브랜드, URL을 조합해서 고유 ID 생성
            id_string = f"{self.name}_{self.brand}_{self.url}"
            self._id = hashlib.md5(id_string.encode('utf-8')).hexdigest()[:16]
        return self._id

    def update_from(self, other: 'Bean') -> Dict[str, Any]:
        """다른 Bean 객체로부터 업데이트하고 변경사항 반환"""
        changes = {}
        
        # 가격 변경 확인
        if self.price != other.price:
            changes['price'] = {'old': self.price, 'new': other.price}
            self.price = other.price
        
        # 이름 변경 확인
        if self.name != other.name:
            changes['name'] = {'old': self.name, 'new': other.name}
            self.name = other.name
        
        # 이미지 변경 확인
        if self.images != other.images:
            changes['images'] = {'old': self.images, 'new': other.images}
            self.images = other.images
        
        # 원산지 변경 확인
        if self.origin != other.origin:
            changes['origin'] = {'old': self.origin, 'new': other.origin}
            self.origin = other.origin
        
        # 가공방식 변경 확인
        if self.processing != other.processing:
            changes['processing'] = {'old': self.processing, 'new': other.processing}
            self.processing = other.processing
        
        # 향미 노트 변경 확인
        if self.flavors != other.flavors:
            changes['flavors'] = {'old': self.flavors, 'new': other.flavors}
            self.flavors = other.flavors
        
        # 변경사항이 있으면 lastUpdated 업데이트
        if changes:
            self.lastUpdated = datetime.now()
        
        return changes
    
    def is_similar_to(self, other: 'Bean', similarity_threshold: float = 0.8) -> bool:
        """다른 Bean과의 유사성 검사"""
        # 이름 유사성 검사 (간단한 문자열 비교)
        name_similarity = self._calculate_string_similarity(self.name, other.name)
        brand_similarity = 1.0 if self.brand == other.brand else 0.0
        
        # 전체 유사성 계산 (이름 70%, 브랜드 30%)
        total_similarity = (name_similarity * 0.7) + (brand_similarity * 0.3)
        
        return total_similarity >= similarity_threshold
    
    def _calculate_string_similarity(self, str1: str, str2: str) -> float:
        """문자열 유사성 계산 (간단한 방법)"""
        if not str1 or not str2:
            return 0.0
        
        # 대소문자 무시하고 공백 제거
        str1 = str1.lower().replace(' ', '')
        str2 = str2.lower().replace(' ', '')
        
        if str1 == str2:
            return 1.0
        
        # 포함 관계 확인
        if str1 in str2 or str2 in str1:
            return 0.8
        
        # 단순 글자 일치율
        common_chars = set(str1) & set(str2)
        total_chars = set(str1) | set(str2)
        
        if not total_chars:
            return 0.0
        
        return len(common_chars) / len(total_chars)
    
    def get_price_formatted(self) -> str:
        """포맷된 가격 문자열 반환"""
        if self.price > 0:
            return f"{self.price:,}원"
        return "가격 정보 없음"
    
    def get_origin_display(self) -> str:
        """표시용 원산지 정보"""
        if self.origin:
            return self.origin
        return "원산지 정보 없음"
    
    def get_processing_display(self) -> str:
        """표시용 가공방식 정보"""
        if self.processing:
            return self.processing
        return "가공방식 정보 없음"
    
    def get_flavor_display(self) -> str:
        """표시용 향미 노트"""
        if self.flavors:
            return ", ".join(self.flavors)
        return "향미 정보 없음"
    
    def is_complete(self) -> bool:
        """필수 정보가 모두 있는지 확인"""
        return bool(
            self.name and 
            self.brand and 
            self.price > 0 and 
            self.url
        )
    
    def get_quality_score(self) -> float:
        """데이터 품질 점수 (0.0 ~ 1.0)"""
        score = 0.0
        total_fields = 8
        
        # 필수 필드
        if self.name: score += 0.25
        if self.brand: score += 0.25
        if self.price > 0: score += 0.25
        if self.url: score += 0.25
        
        # 추가 정보 필드
        if self.origin: score += 0.125
        if self.processing: score += 0.125
        if self.flavors: score += 0.125
        if self.images: score += 0.125
        
        return min(score, 1.0) 
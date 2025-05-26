"""
원두 데이터 모델

이 모듈은 원두 정보를 나타내는 데이터 모델 클래스를 정의합니다.
"""

from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional
from datetime import datetime

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
        import hashlib
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
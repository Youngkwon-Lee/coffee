"""
원두 데이터 모델

이 모듈은 원두 정보를 나타내는 데이터 모델 클래스를 정의합니다.
"""

from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import hashlib

@dataclass
class Bean:
    """원두 정보 모델 - 기존 Firebase 구조와 호환"""
    
    # 기본 정보 (기존 구조 유지)
    name: str
    brand: str
    price: str  # "12,000원" 형태로 저장
    
    # 기존 필드들 (기존 구조와 동일)
    origin: Optional[str] = None          # 원산지
    roast: Optional[str] = None           # 로스팅 정도 (중배전, 라이트 등)
    flavor: Optional[str] = None          # 플레이버 (쉼표로 구분된 문자열)
    process: Optional[str] = None         # 가공방식
    variety: Optional[str] = None         # 품종
    producer: Optional[str] = None        # 생산자
    region: Optional[str] = None          # 지역
    altitude: Optional[str] = None        # 고도
    category: Optional[str] = None        # 카테고리 (드립백, 원두 등)
    
    # 메타데이터
    image: Optional[str] = None           # 이미지 URL
    link: Optional[str] = None            # 상품 링크
    flavor_notes: Optional[str] = None    # 상세 플레이버 노트
    
    # 시스템 필드
    createdAt: Optional[datetime] = None
    lastUpdated: Optional[datetime] = None
    isActive: bool = True
    
    # 추가 호환 필드들
    images: List[str] = field(default_factory=list)     # 여러 이미지 지원
    url: Optional[str] = None                           # link와 동일하지만 추가 호환성
    cafe_id: Optional[str] = None                       # 카페 식별자
    weight_g: Optional[int] = None                      # 중량(그램)
    roast_level: Optional[str] = None                   # roast와 동일하지만 추가 호환성
    processing: Optional[str] = None                    # process와 동일하지만 추가 호환성
    description: Optional[str] = None                   # 상품 설명
    flavors: List[str] = field(default_factory=list)   # flavor의 리스트 버전
    
    def __post_init__(self):
        """초기화 후 처리"""
        # 현재 시간 설정
        if self.createdAt is None:
            self.createdAt = datetime.now()
        if self.lastUpdated is None:
            self.lastUpdated = datetime.now()
        
        # 호환성 필드 동기화
        self._sync_fields()
    
    def _sync_fields(self):
        """호환성을 위한 필드 동기화"""
        # link와 url 동기화
        if self.link and not self.url:
            self.url = self.link
        elif self.url and not self.link:
            self.link = self.url
        
        # roast와 roast_level 동기화
        if self.roast and not self.roast_level:
            self.roast_level = self.roast
        elif self.roast_level and not self.roast:
            self.roast = self.roast_level
        
        # process와 processing 동기화
        if self.process and not self.processing:
            self.processing = self.process
        elif self.processing and not self.process:
            self.process = self.processing
        
        # flavor와 flavors 동기화
        if self.flavor and not self.flavors:
            # 쉼표로 구분된 문자열을 리스트로 변환
            self.flavors = [f.strip() for f in self.flavor.split(',') if f.strip()]
        elif self.flavors and not self.flavor:
            # 리스트를 쉼표로 구분된 문자열로 변환
            self.flavor = ', '.join(self.flavors)
        
        # image와 images 동기화
        if self.image and not self.images:
            self.images = [self.image]
        elif self.images and not self.image:
            self.image = self.images[0] if self.images else None
        
        # cafe_id 자동 설정
        if not self.cafe_id and self.brand:
            # 브랜드명을 소문자로 변환하여 cafe_id로 사용
            self.cafe_id = self.brand.lower().replace(' ', '').replace('커피', '')
    
    def generate_id(self) -> str:
        """고유 ID 생성"""
        id_string = f"{self.name}_{self.brand}_{self.url or ''}"
        return hashlib.md5(id_string.encode('utf-8')).hexdigest()[:16]
    
    def to_dict(self) -> Dict[str, Any]:
        """딕셔너리로 변환 (Firebase 저장용)"""
        # 기존 구조와 완전 호환되는 필드만 포함
        result = {
            'name': self.name,
            'brand': self.brand,
            'price': self.price,
            'origin': self.origin,
            'roast': self.roast,
            'flavor': self.flavor,
            'process': self.process,
            'variety': self.variety,
            'producer': self.producer,
            'region': self.region,
            'altitude': self.altitude,
            'category': self.category,
            'image': self.image,
            'link': self.link,
            'flavor_notes': self.flavor_notes,
            'createdAt': self.createdAt,
            'lastUpdated': self.lastUpdated,
            'isActive': self.isActive
        }
        
        # None 값 제거 (기존 데이터와 동일하게)
        return {k: v for k, v in result.items() if v is not None}
    
    def to_extended_dict(self) -> Dict[str, Any]:
        """확장된 딕셔너리로 변환 (모든 필드 포함)"""
        # 호환성 필드 동기화
        self._sync_fields()
        
        # 모든 필드 포함
        return {
            'name': self.name,
            'brand': self.brand,
            'price': self.price,
            'origin': self.origin,
            'roast': self.roast,
            'roast_level': self.roast_level,
            'flavor': self.flavor,
            'flavors': self.flavors,
            'process': self.process,
            'processing': self.processing,
            'variety': self.variety,
            'producer': self.producer,
            'region': self.region,
            'altitude': self.altitude,
            'category': self.category,
            'image': self.image,
            'images': self.images,
            'link': self.link,
            'url': self.url,
            'flavor_notes': self.flavor_notes,
            'description': self.description,
            'cafe_id': self.cafe_id,
            'weight_g': self.weight_g,
            'createdAt': self.createdAt,
            'lastUpdated': self.lastUpdated,
            'isActive': self.isActive
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Bean':
        """딕셔너리에서 Bean 객체 생성"""
        # 기본 필수 필드 확인
        name = data.get('name', '')
        brand = data.get('brand', '')
        price = data.get('price', '0원')
        
        # Bean 객체 생성
        bean = cls(
            name=name,
            brand=brand,
            price=price,
            origin=data.get('origin'),
            roast=data.get('roast'),
            flavor=data.get('flavor'),
            process=data.get('process'),
            variety=data.get('variety'),
            producer=data.get('producer'),
            region=data.get('region'),
            altitude=data.get('altitude'),
            category=data.get('category'),
            image=data.get('image'),
            link=data.get('link'),
            flavor_notes=data.get('flavor_notes'),
            createdAt=data.get('createdAt'),
            lastUpdated=data.get('lastUpdated'),
            isActive=data.get('isActive', True)
        )
        
        # 확장 필드 설정
        if data.get('images'):
            bean.images = data['images']
        if data.get('url'):
            bean.url = data['url']
        if data.get('cafe_id'):
            bean.cafe_id = data['cafe_id']
        if data.get('weight_g'):
            bean.weight_g = data['weight_g']
        if data.get('roast_level'):
            bean.roast_level = data['roast_level']
        if data.get('processing'):
            bean.processing = data['processing']
        if data.get('description'):
            bean.description = data['description']
        if data.get('flavors'):
            bean.flavors = data['flavors']
        
        return bean
    
    def __str__(self) -> str:
        return f"{self.brand} - {self.name} ({self.price})"
    
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
        
 #        # 향미 노트 변경 확인
 #        if self.flavors != other.flavors:
 #            changes['flavors'] = {'old': self.flavors, 'new': other.flavors}
 #            self.flavors = other.flavors
        
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
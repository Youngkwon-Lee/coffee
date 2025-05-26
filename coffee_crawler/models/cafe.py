"""
카페 데이터 모델

이 모듈은 카페(브랜드) 정보를 나타내는 데이터 모델 클래스를 정의합니다.
"""

from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional
from datetime import datetime

@dataclass
class Cafe:
    """카페(브랜드) 정보 데이터 클래스"""
    
    # 필수 필드
    id: str                          # 카페 ID (config에 정의된 ID)
    name: str                        # 카페 이름
    
    # 선택 필드
    url: Optional[str] = None        # 카페 웹사이트 URL
    description: Optional[str] = None  # 카페 설명
    logo_url: Optional[str] = None   # 카페 로고 URL
    address: Optional[str] = None    # 카페 주소
    instagram: Optional[str] = None  # 인스타그램 계정
    
    # 크롤링 관련 필드
    crawler_type: Optional[str] = None  # 크롤러 유형
    last_crawled_at: Optional[datetime] = None  # 마지막 크롤링 시간
    
    # 메타데이터
    isActive: bool = True            # 활성 상태
    createdAt: Optional[datetime] = None  # 생성 시간
    lastUpdated: Optional[datetime] = None  # 마지막 업데이트 시간
    
    def to_dict(self) -> Dict[str, Any]:
        """
        Cafe 객체를 딕셔너리로 변환
        
        Returns:
            딕셔너리 형태의 카페 데이터
        """
        cafe_dict = asdict(self)
        
        # None 값 필드 제거
        cafe_dict = {k: v for k, v in cafe_dict.items() if v is not None}
        
        return cafe_dict
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Cafe':
        """
        딕셔너리에서 Cafe 객체 생성
        
        Args:
            data: 카페 데이터 딕셔너리
            
        Returns:
            Cafe 객체
        """
        # 날짜 필드 처리
        for date_field in ['createdAt', 'lastUpdated', 'last_crawled_at']:
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
    
    @classmethod
    def from_config(cls, cafe_id: str, config: Dict[str, Any]) -> 'Cafe':
        """
        설정 데이터에서 Cafe 객체 생성
        
        Args:
            cafe_id: 카페 ID
            config: 카페 설정 데이터
            
        Returns:
            Cafe 객체
        """
        now = datetime.now()
        
        return cls(
            id=cafe_id,
            name=config.get('label', cafe_id),
            url=config.get('url'),
            crawler_type=config.get('type'),
            isActive=config.get('active', True),
            createdAt=now,
            lastUpdated=now
        )
    
    def __post_init__(self):
        """초기화 후 처리"""
        # 현재 시간 설정
        now = datetime.now()
        if not self.createdAt:
            self.createdAt = now
        if not self.lastUpdated:
            self.lastUpdated = now 
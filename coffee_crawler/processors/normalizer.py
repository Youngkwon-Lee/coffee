"""
원두 데이터 정규화 모듈

이 모듈은 수집된 원두 데이터를 정규화하는 기능을 제공합니다.
정규화는 원두명, 가격, 향미 등의 필드를 일관된 형식으로 변환합니다.
"""

import re
import logging
from typing import Dict, Any, List, Optional, Union

# 로거 설정
logger = logging.getLogger(__name__)

class BeanNormalizer:
    """원두 데이터 정규화 클래스"""
    
    def __init__(self):
        """BeanNormalizer 초기화"""
        # 원산지 매핑 (다양한 표현 -> 표준화된 표현)
        self.origin_mapping = {
            # 에티오피아
            'ethiopia': '에티오피아',
            'etiopia': '에티오피아',
            'ethiopian': '에티오피아',
            
            # 케냐
            'kenya': '케냐',
            'kenyan': '케냐',
            
            # 콜롬비아
            'colombia': '콜롬비아',
            'columbian': '콜롬비아',
            'colombian': '콜롬비아',
            
            # 과테말라
            'guatemala': '과테말라',
            'guatemalan': '과테말라',
            
            # 코스타리카
            'costa rica': '코스타리카',
            'costarica': '코스타리카',
            
            # 브라질
            'brazil': '브라질',
            'brazilian': '브라질',
            
            # 인도네시아
            'indonesia': '인도네시아',
            'indonesian': '인도네시아',
            
            # 기타
            'yemen': '예멘',
            'rwanda': '르완다',
            'burundi': '부룬디',
            'panama': '파나마',
            'el salvador': '엘살바도르',
            'nicaragua': '니카라과',
            'honduras': '온두라스',
            'tanzania': '탄자니아',
            'mexico': '멕시코'
        }
        
        # 가공방식 매핑
        self.process_mapping = {
            'washed': '워시드',
            'natural': '내추럴',
            'honey': '허니',
            'pulped natural': '펄프드내추럴',
            'pulped': '펄프드',
            'anaerobic': '혐기성',
            'wet': '수세식',
            'dry': '건조식'
        }
        
        # 품종 매핑
        self.variety_mapping = {
            'geisha': '게이샤',
            'gesha': '게이샤',
            'bourbon': '버번',
            'typica': '티피카',
            'catuai': '카투아이',
            'caturra': '카투라',
            'pacamara': '파카마라'
        }
        
        # 로스팅 레벨 매핑
        self.roast_mapping = {
            'light': '라이트',
            'medium': '미디엄',
            'medium-dark': '미디엄 다크',
            'medium dark': '미디엄 다크',
            'dark': '다크'
        }
        
        # 무게 패턴
        self.weight_pattern = re.compile(r'(\d+)\s*[gG]')
        
        # 가격 패턴
        self.price_pattern = re.compile(r'(\d{1,3}(?:,\d{3})*|\d+)(?:\s*원|\s*₩)?')
    
    def normalize(self, bean_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        원두 데이터 정규화
        
        Args:
            bean_data: 정규화할 원두 데이터 딕셔너리
            
        Returns:
            정규화된 원두 데이터 딕셔너리
        """
        # 복사본 생성
        normalized = bean_data.copy()
        
        # 필수 필드 확인
        if 'name' not in normalized or not normalized['name']:
            logger.warning("원두 이름이 없습니다")
            normalized['name'] = "알 수 없는 원두"
        
        if 'brand' not in normalized or not normalized['brand']:
            logger.warning("브랜드 이름이 없습니다")
            normalized['brand'] = "알 수 없는 브랜드"
        
        # 가격 정규화
        normalized = self._normalize_price(normalized)
        
        # 원산지 정규화
        normalized = self._normalize_origin(normalized)
        
        # 가공방식 정규화
        normalized = self._normalize_processing(normalized)
        
        # 품종 정규화
        normalized = self._normalize_variety(normalized)
        
        # 로스팅 레벨 정규화
        normalized = self._normalize_roast_level(normalized)
        
        # 무게 정규화
        normalized = self._normalize_weight(normalized)
        
        # 향미 노트 정규화
        normalized = self._normalize_flavors(normalized)
        
        return normalized
    
    def _normalize_price(self, bean_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        가격 정규화
        
        Args:
            bean_data: 원두 데이터
            
        Returns:
            가격이 정규화된 원두 데이터
        """
        result = bean_data.copy()
        
        # 이미 정수형 가격이 있으면 그대로 사용
        if 'price' in result and isinstance(result['price'], (int, float)):
            # 정수로 변환
            result['price'] = int(result['price'])
            return result
        
        # 가격 문자열에서 추출 시도
        if 'price' in result and isinstance(result['price'], str):
            price_str = result['price']
            match = self.price_pattern.search(price_str)
            if match:
                price_value = match.group(1).replace(',', '')
                try:
                    result['price'] = int(price_value)
                    return result
                except ValueError:
                    logger.warning(f"가격 변환 실패: {price_str}")
        
        # 이름에서 추출 시도
        if 'name' in result:
            name = result['name']
            match = self.price_pattern.search(name)
            if match:
                price_value = match.group(1).replace(',', '')
                try:
                    result['price'] = int(price_value)
                    return result
                except ValueError:
                    pass
        
        # 설명에서 추출 시도
        if 'description' in result:
            desc = result['description']
            match = self.price_pattern.search(desc)
            if match:
                price_value = match.group(1).replace(',', '')
                try:
                    result['price'] = int(price_value)
                    return result
                except ValueError:
                    pass
        
        # 가격 정보가 없으면 0으로 설정
        if 'price' not in result:
            result['price'] = 0
            logger.warning("가격 정보를 찾을 수 없음, 0으로 설정")
        
        return result
    
    def _normalize_origin(self, bean_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        원산지 정규화
        
        Args:
            bean_data: 원두 데이터
            
        Returns:
            원산지가 정규화된 원두 데이터
        """
        result = bean_data.copy()
        
        # 이미 원산지 정보가 있으면 매핑 확인
        if 'origin' in result and result['origin']:
            origin_lower = result['origin'].lower()
            if origin_lower in self.origin_mapping:
                result['origin'] = self.origin_mapping[origin_lower]
            return result
        
        # 이름에서 원산지 추출 시도
        if 'name' in result:
            name_lower = result['name'].lower()
            for key, value in self.origin_mapping.items():
                if key in name_lower:
                    result['origin'] = value
                    return result
                # 한글 원산지가 이름에 포함된 경우 (예: '에티오피아', '케냐' 등)
                elif value.lower() in name_lower:
                    result['origin'] = value
                    return result
        
        # 설명에서 원산지 추출 시도
        if 'description' in result and result['description']:
            desc_lower = result['description'].lower()
            for key, value in self.origin_mapping.items():
                if key in desc_lower:
                    result['origin'] = value
                    return result
                # 한글 원산지가 설명에 포함된 경우
                elif value.lower() in desc_lower:
                    result['origin'] = value
                    return result
        
        return result
    
    def _normalize_processing(self, bean_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        가공방식 정규화
        
        Args:
            bean_data: 원두 데이터
            
        Returns:
            가공방식이 정규화된 원두 데이터
        """
        result = bean_data.copy()
        
        # 이미 가공방식 정보가 있으면 매핑 확인
        if 'processing' in result and result['processing']:
            process_lower = result['processing'].lower()
            if process_lower in self.process_mapping:
                result['processing'] = self.process_mapping[process_lower]
            return result
        
        # 이름에서 가공방식 추출 시도
        if 'name' in result:
            name_lower = result['name'].lower()
            for key, value in self.process_mapping.items():
                if key in name_lower:
                    result['processing'] = value
                    return result
                # 한글 가공방식이 이름에 포함된 경우
                elif value.lower() in name_lower:
                    result['processing'] = value
                    return result
        
        # 설명에서 가공방식 추출 시도
        if 'description' in result and result['description']:
            desc_lower = result['description'].lower()
            for key, value in self.process_mapping.items():
                if key in desc_lower:
                    result['processing'] = value
                    return result
                # 한글 가공방식이 설명에 포함된 경우
                elif value.lower() in desc_lower:
                    result['processing'] = value
                    return result
        
        # 가공방식을 찾지 못한 경우, 기본값 설정
        if 'processing' not in result:
            result['processing'] = '알 수 없음'
        
        return result
    
    def _normalize_variety(self, bean_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        품종 정규화
        
        Args:
            bean_data: 원두 데이터
            
        Returns:
            품종이 정규화된 원두 데이터
        """
        result = bean_data.copy()
        
        # 이미 품종 정보가 있으면 매핑 확인
        if 'variety' in result and result['variety']:
            variety_lower = result['variety'].lower()
            if variety_lower in self.variety_mapping:
                result['variety'] = self.variety_mapping[variety_lower]
            return result
        
        # 이름에서 품종 추출 시도
        if 'name' in result:
            name_lower = result['name'].lower()
            for key, value in self.variety_mapping.items():
                if key in name_lower:
                    result['variety'] = value
                    return result
        
        # 설명에서 품종 추출 시도
        if 'description' in result:
            desc_lower = result['description'].lower()
            for key, value in self.variety_mapping.items():
                if key in desc_lower:
                    result['variety'] = value
                    return result
        
        return result
    
    def _normalize_roast_level(self, bean_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        로스팅 레벨 정규화
        
        Args:
            bean_data: 원두 데이터
            
        Returns:
            로스팅 레벨이 정규화된 원두 데이터
        """
        result = bean_data.copy()
        
        # 이미 로스팅 레벨 정보가 있으면 매핑 확인
        if 'roast_level' in result and result['roast_level']:
            roast_lower = result['roast_level'].lower()
            if roast_lower in self.roast_mapping:
                result['roast_level'] = self.roast_mapping[roast_lower]
            return result
        
        # 직접 정의한 로스팅 레벨 패턴
        roast_patterns = {
            r'(light|라이트)\s*로스팅': '라이트',
            r'(medium|미디엄)\s*로스팅': '미디엄',
            r'(medium.?dark|미디엄.?다크)\s*로스팅': '미디엄 다크',
            r'(dark|다크)\s*로스팅': '다크'
        }
        
        # 이름에서 로스팅 레벨 추출 시도
        if 'name' in result:
            name_lower = result['name'].lower()
            
            # 정규 표현식 패턴 확인
            for pattern, value in roast_patterns.items():
                if re.search(pattern, name_lower):
                    result['roast_level'] = value
                    return result
            
            # 키워드 매핑 확인
            for key, value in self.roast_mapping.items():
                if key in name_lower:
                    result['roast_level'] = value
                    return result
                elif value.lower() in name_lower:
                    result['roast_level'] = value
                    return result
        
        # 설명에서 로스팅 레벨 추출 시도
        if 'description' in result and result['description']:
            desc_lower = result['description'].lower()
            
            # 정규 표현식 패턴 확인
            for pattern, value in roast_patterns.items():
                if re.search(pattern, desc_lower):
                    result['roast_level'] = value
                    return result
            
            # 키워드 매핑 확인
            for key, value in self.roast_mapping.items():
                if key in desc_lower:
                    result['roast_level'] = value
                    return result
                elif value.lower() in desc_lower:
                    result['roast_level'] = value
                    return result
        
        return result
    
    def _normalize_weight(self, bean_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        무게 정규화
        
        Args:
            bean_data: 원두 데이터
            
        Returns:
            무게가 정규화된 원두 데이터
        """
        result = bean_data.copy()
        
        # 이미 무게 정보가 있으면 그대로 사용
        if 'weight_g' in result and result['weight_g']:
            if isinstance(result['weight_g'], str):
                # 문자열이면 숫자만 추출
                try:
                    result['weight_g'] = int(re.sub(r'[^\d]', '', result['weight_g']))
                except ValueError:
                    pass
            return result
        
        # 이름에서 무게 추출 시도
        if 'name' in result:
            match = self.weight_pattern.search(result['name'])
            if match:
                try:
                    result['weight_g'] = int(match.group(1))
                    return result
                except ValueError:
                    pass
        
        # 설명에서 무게 추출 시도
        if 'description' in result:
            match = self.weight_pattern.search(result['description'])
            if match:
                try:
                    result['weight_g'] = int(match.group(1))
                    return result
                except ValueError:
                    pass
        
        # 기본 무게 설정 (대부분 200g 기준)
        if 'weight_g' not in result:
            result['weight_g'] = 200
        
        return result
    
    def _normalize_flavors(self, bean_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        향미 노트 정규화
        
        Args:
            bean_data: 원두 데이터
            
        Returns:
            향미 노트가 정규화된 원두 데이터
        """
        result = bean_data.copy()
        
        # 이미 향미 정보가 있으면 확인
        if 'flavors' in result and result['flavors']:
            # 문자열인 경우 분리
            if isinstance(result['flavors'], str):
                # 쉼표로 분리
                flavors_list = [f.strip() for f in result['flavors'].split(',')]
                # 빈 문자열 제거
                flavors_list = [f for f in flavors_list if f]
                result['flavors'] = flavors_list
            return result
        
        # 설명에서 향미 추출 시도 (향, 노트, 풍미 등의 키워드 찾기)
        if 'description' in result:
            # TODO: 향미 추출 로직 개선
            # 현재는 구현하지 않음
            pass
        
        # 기본 빈 목록 설정
        if 'flavors' not in result:
            result['flavors'] = []
        
        return result

# 글로벌 정규화기 인스턴스
_normalizer = None

def get_normalizer() -> BeanNormalizer:
    """
    정규화기 인스턴스 반환
    
    Returns:
        BeanNormalizer 인스턴스
    """
    global _normalizer
    if _normalizer is None:
        _normalizer = BeanNormalizer()
    return _normalizer

def normalize_bean(bean_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    원두 데이터 정규화 함수
    
    Args:
        bean_data: 정규화할 원두 데이터
        
    Returns:
        정규화된 원두 데이터
    """
    normalizer = get_normalizer()
    return normalizer.normalize(bean_data)

def normalize_beans(beans_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    원두 데이터 목록 정규화 함수
    
    Args:
        beans_data: 정규화할 원두 데이터 목록
        
    Returns:
        정규화된 원두 데이터 목록
    """
    normalizer = get_normalizer()
    return [normalizer.normalize(bean) for bean in beans_data] 
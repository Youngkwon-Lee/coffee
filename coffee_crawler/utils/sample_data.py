"""
샘플 데이터 생성 모듈

이 모듈은 테스트 및 개발 목적으로 샘플 원두 데이터를 생성합니다.
"""

import os
import json
import random
from typing import List, Dict, Any, Optional
from datetime import datetime

def generate_sample_beans(count: int = 10, cafe_id: str = "sample_cafe") -> List[Dict[str, Any]]:
    """
    샘플 원두 데이터 생성
    
    Args:
        count: 생성할 원두 수
        cafe_id: 카페 ID
        
    Returns:
        샘플 원두 목록
    """
    origins = [
        "에티오피아", "케냐", "콜롬비아", "과테말라", "코스타리카", 
        "브라질", "인도네시아", "르완다", "부룬디", "예멘"
    ]
    
    regions = {
        "에티오피아": ["예가체프", "시다모", "구지", "리무"],
        "케냐": ["키암부", "니에리", "키리냐가"],
        "콜롬비아": ["우일라", "나리뇨", "안티오키아"],
        "과테말라": ["안티구아", "우에우에테낭고", "아티틀란"],
        "코스타리카": ["타라주", "웨스트밸리", "센트럴밸리"],
        "브라질": ["세하도", "술데미나스", "상파울로"],
        "인도네시아": ["수마트라", "토라자", "발리"],
        "르완다": ["부퀴라", "니안자", "후예"],
        "부룬디": ["카얌반지", "음뷔지", "부반자"],
        "예멘": ["마타리", "하라즈", "라이미"]
    }
    
    processes = ["워시드", "내추럴", "허니", "펄프드내추럴", "아나에어로빅"]
    
    varieties = ["티피카", "버번", "게이샤", "카투아이", "파카마라", "SL28", "카투라"]
    
    roast_levels = ["라이트", "미디엄", "미디엄 다크", "다크"]
    
    flavor_notes = [
        "초콜릿", "캐러멜", "헤이즐넛", "아몬드", "견과류", 
        "베리", "블루베리", "스트로베리", "체리", "건포도",
        "시트러스", "레몬", "오렌지", "라임", "자몽",
        "복숭아", "망고", "파인애플", "열대과일", "사과",
        "꽃향", "자스민", "로즈", "얼그레이", "바닐라"
    ]
    
    weights = [200, 250, 500, 1000]
    
    base_prices = {
        200: (15000, 25000),
        250: (18000, 30000),
        500: (30000, 50000),
        1000: (55000, 90000)
    }
    
    cafe_names = {
        "sample_cafe": "샘플 카페",
        "centercoffee": "센터커피",
        "fritz": "프릳츠커피",
        "nomad": "노마드 커피",
        "gray": "그레이 커피",
        "manufact": "매뉴팩트 커피"
    }
    
    # 카페명
    cafe_name = cafe_names.get(cafe_id, "샘플 카페")
    
    beans = []
    
    for i in range(count):
        # 원산지 선택
        origin = random.choice(origins)
        region = random.choice(regions.get(origin, [""])) if random.random() > 0.3 else ""
        
        # 가공방식 선택
        processing = random.choice(processes)
        
        # 품종 선택 (50% 확률로 추가)
        variety = random.choice(varieties) if random.random() > 0.5 else None
        
        # 무게 선택
        weight_g = random.choice(weights)
        
        # 가격 계산
        base_min, base_max = base_prices.get(weight_g, (15000, 25000))
        price = random.randint(base_min, base_max)
        
        # 품종이 게이샤면 가격 상향
        if variety and "게이샤" in variety:
            price = int(price * 1.7)
        
        # 향미 노트 (2-5개 선택)
        flavors_count = random.randint(2, 5)
        flavors = random.sample(flavor_notes, flavors_count)
        
        # 로스팅 레벨
        roast_level = random.choice(roast_levels)
        
        # 이름 생성
        name_parts = []
        if random.random() > 0.3:
            name_parts.append(origin)
        if region and random.random() > 0.4:
            name_parts.append(region)
        if variety and random.random() > 0.5:
            name_parts.append(variety)
        if random.random() > 0.7:
            name_parts.append(processing)
        
        # 최소한 하나의 요소 추가
        if not name_parts:
            name_parts.append(origin)
        
        name = " ".join(name_parts)
        
        # 이름이 짧으면 일련번호 추가
        if len(name) < 10:
            name = f"{name} #{i+1}"
        
        # 무게 추가
        name = f"{name} ({weight_g}g)"
        
        # 샘플 URL 생성
        url = f"https://example.com/{cafe_id}/beans/{origin.lower().replace(' ', '-')}-{i+1}"
        
        # 샘플 이미지 URL 생성 (외부 서비스 사용)
        image_id = random.randint(1, 100)
        image_url = f"https://picsum.photos/id/{image_id}/400/400"
        
        # 설명 생성
        description = f"{origin}"
        if region:
            description += f" {region}"
        if variety:
            description += f", {variety} 품종"
        description += f"의 {processing} 프로세스 원두입니다. "
        description += f"{', '.join(flavors[:2])}과 같은 풍미가 특징입니다."
        
        # 원두 데이터 생성
        bean = {
            "name": name,
            "brand": cafe_name,
            "price": price,
            "origin": origin,
            "weight_g": weight_g,
            "roast_level": roast_level,
            "flavors": flavors,
            "processing": processing,
            "variety": variety,
            "description": description,
            "images": [image_url],
            "url": url,
            "cafe_id": cafe_id,
            "isActive": True,
            "createdAt": datetime.now().isoformat(),
            "lastUpdated": datetime.now().isoformat()
        }
        
        # None 값 필드 제거
        bean = {k: v for k, v in bean.items() if v is not None}
        
        beans.append(bean)
    
    return beans

def save_sample_data(beans: List[Dict[str, Any]], output_file: str) -> None:
    """
    샘플 데이터를 파일로 저장
    
    Args:
        beans: 원두 데이터 목록
        output_file: 출력 파일 경로
    """
    # 디렉토리 생성
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    
    # JSON 파일로 저장
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(beans, f, ensure_ascii=False, indent=2)
    
    print(f"샘플 데이터 저장 완료: {output_file}")

def load_sample_data(input_file: str) -> List[Dict[str, Any]]:
    """
    샘플 데이터 파일 로드
    
    Args:
        input_file: 입력 파일 경로
        
    Returns:
        원두 데이터 목록
    """
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"샘플 데이터 로드 실패: {e}")
        return []

# 스크립트로 실행 시
if __name__ == "__main__":
    # 각 카페별 샘플 데이터 생성
    cafes = ["centercoffee", "fritz", "nomad", "gray", "manufact"]
    
    for cafe_id in cafes:
        # 샘플 원두 생성 (5-15개)
        count = random.randint(5, 15)
        beans = generate_sample_beans(count, cafe_id)
        
        # 파일로 저장
        output_file = f"tests/samples/{cafe_id}_beans.json"
        save_sample_data(beans, output_file) 
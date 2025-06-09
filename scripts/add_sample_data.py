#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Firebase에 샘플 원두 데이터 추가 스크립트
"""

import json
from datetime import datetime
import sys
import os

# 프로젝트 루트를 Python 경로에 추가
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def create_sample_beans():
    """샘플 원두 데이터 생성"""
    sample_beans = [
        {
            "name": "에티오피아 예가체프 G1",
            "brand": "센터커피",
            "price": 18000,
            "origin": "에티오피아",
            "weight_g": 250,
            "roast_level": "라이트",
            "flavors": ["플로럴", "레몬", "베르가못"],
            "processing": "워시드",
            "variety": "헤이룸",
            "description": "에티오피아 예가체프 지역의 고품질 아라비카 원두입니다.",
            "images": ["https://picsum.photos/id/10/400/400"],
            "url": "https://centercoffee.co.kr/sample1",
            "cafe_id": "centercoffee",
            "isActive": True,
            "createdAt": datetime.now(),
            "lastUpdated": datetime.now()
        },
        {
            "name": "콜롬비아 수프리모",
            "brand": "로우키커피",
            "price": 16500,
            "origin": "콜롬비아",
            "weight_g": 200,
            "roast_level": "미디엄",
            "flavors": ["초콜릿", "견과류", "카라멜"],
            "processing": "워시드",
            "variety": "카투라",
            "description": "콜롬비아의 대표적인 고급 원두 수프리모입니다.",
            "images": ["https://picsum.photos/id/20/400/400"],
            "url": "https://lowkeycoffee.com/sample2",
            "cafe_id": "lowkey",
            "isActive": True,
            "createdAt": datetime.now(),
            "lastUpdated": datetime.now()
        },
        {
            "name": "과테말라 안티구아",
            "brand": "엘카페",
            "price": 22000,
            "origin": "과테말라",
            "weight_g": 250,
            "roast_level": "미디엄다크",
            "flavors": ["스파이시", "다크초콜릿", "스모키"],
            "processing": "워시드",
            "variety": "부르봉",
            "description": "과테말라 안티구아 지역의 화산토 재배 원두입니다.",
            "images": ["https://picsum.photos/id/30/400/400"],
            "url": "https://elcafe.co.kr/sample3",
            "cafe_id": "elcafe",
            "isActive": True,
            "createdAt": datetime.now(),
            "lastUpdated": datetime.now()
        }
    ]
    
    return sample_beans

def add_to_firebase():
    """Firebase에 샘플 데이터 추가"""
    try:
        from coffee_crawler.storage.firebase_client import FirebaseClient
        
        firebase_client = FirebaseClient()
        
        if not firebase_client.is_available():
            print("❌ Firebase를 사용할 수 없습니다. 서비스 계정 키를 확인하세요.")
            return False
        
        sample_beans = create_sample_beans()
        
        success_count = 0
        for bean_data in sample_beans:
            try:
                if firebase_client.add_bean(bean_data):
                    success_count += 1
                    print(f"✅ {bean_data['name']} 추가 성공")
                else:
                    print(f"❌ {bean_data['name']} 추가 실패")
            except Exception as e:
                print(f"❌ {bean_data['name']} 추가 중 오류: {e}")
        
        print(f"\n📊 총 {success_count}/{len(sample_beans)}개 원두 추가 완료")
        return success_count > 0
        
    except ImportError as e:
        print(f"❌ 필요한 모듈을 가져올 수 없습니다: {e}")
        return False
    except Exception as e:
        print(f"❌ Firebase 연결 중 오류 발생: {e}")
        return False

def save_as_json():
    """JSON 파일로도 저장"""
    sample_beans = create_sample_beans()
    
    # datetime 객체를 문자열로 변환
    for bean in sample_beans:
        bean['createdAt'] = bean['createdAt'].isoformat()
        bean['lastUpdated'] = bean['lastUpdated'].isoformat()
    
    os.makedirs('data', exist_ok=True)
    with open('data/sample_beans.json', 'w', encoding='utf-8') as f:
        json.dump(sample_beans, f, ensure_ascii=False, indent=2)
    
    print("💾 샘플 데이터를 data/sample_beans.json에 저장했습니다.")

if __name__ == "__main__":
    print("🌱 Firebase에 샘플 원두 데이터 추가 중...")
    
    # JSON 파일로 저장
    save_as_json()
    
    # Firebase에 추가 시도
    if not add_to_firebase():
        print("\n⚠️ Firebase 추가 실패. 서비스 계정 키 설정 후 다시 시도하세요.")
        print("📁 대신 data/sample_beans.json 파일을 확인하세요.")
    
    print("\n🌐 웹앱에서 http://localhost:3000/beans 페이지를 확인하세요.") 
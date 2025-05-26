#!/usr/bin/env python
"""
크롤러 테스트 스크립트
"""

import os
import sys
import json
from datetime import datetime

# 프로젝트 루트 경로를 시스템 경로에 추가
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

# 로깅 설정
import logging
logging.basicConfig(level=logging.INFO)

# 모델 테스트
def test_models():
    print("\n=== 모델 테스트 ===")
    from coffee_crawler.models.bean import Bean
    from coffee_crawler.models.cafe import Cafe
    
    # Bean 모델 테스트
    bean = Bean(
        name="에티오피아 예가체프",
        brand="테스트 카페",
        price=15000,
        origin="에티오피아",
        weight_g=200,
        roast_level="Medium",
        flavors=["Fruity", "Floral"],
        processing="Washed"
    )
    
    print(f"Bean 객체 생성: {bean.name}, {bean.origin}, {bean.price}원")
    print(f"ID: {bean.id}")
    print(f"해시: {bean.hash}")
    
    # Cafe 모델 테스트
    cafe = Cafe(
        id="testcafe",
        name="테스트 카페",
        url="https://example.com"
    )
    
    print(f"Cafe 객체 생성: {cafe.name}, {cafe.url}")
    print(f"생성시간: {cafe.createdAt}")

# 설정 로더 테스트
def test_config_loader():
    print("\n=== 설정 로더 테스트 ===")
    from coffee_crawler.utils.config_loader import load_crawler_config, load_firebase_config
    
    # 크롤러 설정 로드
    crawler_config = load_crawler_config()
    print("크롤러 설정:")
    print(f"- 카페 수: {len(crawler_config.get('cafes', {}))}")
    for cafe_id, cafe_config in crawler_config.get('cafes', {}).items():
        print(f"- {cafe_id}: {cafe_config.get('label')}, {cafe_config.get('type')}")
    
    # Firebase 설정 로드
    firebase_config = load_firebase_config()
    print("\nFirebase 설정:")
    print(f"- 프로젝트 ID: {firebase_config.get('firebase', {}).get('project_id')}")
    print(f"- 인증 방식: {firebase_config.get('firebase', {}).get('auth_method')}")

# HTTP 클라이언트 테스트
def test_http_client():
    print("\n=== HTTP 클라이언트 테스트 ===")
    from coffee_crawler.utils.http_client import get
    
    # 테스트 URL로 GET 요청
    response, success = get("https://httpbin.org/get")
    
    if success:
        print(f"HTTP 요청 성공: {response.status_code}")
        data = response.json()
        print(f"응답 데이터: {json.dumps(data, indent=2)}")
    else:
        print(f"HTTP 요청 실패: {response.status_code}")

# Shopify RSS 크롤러 테스트
def test_shopify_crawler():
    print("\n=== Shopify RSS 크롤러 테스트 ===")
    
    try:
        from coffee_crawler.crawlers.shopify_rss_crawler import ShopifyRssCrawler
        
        # 테스트 설정
        config = {
            'label': '센터커피',
            'url': 'https://centercoffee.co.kr/collections/all.atom',
            'type': 'shopify_rss',
            'active': True
        }
        
        # 크롤러 생성
        crawler = ShopifyRssCrawler('centercoffee', config)
        
        # 크롤링 실행 (테스트 모드)
        print("크롤링 시작...")
        results = crawler.crawl(test_mode=True)
        
        # 결과 확인
        print(f"크롤링 결과: {len(results)}개 항목")
        
        if results:
            # 첫 번째 결과만 출력
            first_result = results[0]
            print("\n첫 번째 원두 정보:")
            print(f"- 이름: {first_result.get('name')}")
            print(f"- 브랜드: {first_result.get('brand')}")
            print(f"- 가격: {first_result.get('price')}원")
            print(f"- 원산지: {first_result.get('origin')}")
            print(f"- 이미지: {len(first_result.get('images', []))}개")
            
    except Exception as e:
        print(f"크롤러 테스트 중 오류 발생: {e}")

if __name__ == "__main__":
    # 모델 테스트
    test_models()
    
    # 설정 로더 테스트
    test_config_loader()
    
    # HTTP 클라이언트 테스트
    test_http_client()
    
    # 사용자 입력을 받아 크롤러 테스트 실행 여부 결정
    try:
        run_crawler = input("\n크롤러 테스트를 실행하시겠습니까? (y/n): ").strip().lower() == 'y'
        if run_crawler:
            test_shopify_crawler()
    except KeyboardInterrupt:
        print("\n테스트 중단됨")
        sys.exit(0) 
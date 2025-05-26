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

# 샘플 데이터 생성 테스트
def test_sample_data():
    print("\n=== 샘플 데이터 생성 테스트 ===")
    
    try:
        from coffee_crawler.utils.sample_data import generate_sample_beans, save_sample_data
        
        # 샘플 데이터 생성
        cafe_id = 'centercoffee'
        count = 5
        
        print(f"{cafe_id} 샘플 데이터 {count}개 생성 중...")
        beans = generate_sample_beans(count, cafe_id)
        
        # 결과 확인
        print(f"샘플 데이터 생성 완료: {len(beans)}개")
        
        # 첫 번째 샘플 출력
        first_bean = beans[0]
        print("\n첫 번째 샘플 원두:")
        print(f"- 이름: {first_bean.get('name')}")
        print(f"- 브랜드: {first_bean.get('brand')}")
        print(f"- 가격: {first_bean.get('price')}원")
        print(f"- 원산지: {first_bean.get('origin')}")
        
        # 저장 여부 확인
        save_option = input("\n샘플 데이터를 파일로 저장하시겠습니까? (y/n): ").strip().lower() == 'y'
        if save_option:
            sample_dir = os.path.join(os.path.dirname(__file__), 'tests', 'samples')
            os.makedirs(sample_dir, exist_ok=True)
            output_file = os.path.join(sample_dir, f'{cafe_id}_beans.json')
            save_sample_data(beans, output_file)
            
    except Exception as e:
        print(f"샘플 데이터 생성 중 오류 발생: {e}")

# Shopify RSS 크롤러 테스트
def test_shopify_crawler():
    print("\n=== Shopify RSS 크롤러 테스트 ===")
    
    try:
        from coffee_crawler.crawlers.shopify_rss_crawler import ShopifyRssCrawler
        from coffee_crawler.utils.sample_data import generate_sample_beans, save_sample_data
        
        # 테스트 설정
        config = {
            'label': '센터커피',
            'url': 'https://centercoffee.co.kr/collections/coffee/rss.xml',
            'product_url': 'https://centercoffee.co.kr/collections/coffee',
            'type': 'shopify_rss',
            'active': True,
            'backup_method': 'html'
        }
        
        # 크롤러 생성
        crawler = ShopifyRssCrawler('centercoffee', config)
        
        # 크롤링 실행 (테스트 모드)
        print("크롤링 시작...")
        results = crawler.crawl(test_mode=True)
        
        # 결과가 없으면 샘플 데이터 사용
        if not results:
            print("실제 크롤링 결과가 없어 샘플 데이터를 생성합니다.")
            results = generate_sample_beans(5, 'centercoffee')
            
            # 샘플 저장 여부 확인
            save_option = input("샘플 데이터를 파일로 저장하시겠습니까? (y/n): ").strip().lower() == 'y'
            if save_option:
                sample_dir = os.path.join(os.path.dirname(__file__), 'tests', 'samples')
                os.makedirs(sample_dir, exist_ok=True)
                output_file = os.path.join(sample_dir, 'centercoffee_beans.json')
                save_sample_data(results, output_file)
        
        # 결과 확인
        print(f"결과: {len(results)}개 원두 정보")
        
        if results:
            # 첫 번째 결과만 출력
            first_result = results[0]
            print("\n첫 번째 원두 정보:")
            print(f"- 이름: {first_result.get('name')}")
            print(f"- 브랜드: {first_result.get('brand')}")
            print(f"- 가격: {first_result.get('price')}원")
            print(f"- 원산지: {first_result.get('origin', '정보 없음')}")
            print(f"- 가공방식: {first_result.get('processing', '정보 없음')}")
            print(f"- 이미지: {len(first_result.get('images', []))}개")
            
    except Exception as e:
        print(f"크롤러 테스트 중 오류 발생: {e}")

if __name__ == "__main__":
    # 테스트 메뉴 표시
    print("\n=== 커피 원두 크롤러 테스트 ===")
    print("1. 모델 테스트")
    print("2. 설정 로더 테스트")
    print("3. HTTP 클라이언트 테스트")
    print("4. 샘플 데이터 생성 테스트")
    print("5. Shopify RSS 크롤러 테스트")
    print("0. 모든 테스트 실행")
    print("q. 종료")
    
    choice = input("\n테스트 선택: ").strip().lower()
    
    try:
        if choice == '1':
            test_models()
        elif choice == '2':
            test_config_loader()
        elif choice == '3':
            test_http_client()
        elif choice == '4':
            test_sample_data()
        elif choice == '5':
            test_shopify_crawler()
        elif choice == '0':
            test_models()
            test_config_loader()
            test_http_client()
            test_sample_data()
            test_shopify_crawler()
        elif choice == 'q':
            sys.exit(0)
        else:
            print("올바른 옵션을 선택하세요.")
    except KeyboardInterrupt:
        print("\n테스트 중단됨")
        sys.exit(0) 
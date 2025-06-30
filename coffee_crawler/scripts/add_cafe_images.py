#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
카페 이미지 크롤링 통합 스크립트

기존 카페들에 이미지 크롤링을 추가하여 Firebase에 저장
"""

import os
import sys
import logging
from typing import Dict, Any

# 프로젝트 루트를 Python 경로에 추가
script_dir = os.path.dirname(os.path.abspath(__file__))
coffee_crawler_dir = os.path.dirname(script_dir)
project_root = os.path.dirname(coffee_crawler_dir)
sys.path.insert(0, project_root)

from coffee_crawler.crawlers.cafe_image_crawler import CafeImageCrawler
from coffee_crawler.storage.firebase_client import FirebaseClient

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.ConsoleHandler(),
        logging.FileHandler('cafe_image_crawling.log', encoding='utf-8')
    ]
)

logger = logging.getLogger(__name__)

# 기존 카페 설정 (실제 카페 정보)
CAFE_CONFIGS = {
    "centercoffee-hongdae": {
        "label": "센터커피 홍대점",
        "url": "https://www.centercoffee.com",
        "address": "서울 마포구 홍익로 69",
        "phone": "02-333-5454",
        "hours": "08:00-22:00",
        "image_keywords": ["center", "coffee", "hongdae", "센터커피", "매장", "interior"]
    },
    "fritz-coffee-itaewon": {
        "label": "프리츠커피 이태원점", 
        "url": "https://www.fritzcoffee.co.kr",
        "address": "서울 용산구 이태원로 44",
        "phone": "02-797-2731",
        "hours": "07:30-21:00",
        "image_keywords": ["fritz", "coffee", "itaewon", "프리츠", "매장", "roastery"]
    },
    "lowkey-coffee-gangnam": {
        "label": "로우키 강남점",
        "url": "https://www.instagram.com/lowkey_coffee",
        "address": "서울 강남구 테헤란로 152",
        "phone": "02-555-1234",
        "hours": "08:00-20:00", 
        "image_keywords": ["lowkey", "coffee", "gangnam", "로우키", "매장", "minimal"]
    },
    "terarosa-seoul": {
        "label": "테라로사 서울점",
        "url": "https://www.terarosa.com",
        "address": "서울 중구 명동길 26",
        "phone": "02-318-0099",
        "hours": "08:00-22:00",
        "image_keywords": ["terarosa", "coffee", "seoul", "테라로사", "매장", "classic"]
    },
    "momos-coffee-yeonnam": {
        "label": "모모스커피 연남점",
        "url": "https://www.instagram.com/momos_coffee",
        "address": "서울 마포구 연남로 1길 35",
        "phone": "02-6052-1234",
        "hours": "09:00-21:00",
        "image_keywords": ["momos", "coffee", "yeonnam", "모모스", "매장", "cozy"]
    }
}

def crawl_cafe_image(cafe_id: str, config: Dict[str, Any]) -> Dict[str, Any]:
    """단일 카페 이미지 크롤링"""
    try:
        logger.info(f"카페 이미지 크롤링 시작: {cafe_id}")
        
        # 카페 이미지 크롤러 생성
        crawler = CafeImageCrawler(cafe_id, config)
        
        # 이미지 크롤링 실행
        result = crawler.crawl_cafe_images()
        
        logger.info(f"카페 이미지 크롤링 완료: {cafe_id}")
        return result
        
    except Exception as e:
        logger.error(f"카페 이미지 크롤링 실패: {cafe_id}, 에러: {str(e)}")
        return {
            'cafe_id': cafe_id,
            'image_url': None,
            'error': str(e)
        }

def update_cafe_with_image(firebase_client: FirebaseClient, cafe_id: str, image_url: str) -> bool:
    """Firebase에서 카페 이미지 업데이트"""
    try:
        if not firebase_client.is_available():
            logger.warning("Firebase를 사용할 수 없습니다")
            return False
        
        # 카페 문서 업데이트
        doc_ref = firebase_client.db.collection('cafes').document(cafe_id)
        doc_ref.update({
            'imageUrl': image_url,
            'lastUpdated': firebase_client.firestore.SERVER_TIMESTAMP
        })
        
        logger.info(f"카페 이미지 업데이트 완료: {cafe_id}")
        return True
        
    except Exception as e:
        logger.error(f"카페 이미지 업데이트 실패: {cafe_id}, 에러: {str(e)}")
        return False

def main():
    """메인 실행 함수"""
    logger.info("카페 이미지 크롤링 시스템 시작")
    
    # Firebase 클라이언트 초기화
    firebase_client = FirebaseClient()
    
    if not firebase_client.is_available():
        logger.error("Firebase 연결 실패. 크롤링을 중단합니다.")
        return
    
    # 각 카페별 이미지 크롤링 실행
    total_cafes = len(CAFE_CONFIGS)
    successful_crawls = 0
    failed_crawls = 0
    
    for cafe_id, config in CAFE_CONFIGS.items():
        try:
            logger.info(f"처리 중: {cafe_id} ({config['label']})")
            
            # 이미지 크롤링
            result = crawl_cafe_image(cafe_id, config)
            
            if result.get('image_url'):
                # Firebase에 이미지 URL 업데이트
                if update_cafe_with_image(firebase_client, cafe_id, result['image_url']):
                    successful_crawls += 1
                    logger.info(f"✅ 성공: {cafe_id} - {result['image_url']}")
                else:
                    failed_crawls += 1
                    logger.error(f"❌ Firebase 업데이트 실패: {cafe_id}")
            else:
                failed_crawls += 1
                error_msg = result.get('error', '이미지를 찾을 수 없음')
                logger.error(f"❌ 크롤링 실패: {cafe_id} - {error_msg}")
                
        except Exception as e:
            failed_crawls += 1
            logger.error(f"❌ 처리 중 오류: {cafe_id}, 에러: {str(e)}")
    
    # 결과 요약
    logger.info("="*60)
    logger.info("카페 이미지 크롤링 완료")
    logger.info(f"총 카페 수: {total_cafes}")
    logger.info(f"성공: {successful_crawls}")
    logger.info(f"실패: {failed_crawls}")
    logger.info(f"성공률: {(successful_crawls/total_cafes)*100:.1f}%")
    logger.info("="*60)

if __name__ == "__main__":
    main()
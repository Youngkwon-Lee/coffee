#!/usr/bin/env python
"""
커피 원두 크롤러 실행 스크립트

이 스크립트는 명령행에서 원두 크롤러를 실행하는 기능을 제공합니다.
다양한 커피 브랜드 웹사이트에서 원두 정보를 수집하고 Firebase Firestore에 저장합니다.

사용법:
    python run_crawler.py --cafe centercoffee  # 특정 카페 크롤링
    python run_crawler.py --all                # 모든 활성화된 카페 크롤링
    python run_crawler.py --test --cafe fritz  # 테스트 모드로 특정 카페 크롤링
    python run_crawler.py --dry-run --output beans.json  # 크롤링만 수행하고 파일로 저장
"""

import os
import sys
import json
import time
import logging
import argparse
import importlib
import traceback
from typing import List, Optional
from datetime import datetime, date

# 프로젝트 루트 경로 추가
sys.path.append(os.path.abspath(os.path.dirname(os.path.dirname(__file__))))

from coffee_crawler.utils.config_loader import load_crawler_config
from coffee_crawler.utils.logger import setup_logger
from coffee_crawler.utils.notification import get_notification_system

# 로거 설정
logger = setup_logger(name="coffee_crawler.script")

class DateTimeEncoder(json.JSONEncoder):
    """날짜/시간 JSON 인코더"""
    
    def default(self, obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        return super().default(obj)

def parse_args():
    """
    명령행 인수 파싱
    
    Returns:
        파싱된 명령행 인수
    """
    parser = argparse.ArgumentParser(description='커피 원두 크롤러')
    
    # 카페 선택 옵션
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--cafe', '-c', help='크롤링할 카페 ID')
    group.add_argument('--all', '-a', action='store_true', help='모든 활성화된 카페 크롤링')
    
    # 실행 옵션
    parser.add_argument('--dry-run', '-d', action='store_true', help='실제 데이터 저장 없이 크롤링만 수행')
    parser.add_argument('--output', '-o', help='크롤링 결과를 저장할 파일 경로')
    
    # 로깅 옵션
    parser.add_argument('--verbose', '-v', action='count', default=0, help='상세 로그 출력 (중복 사용 가능)')
    parser.add_argument('--quiet', '-q', action='store_true', help='오류 메시지만 출력')
    
    # 기타 옵션
    parser.add_argument('--test', '-t', action='store_true', help='테스트 모드 (샘플 데이터만 처리)')
    parser.add_argument('--notify', '-n', action='store_true', help='알림 활성화')
    
    return parser.parse_args()

def setup_logging(args):
    """
    명령행 인수에 따라 로깅 레벨 설정
    
    Args:
        args: 파싱된 명령행 인수
    """
    if args.quiet:
        log_level = logging.ERROR
    else:
        # 기본 로깅 레벨은 INFO
        log_level = logging.INFO
        
        # verbose 옵션에 따라 로깅 레벨 조정
        if args.verbose >= 1:
            log_level = logging.DEBUG
    
    # 루트 로거 레벨 설정
    logging.getLogger('coffee_crawler').setLevel(log_level)
    
    # CLI 로거 레벨 설정
    logger.setLevel(log_level)

def get_active_cafes() -> List[str]:
    """
    활성화된 카페 ID 목록 반환
    
    Returns:
        활성화된 카페 ID 목록
    """
    config = load_crawler_config()
    cafes = config.get('cafes', {})
    
    active_cafes = []
    for cafe_id, cafe_config in cafes.items():
        if cafe_config.get('active', False):
            active_cafes.append(cafe_id)
    
    return active_cafes

def run_crawler(cafe_id: str, dry_run: bool = False, test_mode: bool = False, output_path: Optional[str] = None, notify: bool = False):
    """
    지정된 카페의 크롤러 실행
    
    Args:
        cafe_id: 크롤링할 카페 ID
        dry_run: 실제 데이터 저장 없이 크롤링만 수행할지 여부
        test_mode: 테스트 모드 여부 (일부 데이터만 처리)
        output_path: 결과를 저장할 파일 경로
        notify: 알림 활성화 여부
        
    Returns:
        성공 여부 (True/False)
    """
    config = load_crawler_config()
    
    # 카페 설정 확인
    if cafe_id not in config.get('cafes', {}):
        logger.error(f"카페 ID '{cafe_id}'를 찾을 수 없습니다.")
        return False
    
    cafe_config = config['cafes'][cafe_id]
    cafe_name = cafe_config.get('label', cafe_id)
    
    # 카페 유형 확인
    crawler_type = cafe_config.get('type')
    if not crawler_type:
        logger.error(f"카페 '{cafe_id}'의 크롤러 유형이 정의되지 않았습니다.")
        return False
    
    logger.info(f"카페 '{cafe_id}' ({cafe_name}) 크롤링 시작...")
    start_time = time.time()
    
    try:
        # 크롤러 모듈 동적 임포트
        module_name = f"coffee_crawler.crawlers.{crawler_type}_crawler"
        crawler_module = importlib.import_module(module_name)
        
        # 크롤러 클래스 가져오기
        if crawler_type == "shopify_rss":
            crawler_class = getattr(crawler_module, "ShopifyRssCrawler")
        else:
            # 일반적인 경우 (html_crawler -> HtmlCrawler)
            try:
                # 대소문자를 구분하지 않고 클래스 이름 찾기 (현재 모듈에서 사용 가능한 클래스 찾기)
                class_name = f"{crawler_type.capitalize()}Crawler"
                if hasattr(crawler_module, class_name):
                    crawler_class = getattr(crawler_module, class_name)
                else:
                    # coffee_crawler/crawlers/__init__.py에서 가져오기
                    crawler_class = getattr(importlib.import_module("coffee_crawler.crawlers"), class_name)
            except (AttributeError, ImportError) as e:
                logger.error(f"크롤러 클래스를 찾을 수 없음: {class_name}, 오류: {e}")
                raise ImportError(f"크롤러 클래스를 찾을 수 없음: {class_name}")
        
        # 크롤러 인스턴스 생성 및 실행
        crawler = crawler_class(cafe_id, cafe_config)
        results = crawler.crawl(test_mode=test_mode)
        
        # 테스트 모드에서 결과가 없을 경우 샘플 데이터 생성
        if test_mode and not results:
            from coffee_crawler.utils.sample_data import generate_sample_beans
            logger.info(f"테스트 모드: 결과가 없어 샘플 데이터 생성")
            results = generate_sample_beans(5, cafe_id)
            
        elapsed_time = time.time() - start_time
        logger.info(f"'{cafe_id}' 크롤링 완료: {len(results)} 개의 원두 정보 수집, 소요시간: {elapsed_time:.2f}초")
        
        # 알림 전송
        if notify:
            notification_system = get_notification_system()
            notification_system.notify_success(cafe_id, cafe_name, len(results), elapsed_time)
        
        # dry_run이 아닌 경우 데이터 저장
        if not dry_run:
            # 프로세서 모듈 동적 임포트
            from coffee_crawler.processors.normalizer import normalize_beans
            from coffee_crawler.processors.duplicate_checker import deduplicate
            from coffee_crawler.storage.firebase_client import FirebaseClient
            
            # 데이터 정규화
            normalized_beans = normalize_beans(results)
            
            # 중복 검사
            unique_beans = deduplicate(normalized_beans)
            
            # Firebase에 저장
            firebase_client = FirebaseClient()
            for bean in unique_beans:
                firebase_client.add_bean(bean)
            
            logger.info(f"'{cafe_id}' 데이터 저장 완료")
        else:
            logger.info("Dry run 모드: 데이터 저장 생략")
        
        # 출력 파일 저장
        if output_path:
            # 경로에 디렉토리가 있는지 확인
            if os.path.dirname(output_path):
                os.makedirs(os.path.dirname(output_path), exist_ok=True)
                
            try:
                with open(output_path, 'w', encoding='utf-8') as f:
                    json.dump(results, f, ensure_ascii=False, indent=2, cls=DateTimeEncoder)
                logger.info(f"결과 저장 완료: {output_path}")
            except Exception as e:
                logger.error(f"JSON 저장 중 오류 발생: {e}")
        
        return True
        
    except ImportError as e:
        error_message = f"크롤러 모듈 로드 실패: {e}"
        logger.error(error_message)
        if notify:
            elapsed_time = time.time() - start_time
            notification_system = get_notification_system()
            notification_system.notify_failure(cafe_id, cafe_name, error_message, elapsed_time)
    except Exception as e:
        error_message = f"크롤링 중 오류 발생: {e}"
        logger.error(error_message, exc_info=True)
        if notify:
            elapsed_time = time.time() - start_time
            notification_system = get_notification_system()
            notification_system.notify_failure(cafe_id, cafe_name, error_message, elapsed_time)
    
    return False

def main():
    """
    메인 함수
    
    명령행 인수를 파싱하고 크롤러를 실행합니다.
    
    Returns:
        종료 코드 (0: 성공, 1: 실패)
    """
    args = parse_args()
    setup_logging(args)
    
    logger.info("커피 원두 크롤러 시작")
    
    # 카페 ID 목록 결정
    cafe_ids = []
    if args.all:
        cafe_ids = get_active_cafes()
        logger.info(f"활성화된 모든 카페 크롤링: {', '.join(cafe_ids)}")
    elif args.cafe:
        cafe_ids = [args.cafe]
    
    # 각 카페별로 크롤러 실행
    success_count = 0
    for cafe_id in cafe_ids:
        # 출력 파일 경로 설정
        output_path = None
        if args.output:
            if len(cafe_ids) > 1:
                # 여러 카페일 경우 파일명에 카페 ID 추가
                base, ext = os.path.splitext(args.output)
                output_path = f"{base}_{cafe_id}{ext}"
            else:
                output_path = args.output
        
        # 크롤러 실행
        if run_crawler(cafe_id, args.dry_run, args.test, output_path, args.notify):
            success_count += 1
    
    # 결과 요약 출력
    logger.info(f"크롤링 완료: {success_count}/{len(cafe_ids)} 성공")
    
    # 성공 여부에 따라 종료 코드 반환
    return 0 if success_count == len(cafe_ids) else 1

if __name__ == "__main__":
    sys.exit(main()) 
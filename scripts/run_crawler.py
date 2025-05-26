#!/usr/bin/env python
"""
크롤러 실행 스크립트

이 스크립트는 커맨드 라인에서 원두 크롤러를 실행하는 기능을 제공합니다.
"""

import os
import sys
import argparse
import logging
from typing import List, Optional
import importlib

# 프로젝트 루트 경로를 시스템 경로에 추가
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from coffee_crawler.utils.logger import setup_logger
from coffee_crawler.utils.config_loader import load_crawler_config

# 로거 설정
logger = setup_logger(name="coffee_crawler.cli", log_file="logs/crawler_cli.log")

def parse_args():
    """
    명령행 인수 파싱
    
    Returns:
        파싱된 명령행 인수
    """
    parser = argparse.ArgumentParser(description='커피 원두 크롤러 실행')
    
    # 카페 선택 인수
    parser.add_argument('--cafe', '-c', type=str, help='크롤링할 카페 ID (config/crawler_config.yaml에 정의된 ID)')
    parser.add_argument('--all', '-a', action='store_true', help='모든 활성화된 카페 크롤링')
    
    # 로깅 레벨 인수
    parser.add_argument('--verbose', '-v', action='count', default=0, help='로깅 상세 레벨 증가 (최대 3)')
    parser.add_argument('--quiet', '-q', action='store_true', help='로깅 비활성화 (오류만 표시)')
    
    # 출력 옵션
    parser.add_argument('--dry-run', '-d', action='store_true', help='실제 데이터 저장 없이 크롤링만 수행')
    parser.add_argument('--output', '-o', type=str, help='결과를 JSON 파일로 저장할 경로')
    
    # 테스트 옵션
    parser.add_argument('--test', '-t', action='store_true', help='테스트 모드 (샘플 데이터만 처리)')
    
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

def run_crawler(cafe_id: str, dry_run: bool = False, test_mode: bool = False, output_path: Optional[str] = None):
    """
    지정된 카페의 크롤러 실행
    
    Args:
        cafe_id: 크롤링할 카페 ID
        dry_run: 실제 데이터 저장 없이 크롤링만 수행할지 여부
        test_mode: 테스트 모드 여부
        output_path: 결과를 저장할 파일 경로
    """
    config = load_crawler_config()
    
    # 카페 설정 확인
    if cafe_id not in config.get('cafes', {}):
        logger.error(f"카페 ID '{cafe_id}'를 찾을 수 없습니다.")
        return False
    
    cafe_config = config['cafes'][cafe_id]
    
    # 카페 유형 확인
    crawler_type = cafe_config.get('type')
    if not crawler_type:
        logger.error(f"카페 '{cafe_id}'의 크롤러 유형이 정의되지 않았습니다.")
        return False
    
    logger.info(f"카페 '{cafe_id}' ({cafe_config.get('label', '알 수 없음')}) 크롤링 시작...")
    
    try:
        # 크롤러 모듈 동적 임포트
        module_name = f"coffee_crawler.crawlers.{crawler_type}_crawler"
        crawler_module = importlib.import_module(module_name)
        
        # 크롤러 클래스 가져오기
        crawler_class = getattr(crawler_module, f"{crawler_type.capitalize()}Crawler")
        
        # 크롤러 인스턴스 생성 및 실행
        crawler = crawler_class(cafe_id, cafe_config)
        results = crawler.crawl(test_mode=test_mode)
        
        logger.info(f"'{cafe_id}' 크롤링 완료: {len(results)} 개의 원두 정보 수집")
        
        # dry_run이 아닌 경우 데이터 저장
        if not dry_run:
            # 프로세서 모듈 동적 임포트
            from coffee_crawler.processors.normalizer import normalize_beans
            from coffee_crawler.processors.duplicate_checker import check_duplicates
            from coffee_crawler.storage.firebase_client import FirebaseClient
            
            # 데이터 정규화
            normalized_beans = normalize_beans(results, cafe_id)
            
            # 중복 검사
            unique_beans = check_duplicates(normalized_beans)
            
            # Firebase에 저장
            firebase_client = FirebaseClient()
            for bean in unique_beans:
                firebase_client.add_bean(bean)
            
            logger.info(f"'{cafe_id}' 데이터 저장 완료")
        else:
            logger.info("Dry run 모드: 데이터 저장 생략")
        
        # 출력 파일 저장
        if output_path:
            import json
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(results, f, ensure_ascii=False, indent=2)
            logger.info(f"결과 저장 완료: {output_path}")
        
        return True
        
    except ImportError as e:
        logger.error(f"크롤러 모듈 로드 실패: {e}")
    except Exception as e:
        logger.error(f"크롤링 중 오류 발생: {e}", exc_info=True)
    
    return False

def main():
    """메인 함수"""
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
    else:
        logger.error("크롤링할 카페를 지정하세요 (--cafe 또는 --all)")
        return 1
    
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
        if run_crawler(cafe_id, args.dry_run, args.test, output_path):
            success_count += 1
    
    # 결과 요약 출력
    logger.info(f"크롤링 완료: {success_count}/{len(cafe_ids)} 성공")
    
    # 성공 여부에 따라 종료 코드 반환
    return 0 if success_count == len(cafe_ids) else 1

if __name__ == "__main__":
    sys.exit(main()) 
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
    python run_crawler.py --all --dry-run --record-events --events-output data/bean_events.json
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

    # 변경 이벤트 옵션 (수익화: 재입고/가격 알림용)
    parser.add_argument('--record-events', action='store_true',
                        help='변경 이벤트(신상/재입고/판매중단/가격변동)를 Firestore bean_events에 기록')
    parser.add_argument('--events-output', help='생성된 변경 이벤트를 저장할 JSON 파일 경로')
    parser.add_argument('--telegram-digest', action='store_true',
                        help='크롤 후 텔레그램 채널에 다이제스트 발행 (환경 변수 미설정 시 자동 건너뜀)')

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
    print("DEBUG: 활성화된 카페 목록:", active_cafes)  # 추가: 실제 runner에서 어떤 카페가 active인지 확인
    logger.info(f"DEBUG: 활성화된 카페 목록: {active_cafes}")
    return active_cafes

def run_crawler(cafe_id: str, dry_run: bool = False, test_mode: bool = False, output_path: Optional[str] = None,
                notify: bool = False, event_recorder=None, events_sink: Optional[List] = None):
    """
    지정된 카페의 크롤러 실행

    Args:
        cafe_id: 크롤링할 카페 ID
        dry_run: 실제 데이터 저장 없이 크롤링만 수행할지 여부
        test_mode: 테스트 모드 여부 (일부 데이터만 처리)
        output_path: 결과를 저장할 파일 경로
        notify: 알림 활성화 여부
        event_recorder: BeanEventRecorder 인스턴스 (None이면 이벤트 기록 안 함)
        events_sink: 생성된 이벤트를 누적할 리스트

    Returns:
        크롤링된 원두 정보 목록
    """
    config = load_crawler_config()
    
    # 카페 설정 확인
    if cafe_id not in config.get('cafes', {}):
        logger.error(f"카페 ID '{cafe_id}'를 찾을 수 없습니다.")
        return None
    
    cafe_config = config['cafes'][cafe_id]
    cafe_name = cafe_config.get('label', cafe_id)
    
    # 카페 유형 확인
    crawler_type = cafe_config.get('type')
    if not crawler_type:
        logger.error(f"카페 '{cafe_id}'의 크롤러 유형이 정의되지 않았습니다.")
        return None
    
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
            for item in results:
                item['isSample'] = True
            
        elapsed_time = time.time() - start_time
        logger.info(f"'{cafe_id}' 크롤링 완료: {len(results)} 개의 원두 정보 수집, 소요시간: {elapsed_time:.2f}초")
        
        # 알림 전송
        if notify:
            notification_system = get_notification_system()
            notification_system.notify_success(cafe_id, cafe_name, len(results), elapsed_time)
        
        # 변경 이벤트 기록 (재입고/가격 알림용) - dry-run에서도 기록 가능
        # 실제 beans 반영은 GitHub Actions의 apply 스텝에서 수행되므로,
        # 이벤트는 "현재 Firestore 상태 대비 이번 크롤 결과의 차이"를 의미한다.
        if event_recorder is not None and results and not test_mode:
            try:
                from coffee_crawler.processors.duplicate_checker import deduplicate

                # 가격 문자열 원본을 유지한 채 중복만 제거 (Firestore 반영 데이터와 동일 기준)
                event_beans = deduplicate(results)
                events = event_recorder.record_changes(event_beans)

                if events_sink is not None:
                    events_sink.extend(events)

                logger.info(f"'{cafe_id}' 변경 이벤트 {len(events)}건 기록")
            except Exception as e:
                logger.error(f"'{cafe_id}' 변경 이벤트 기록 실패: {e}")
                logger.debug(traceback.format_exc())

        # dry_run이 아닌 경우 데이터 저장
        if not dry_run:
            # 프로세서 모듈 동적 임포트
            from coffee_crawler.processors.normalizer import normalize_beans
            from coffee_crawler.processors.duplicate_checker import deduplicate
            
            # 데이터 정규화
            normalized_beans = normalize_beans(results)
            
            # 중복 검사
            unique_beans = deduplicate(normalized_beans)

            # 샘플 데이터 여부 플래그 통일
            for bean in unique_beans:
                bean['isSample'] = bool(bean.get('isSample', False))
            
            # Firebase 비활성화 설정이면 Firebase 저장 건너뛰기
            is_firebase_disabled = os.environ.get('DISABLE_FIREBASE') == 'true'
            
            if not is_firebase_disabled:
                # Firebase 저장
                from coffee_crawler.storage.firebase_client import FirebaseClient
                firebase_client = FirebaseClient()
                
                if firebase_client.is_available():
                    saved_count = 0
                    for bean in unique_beans:
                        try:
                            if firebase_client.add_bean(bean):
                                saved_count += 1
                        except Exception as e:
                            logger.error(f"원두 정보 저장 실패: {e}")
                            continue
                    
                    logger.info(f"'{cafe_id}' Firebase 저장 완료: {saved_count}개")
                else:
                    logger.warning("Firebase를 사용할 수 없어 로컬 저장만 수행됩니다")
        
        return results
        
    except Exception as e:
        logger.error(f"크롤링 중 오류 발생: {e}")
        logger.debug(traceback.format_exc())
        return None

def main():
    """
    메인 함수
    """
    args = parse_args()
    setup_logging(args)
    
    # 시작 시간 기록
    start_time = time.time()
    
    # 결과 저장용 변수
    total_beans = 0
    all_results = []
    all_events = []

    # 변경 이벤트 기록기 준비 (Firebase 비활성화 시 건너뜀)
    event_recorder = None
    if args.record_events:
        if os.environ.get('DISABLE_FIREBASE') == 'true':
            logger.warning("DISABLE_FIREBASE=true - 변경 이벤트 기록을 건너뜁니다")
        elif args.test:
            logger.warning("테스트 모드에서는 변경 이벤트를 기록하지 않습니다")
        else:
            try:
                from coffee_crawler.processors.event_recorder import BeanEventRecorder
                recorder = BeanEventRecorder()
                if recorder.is_available():
                    event_recorder = recorder
                else:
                    logger.warning("Firebase를 사용할 수 없어 변경 이벤트를 기록하지 않습니다")
            except Exception as e:
                logger.error(f"변경 이벤트 기록기 초기화 실패: {e}")

    try:
        # 크롤링할 카페 목록 결정
        if args.all:
            cafe_ids = get_active_cafes()
        else:
            cafe_ids = [args.cafe]
        
        # 각 카페 크롤링 실행
        for cafe_id in cafe_ids:
            try:
                results = run_crawler(
                    cafe_id=cafe_id,
                    dry_run=args.dry_run,
                    test_mode=args.test,
                    output_path=args.output,
                    notify=args.notify,
                    event_recorder=event_recorder,
                    events_sink=all_events
                )
                
                if results:
                    all_results.extend(results)
                    total_beans += len(results)
            except Exception as e:
                logger.error(f"카페 '{cafe_id}' 크롤링 중 오류 발생: {e}")
                if args.verbose:
                    logger.debug(traceback.format_exc())
                continue
        
        # 전체 소요 시간 계산
        elapsed_time = time.time() - start_time
        
        # 결과 출력
        if args.output:
            # JSON 파일로 저장
            with open(args.output, 'w', encoding='utf-8') as f:
                json.dump(all_results, f, ensure_ascii=False, indent=2, cls=DateTimeEncoder)
            logger.info(f"크롤링 결과를 '{args.output}'에 저장했습니다.")

        # 변경 이벤트 저장 (다이제스트 발행 스텝에서 사용)
        if args.events_output:
            try:
                events_dir = os.path.dirname(os.path.abspath(args.events_output))
                if events_dir:
                    os.makedirs(events_dir, exist_ok=True)
                with open(args.events_output, 'w', encoding='utf-8') as f:
                    json.dump(all_events, f, ensure_ascii=False, indent=2, cls=DateTimeEncoder)
                logger.info(f"변경 이벤트 {len(all_events)}건을 '{args.events_output}'에 저장했습니다.")
            except Exception as e:
                logger.error(f"변경 이벤트 저장 실패: {e}")

        # 텔레그램 채널 다이제스트 발행 (선택)
        if args.telegram_digest:
            try:
                from coffee_crawler.utils.telegram_notifier import send_crawl_digest
                send_crawl_digest(all_events)
            except Exception as e:
                logger.error(f"텔레그램 다이제스트 발행 실패: {e}")

        # 최종 결과 출력
        logger.info(f"총 {len(cafe_ids)}개 카페 크롤링 완료")
        logger.info(f"총 수집된 원두 수: {total_beans}")
        logger.info(f"총 변경 이벤트 수: {len(all_events)}")
        logger.info(f"전체 소요 시간: {elapsed_time:.2f}초")

        return True
        
    except Exception as e:
        logger.error(f"크롤링 중 오류 발생: {e}")
        if args.verbose:
            logger.debug(traceback.format_exc())
        return False

if __name__ == "__main__":
    sys.exit(0 if main() else 1) 
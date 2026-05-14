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
from typing import List, Optional, Dict, Any
from datetime import datetime, date

# 프로젝트 루트 경로 추가
sys.path.append(os.path.abspath(os.path.dirname(os.path.dirname(__file__))))

from coffee_crawler.utils.config_loader import load_crawler_config
from coffee_crawler.utils.logger import setup_logger
from coffee_crawler.utils.notification import get_notification_system

# 로거 설정
logger = setup_logger(name="coffee_crawler.script")


def ensure_parent_dir(path: str):
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)


def classify_exception(exc: Exception) -> str:
    text = f"{type(exc).__name__}: {exc}".lower()
    if any(token in text for token in ['import', 'module', 'firebase', 'credential', 'permission']):
        return 'environment_error'
    if any(token in text for token in ['timeout', 'connection', 'http', 'request', '403', '404', 'dns']):
        return 'fetch_error'
    if any(token in text for token in ['selector', 'parse', 'soup', 'jsondecode', 'attributeerror', 'indexerror']):
        return 'parsing_error'
    return 'unknown_error'


def build_cafe_run_meta(
    cafe_id: str,
    cafe_config: Dict[str, Any],
    started_at: datetime,
    finished_at: datetime,
    success: bool,
    bean_count: int = 0,
    error_type: Optional[str] = None,
    error_message: Optional[str] = None,
    output_path: Optional[str] = None,
) -> Dict[str, Any]:
    return {
        'cafe_id': cafe_id,
        'cafe_label': cafe_config.get('label', cafe_id),
        'priority': cafe_config.get('priority', 'normal'),
        'success': success,
        'bean_count': bean_count,
        'started_at': started_at.isoformat(),
        'finished_at': finished_at.isoformat(),
        'elapsed_seconds': round((finished_at - started_at).total_seconds(), 3),
        'error_type': error_type,
        'error_message': error_message,
        'output_path': output_path,
    }

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
    print("DEBUG: 활성화된 카페 목록:", active_cafes)  # 추가: 실제 runner에서 어떤 카페가 active인지 확인
    logger.info(f"DEBUG: 활성화된 카페 목록: {active_cafes}")
    return active_cafes

def run_crawler(cafe_id: str, dry_run: bool = False, test_mode: bool = False, output_path: Optional[str] = None, notify: bool = False, firebase_client=None):
    """
    지정된 카페의 크롤러 실행
    
    Args:
        cafe_id: 크롤링할 카페 ID
        dry_run: 실제 데이터 저장 없이 크롤링만 수행할지 여부
        test_mode: 테스트 모드 여부 (일부 데이터만 처리)
        output_path: 결과를 저장할 파일 경로
        notify: 알림 활성화 여부
        
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
    started_at = datetime.now()
    
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
        # 단, 동적 렌더링/차단 등으로 정적 수집이 어려운 카페는 품질 지표 왜곡 방지를 위해 제외
        sample_excluded_cafes = {"bunkercompany", "birosocoffee"}
        generated_sample_data = False
        if test_mode and not results and cafe_id not in sample_excluded_cafes:
            from coffee_crawler.utils.sample_data import generate_sample_beans
            logger.info("테스트 모드: 결과가 없어 샘플 데이터 생성 (Firebase 저장 제외)")
            results = generate_sample_beans(5, cafe_id)
            generated_sample_data = True
            for item in results:
                item['isSample'] = True
                item['isActive'] = False
        elif test_mode and not results and cafe_id in sample_excluded_cafes:
            logger.info(f"테스트 모드: '{cafe_id}'는 샘플 데이터 생성을 건너뜁니다")
            
        elapsed_time = time.time() - start_time
        finished_at = datetime.now()
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
            
            # 데이터 정규화
            normalized_beans = normalize_beans(results)
            
            # 중복 검사
            unique_beans = deduplicate(normalized_beans)

            # 샘플 데이터 여부 플래그 통일
            for bean in unique_beans:
                bean['isSample'] = bool(bean.get('isSample', False))
            
            # Firebase 비활성화 설정이면 Firebase 저장 건너뛰기
            is_firebase_disabled = os.environ.get('DISABLE_FIREBASE') == 'true'
            
            should_skip_firebase_save = test_mode and generated_sample_data

            if should_skip_firebase_save:
                logger.info(f"'{cafe_id}' 샘플 데이터는 Firebase에 저장하지 않습니다")
            elif not is_firebase_disabled and firebase_client is not None:
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
        
        return {
            'results': results,
            'meta': build_cafe_run_meta(
                cafe_id=cafe_id,
                cafe_config=cafe_config,
                started_at=started_at,
                finished_at=finished_at,
                success=True,
                bean_count=len(results),
                output_path=output_path,
            )
        }
        
    except Exception as e:
        logger.error(f"크롤링 중 오류 발생: {e}")
        logger.debug(traceback.format_exc())
        return {
            'results': None,
            'meta': build_cafe_run_meta(
                cafe_id=cafe_id,
                cafe_config=cafe_config,
                started_at=started_at,
                finished_at=datetime.now(),
                success=False,
                bean_count=0,
                error_type=classify_exception(e),
                error_message=str(e),
                output_path=output_path,
            )
        }

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
    run_meta = []
    
    try:
        # 크롤링할 카페 목록 결정
        if args.all:
            cafe_ids = get_active_cafes()
        else:
            cafe_ids = [args.cafe]
        
        firebase_client = None
        if not args.dry_run and os.environ.get('DISABLE_FIREBASE') != 'true':
            from coffee_crawler.storage.firebase_client import FirebaseClient
            firebase_client = FirebaseClient()

        # 각 카페 크롤링 실행
        for cafe_id in cafe_ids:
            try:
                result = run_crawler(
                    cafe_id=cafe_id,
                    dry_run=args.dry_run,
                    test_mode=args.test,
                    output_path=args.output,
                    notify=args.notify,
                    firebase_client=firebase_client,
                )

                if result and result.get('meta'):
                    run_meta.append(result['meta'])

                results = result.get('results') if result else None
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
            ensure_parent_dir(args.output)
            with open(args.output, 'w', encoding='utf-8') as f:
                json.dump(all_results, f, ensure_ascii=False, indent=2, cls=DateTimeEncoder)
            logger.info(f"크롤링 결과를 '{args.output}'에 저장했습니다.")

        run_meta_path = os.environ.get('CRAWL_RUN_META_PATH', 'reports/current_run_meta.json')
        ensure_parent_dir(run_meta_path)
        with open(run_meta_path, 'w', encoding='utf-8') as f:
            json.dump({
                'generated_at': datetime.now().isoformat(),
                'cafes': run_meta,
                'total_cafes': len(cafe_ids),
                'successful_cafes': sum(1 for row in run_meta if row.get('success')),
                'failed_cafes': sum(1 for row in run_meta if not row.get('success')),
            }, f, ensure_ascii=False, indent=2)
        logger.info(f"카페별 실행 메타를 '{run_meta_path}'에 저장했습니다.")
        
        # 최종 결과 출력
        logger.info(f"총 {len(cafe_ids)}개 카페 크롤링 완료")
        logger.info(f"총 수집된 원두 수: {total_beans}")
        logger.info(f"전체 소요 시간: {elapsed_time:.2f}초")
        
        return True
        
    except Exception as e:
        logger.error(f"크롤링 중 오류 발생: {e}")
        if args.verbose:
            logger.debug(traceback.format_exc())
        return False

if __name__ == "__main__":
    sys.exit(0 if main() else 1) 

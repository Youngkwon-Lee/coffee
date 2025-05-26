"""
로거 모듈

이 모듈은 애플리케이션 전체에서 사용할 로거를 설정하는 기능을 제공합니다.
"""

import os
import logging
import colorlog
from typing import Optional

def setup_logger(
    name: str = "coffee_crawler",
    level: int = logging.INFO,
    log_file: Optional[str] = None,
    console_output: bool = True,
    colored: bool = True
) -> logging.Logger:
    """
    로거 설정 함수
    
    Args:
        name: 로거 이름
        level: 로깅 레벨
        log_file: 로그 파일 경로 (없으면 파일 로깅 비활성화)
        console_output: 콘솔 출력 여부
        colored: 컬러 로깅 활성화 여부
        
    Returns:
        설정된 로거 인스턴스
    """
    # 환경 변수에서 로깅 레벨 확인
    env_level = os.environ.get("COFFEE_CRAWLER_LOG_LEVEL", "").upper()
    if env_level in ("DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"):
        level = getattr(logging, env_level)
    
    # 로거 가져오기
    logger = logging.getLogger(name)
    logger.setLevel(level)
    
    # 이미 핸들러가 설정되어 있으면 중복 설정 방지
    if logger.handlers:
        return logger
    
    # 로그 포맷 설정
    log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    # 컬러 로깅 설정
    if colored and console_output:
        color_formatter = colorlog.ColoredFormatter(
            "%(log_color)s" + log_format,
            log_colors={
                'DEBUG': 'cyan',
                'INFO': 'green',
                'WARNING': 'yellow',
                'ERROR': 'red',
                'CRITICAL': 'red,bg_white',
            }
        )
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(color_formatter)
        logger.addHandler(console_handler)
    elif console_output:
        # 컬러 없는 콘솔 출력
        formatter = logging.Formatter(log_format)
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)
    
    # 파일 로깅 설정
    if log_file:
        # 로그 디렉토리 생성
        log_dir = os.path.dirname(log_file)
        if log_dir and not os.path.exists(log_dir):
            os.makedirs(log_dir)
        
        file_formatter = logging.Formatter(log_format)
        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_handler.setFormatter(file_formatter)
        logger.addHandler(file_handler)
    
    return logger

# 기본 로거 설정
def get_default_logger() -> logging.Logger:
    """
    기본 로거 반환
    
    Returns:
        설정된 기본 로거 인스턴스
    """
    log_file = os.environ.get("COFFEE_CRAWLER_LOG_FILE", "logs/coffee_crawler.log")
    return setup_logger(log_file=log_file)

# 크롤러 로거 설정
def get_crawler_logger(crawler_name: str) -> logging.Logger:
    """
    크롤러별 로거 반환
    
    Args:
        crawler_name: 크롤러 이름
        
    Returns:
        설정된 크롤러 로거 인스턴스
    """
    logger_name = f"coffee_crawler.crawler.{crawler_name}"
    log_file = os.environ.get("COFFEE_CRAWLER_LOG_FILE", f"logs/{crawler_name}.log")
    return setup_logger(name=logger_name, log_file=log_file)

# 스토리지 로거 설정
def get_storage_logger() -> logging.Logger:
    """
    스토리지 로거 반환
    
    Returns:
        설정된 스토리지 로거 인스턴스
    """
    logger_name = "coffee_crawler.storage"
    log_file = os.environ.get("COFFEE_CRAWLER_LOG_FILE", "logs/storage.log")
    return setup_logger(name=logger_name, log_file=log_file)

# 모듈 초기화 시 기본 로거 설정
logger = get_default_logger() 
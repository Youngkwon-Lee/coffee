"""
텔레그램 알림 모듈

이 모듈은 크롤 결과(신상/재입고/가격 인하)를 텔레그램 공개 채널에 발행하고,
개별 사용자에게 DM을 보내는 기능을 제공합니다.

환경 변수:
    TELEGRAM_BOT_TOKEN  : 봇 토큰 (BotFather 발급)
    TELEGRAM_CHANNEL_ID : 채널 ID 또는 @채널명

두 값이 없으면 조용히 건너뜁니다(크롤 실패로 처리하지 않음).

단독 실행:
    python -m coffee_crawler.utils.telegram_notifier --events data/bean_events.json
"""

import argparse
import json
import logging
import os
import sys
from datetime import datetime
from typing import Any, Dict, List, Optional

import requests

# 로거 설정
logger = logging.getLogger(__name__)

# 텔레그램 API
TELEGRAM_API_BASE = 'https://api.telegram.org'

# 텔레그램 메시지 최대 길이
TELEGRAM_MAX_MESSAGE_LENGTH = 4096

# 안전 마진 (말줄임 문구 여유)
_SAFE_MESSAGE_LENGTH = TELEGRAM_MAX_MESSAGE_LENGTH - 96

# 이벤트 유형별 다이제스트 섹션 정의 (표시 순서 유지)
_DIGEST_SECTIONS = [
    ('new', '🆕 신상 원두'),
    ('restored', '♻️ 재입고'),
    ('price_change', '💸 가격 인하'),
]


def format_krw(price: Optional[int]) -> str:
    """
    가격을 한국어 표기로 변환

    Args:
        price: 원 단위 정수

    Returns:
        "12,000원" 또는 "가격 미확인"
    """
    if isinstance(price, bool) or not isinstance(price, (int, float)):
        return '가격 미확인'
    if price <= 0:
        return '가격 미확인'
    return f"{int(price):,}원"


class TelegramNotifier:
    """텔레그램 발송 클래스"""

    def __init__(self, bot_token: Optional[str] = None, channel_id: Optional[str] = None):
        """
        TelegramNotifier 초기화

        Args:
            bot_token: 봇 토큰 (None이면 TELEGRAM_BOT_TOKEN 환경 변수)
            channel_id: 채널 ID (None이면 TELEGRAM_CHANNEL_ID 환경 변수)
        """
        self.bot_token = (bot_token or os.environ.get('TELEGRAM_BOT_TOKEN', '')).strip()
        self.channel_id = (channel_id or os.environ.get('TELEGRAM_CHANNEL_ID', '')).strip()

    def is_enabled(self) -> bool:
        """봇 토큰이 설정되어 있는지 확인"""
        return bool(self.bot_token)

    def is_channel_enabled(self) -> bool:
        """채널 발행이 가능한지 확인"""
        return bool(self.bot_token and self.channel_id)

    def send_message(self, chat_id: str, text: str) -> bool:
        """
        텔레그램 메시지 전송

        Args:
            chat_id: 대상 chat ID (채널 ID 또는 사용자 chat ID)
            text: 메시지 본문 (plain text)

        Returns:
            전송 성공 여부
        """
        if not self.is_enabled():
            logger.info("TELEGRAM_BOT_TOKEN이 없어 텔레그램 전송을 건너뜁니다")
            return False

        if not chat_id:
            logger.warning("chat_id가 없어 텔레그램 전송을 건너뜁니다")
            return False

        if not text:
            return False

        url = f"{TELEGRAM_API_BASE}/bot{self.bot_token}/sendMessage"
        payload = {
            'chat_id': str(chat_id),
            'text': truncate_message(text),
            'disable_web_page_preview': True,
        }

        try:
            response = requests.post(url, json=payload, timeout=20)

            if response.status_code == 200:
                logger.info(f"텔레그램 전송 완료: {chat_id}")
                return True

            logger.error(f"텔레그램 전송 실패({chat_id}): {response.status_code} {response.text}")
            return False

        except Exception as e:
            logger.error(f"텔레그램 전송 실패({chat_id}): {e}")
            return False

    def send_channel_message(self, text: str) -> bool:
        """
        공개 채널에 메시지 발행

        Args:
            text: 메시지 본문

        Returns:
            전송 성공 여부
        """
        if not self.is_channel_enabled():
            logger.info("텔레그램 설정(TELEGRAM_BOT_TOKEN/TELEGRAM_CHANNEL_ID)이 없어 채널 발행을 건너뜁니다")
            return False

        return self.send_message(self.channel_id, text)

    def send_digest(self, events: List[Dict[str, Any]]) -> bool:
        """
        크롤 결과 다이제스트를 채널에 발행

        Args:
            events: bean_events 형식의 이벤트 목록

        Returns:
            전송 성공 여부
        """
        if not self.is_channel_enabled():
            logger.info("텔레그램 설정이 없어 다이제스트 발행을 건너뜁니다")
            return False

        message = build_digest_message(events)

        if not message:
            logger.info("발행할 신상/재입고/가격 인하 소식이 없습니다")
            return False

        return self.send_channel_message(message)


def truncate_message(text: str, limit: int = TELEGRAM_MAX_MESSAGE_LENGTH) -> str:
    """
    텔레그램 길이 제한에 맞게 메시지 자르기

    Args:
        text: 원본 메시지
        limit: 최대 길이

    Returns:
        잘린 메시지
    """
    if len(text) <= limit:
        return text
    return text[:limit - 1].rstrip() + '…'


def _price_change_line(event: Dict[str, Any]) -> str:
    """가격 인하 표기 ("22,000원 → 19,000원")"""
    return f"{format_krw(event.get('old_price_krw'))} → {format_krw(event.get('new_price_krw'))}"


def _event_lines(event: Dict[str, Any], event_type: str) -> List[str]:
    """이벤트 1건을 표시할 줄 목록 생성"""
    name = (event.get('name') or '이름 미확인').strip()

    if event_type == 'price_change':
        head = f"· {name} {_price_change_line(event)}"
    else:
        head = f"· {name} {format_krw(event.get('new_price_krw'))}"

    lines = [head]

    link = (event.get('link') or '').strip()
    if link:
        lines.append(f"  {link}")

    return lines


def build_digest_message(events: List[Dict[str, Any]], now: Optional[datetime] = None) -> Optional[str]:
    """
    한국어 다이제스트 메시지 생성

    신상 원두(new) / 재입고(restored) / 가격 인하(price_change)를
    브랜드별로 묶어 하나의 메시지로 만듭니다.

    Args:
        events: bean_events 형식의 이벤트 목록
        now: 기준 시각 (테스트용)

    Returns:
        메시지 문자열 (발행할 내용이 없으면 None)
    """
    if not events:
        return None

    # 유형별 / 브랜드별 그룹화
    grouped: Dict[str, Dict[str, List[Dict[str, Any]]]] = {}

    for event in events:
        event_type = event.get('type')

        if event_type not in dict(_DIGEST_SECTIONS):
            continue

        # 가격 인하만 발행 (인상은 제외)
        if event_type == 'price_change':
            old_price = event.get('old_price_krw')
            new_price = event.get('new_price_krw')
            if not isinstance(old_price, (int, float)) or not isinstance(new_price, (int, float)):
                continue
            if new_price >= old_price:
                continue

        brand = (event.get('brand') or '기타').strip() or '기타'
        grouped.setdefault(event_type, {}).setdefault(brand, []).append(event)

    if not grouped:
        return None

    now = now or datetime.now()
    header = f"☕️ 원두레이더 {now.strftime('%Y-%m-%d')}"

    lines: List[str] = [header]
    omitted = 0

    def fits(extra_lines: List[str]) -> bool:
        """추가 시 길이 제한을 넘지 않는지 확인"""
        return len('\n'.join(lines + extra_lines)) <= _SAFE_MESSAGE_LENGTH

    for event_type, section_title in _DIGEST_SECTIONS:
        brands = grouped.get(event_type)
        if not brands:
            continue

        total = sum(len(items) for items in brands.values())
        section_header = ['', f"{section_title} ({total})"]

        if not fits(section_header):
            omitted += total
            continue

        lines.extend(section_header)

        # 브랜드 블록 -> 항목 단위로 채우고, 넘치는 항목은 생략 개수로 집계
        for brand in sorted(brands):
            brand_header = [f"[{brand}]"]
            brand_header_added = False

            for event in brands[brand]:
                item_lines = _event_lines(event, event_type)
                candidate = (brand_header if not brand_header_added else []) + item_lines

                if fits(candidate):
                    lines.extend(candidate)
                    brand_header_added = True
                else:
                    omitted += 1

    if omitted:
        lines.append('')
        lines.append(f"…외 {omitted}건 생략 (전체는 웹에서 확인)")

    message = '\n'.join(lines).strip()

    # 헤더만 남은 경우는 발행하지 않음
    if message == header:
        return None

    return truncate_message(message)


# 글로벌 인스턴스
_notifier = None


def get_telegram_notifier() -> TelegramNotifier:
    """
    텔레그램 발송기 인스턴스 반환

    Returns:
        TelegramNotifier 인스턴스
    """
    global _notifier
    if _notifier is None:
        _notifier = TelegramNotifier()
    return _notifier


def send_crawl_digest(events: List[Dict[str, Any]]) -> bool:
    """
    크롤 결과 다이제스트 발행 함수

    Args:
        events: bean_events 형식의 이벤트 목록

    Returns:
        전송 성공 여부
    """
    return get_telegram_notifier().send_digest(events)


def _load_events(path: str) -> List[Dict[str, Any]]:
    """이벤트 JSON 파일 읽기"""
    if not os.path.exists(path):
        logger.warning(f"이벤트 파일이 없습니다: {path}")
        return []

    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        logger.error(f"이벤트 파일 읽기 실패({path}): {e}")
        return []

    if isinstance(data, dict):
        data = data.get('events', [])

    return data if isinstance(data, list) else []


def main() -> int:
    """단독 실행 엔트리포인트 (GitHub Actions 스텝용)"""
    parser = argparse.ArgumentParser(description='텔레그램 채널 다이제스트 발행')
    parser.add_argument('--events', '-e', required=True, help='이벤트 JSON 파일 경로')
    parser.add_argument('--dry-run', '-d', action='store_true', help='전송 없이 메시지만 출력')
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format='%(levelname)s %(message)s')

    events = _load_events(args.events)
    message = build_digest_message(events)

    if not message:
        print('발행할 신상/재입고/가격 인하 소식이 없습니다.')
        return 0

    if args.dry_run:
        print(message)
        return 0

    notifier = get_telegram_notifier()

    if not notifier.is_channel_enabled():
        print('TELEGRAM_BOT_TOKEN/TELEGRAM_CHANNEL_ID 미설정 - 발행을 건너뜁니다.')
        return 0

    ok = notifier.send_channel_message(message)
    print('✅ 텔레그램 채널 발행 완료' if ok else '❌ 텔레그램 채널 발행 실패')
    return 0


if __name__ == '__main__':
    sys.exit(main())

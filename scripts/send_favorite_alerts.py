#!/usr/bin/env python
"""
즐겨찾기 원두 알림 발송 스크립트 (프리미엄 MVP)

최근 `bean_events`(재입고/가격변동)를 읽어, 해당 원두를 즐겨찾기한 사용자에게
텔레그램 DM을 보냅니다.

플랜 게이팅:
    - users/{uid}.plan == 'premium'  -> 즐겨찾기 전체 알림
    - 그 외(무료)                     -> 가장 오래된 즐겨찾기 3개만 알림

사용법:
    python scripts/send_favorite_alerts.py                     # 최근 25시간 이벤트
    python scripts/send_favorite_alerts.py --since-hours 48
    python scripts/send_favorite_alerts.py --dry-run           # 발송 없이 대상만 출력

필요 환경 변수:
    TELEGRAM_BOT_TOKEN                 (없으면 조용히 종료)
    GOOGLE_APPLICATION_CREDENTIALS     (Firebase 서비스 계정 키)
"""

import argparse
import logging
import os
import sys
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

# 프로젝트 루트 경로 추가
sys.path.append(os.path.abspath(os.path.dirname(os.path.dirname(__file__))))

from coffee_crawler.processors.event_recorder import (
    BEAN_EVENTS_COLLECTION,
    EVENT_TYPE_PRICE_CHANGE,
    EVENT_TYPE_RESTORED,
)
from coffee_crawler.storage.firebase_client import FirebaseClient
from coffee_crawler.utils.logger import setup_logger
from coffee_crawler.utils.telegram_notifier import (
    TelegramNotifier,
    format_krw,
    truncate_message,
)

# 로거 설정
logger = setup_logger(name="coffee_crawler.favorite_alerts")

# 알림 대상 이벤트 유형
ALERT_EVENT_TYPES = (EVENT_TYPE_RESTORED, EVENT_TYPE_PRICE_CHANGE)

# 무료 플랜 알림 허용 즐겨찾기 개수
FREE_PLAN_FAVORITE_LIMIT = 3

# 프리미엄 플랜 식별자
PREMIUM_PLAN = 'premium'


def resolve_premium(user_data: Dict[str, Any], uid: str) -> bool:
    """
    프리미엄 여부. plan == 'premium' 이면서 premium_until이 지나지 않아야 한다.

    plan만 보면 결제를 멈춘 사람이 영구 프리미엄으로 남는다. 지금은 계좌이체
    수동 활성화라 자동 해지가 없으므로, 만료일을 지키는 쪽이 유일한 방어선이다.

    premium_until이 없으면 만료 없는 수동 부여로 본다(초기 수동 운영용).
    값이 있는데 해석할 수 없으면 프리미엄을 주지 않는다 — 과금 판정에서
    모호하면 안전한 쪽(무료)으로 떨어뜨린다.
    """
    if str(user_data.get('plan') or '').lower() != PREMIUM_PLAN:
        return False

    until = user_data.get('premium_until') or user_data.get('premiumUntil')
    if until in (None, ''):
        return True

    # Firestore Timestamp / datetime / ISO 문자열을 모두 받는다.
    if hasattr(until, 'timestamp'):
        expires = datetime.fromtimestamp(until.timestamp(), tz=timezone.utc)
    elif isinstance(until, str):
        try:
            expires = datetime.fromisoformat(until.replace('Z', '+00:00'))
        except ValueError:
            logger.warning(f"premium_until 해석 실패({uid}): {until!r} — 무료로 처리")
            return False
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
    else:
        logger.warning(f"premium_until 타입 미지원({uid}): {type(until).__name__} — 무료로 처리")
        return False

    if expires <= datetime.now(timezone.utc):
        logger.info(f"프리미엄 만료({uid}): {expires.isoformat()}")
        return False
    return True


def parse_args():
    """명령행 인수 파싱"""
    parser = argparse.ArgumentParser(description='즐겨찾기 원두 재입고/가격 알림 발송')
    parser.add_argument('--since-hours', type=int, default=25,
                        help='조회할 이벤트 기간(시간). 기본 25 (매일 크롤 + 여유 1시간)')
    parser.add_argument('--dry-run', '-d', action='store_true', help='발송 없이 대상만 출력')
    parser.add_argument('--verbose', '-v', action='store_true', help='상세 로그 출력')
    return parser.parse_args()


def to_epoch(value: Any) -> float:
    """Firestore 타임스탬프/날짜 값을 epoch 초로 변환 (없으면 0)"""
    if value is None:
        return 0.0

    # google.cloud.firestore의 DatetimeWithNanoseconds 는 datetime 서브클래스
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.timestamp()

    if isinstance(value, (int, float)):
        return float(value)

    return 0.0


def fetch_recent_events(db, since_hours: int) -> Dict[str, List[Dict[str, Any]]]:
    """
    최근 알림 대상 이벤트 조회

    Args:
        db: Firestore 클라이언트
        since_hours: 조회 기간(시간)

    Returns:
        bean_id -> 이벤트 목록
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=since_hours)

    # 복합 인덱스를 피하기 위해 detected_at 범위 조건만 사용하고 type은 파이썬에서 필터링
    docs = db.collection(BEAN_EVENTS_COLLECTION).where('detected_at', '>=', cutoff).stream()

    events_by_bean: Dict[str, List[Dict[str, Any]]] = {}
    total = 0

    for doc in docs:
        data = doc.to_dict() or {}
        total += 1

        if data.get('type') not in ALERT_EVENT_TYPES:
            continue

        bean_id = data.get('bean_id')
        if not bean_id:
            continue

        data['id'] = doc.id
        events_by_bean.setdefault(bean_id, []).append(data)

    # 원두별로 유형당 최신 이벤트 1건만 유지
    for bean_id, events in events_by_bean.items():
        latest_by_type: Dict[str, Dict[str, Any]] = {}
        for event in sorted(events, key=lambda e: to_epoch(e.get('detected_at'))):
            latest_by_type[event['type']] = event
        events_by_bean[bean_id] = list(latest_by_type.values())

    logger.info(f"최근 {since_hours}시간 이벤트 {total}건 중 알림 대상 원두 {len(events_by_bean)}개")
    return events_by_bean


def fetch_favorites(db, uid: str) -> List[Tuple[str, float]]:
    """
    사용자 즐겨찾기 목록 조회 (등록 순 오래된 것부터)

    Args:
        db: Firestore 클라이언트
        uid: 사용자 UID

    Returns:
        (bean_id, addedAt epoch) 목록
    """
    docs = db.collection('users').document(uid).collection('favorites_beans').stream()

    favorites: List[Tuple[str, float]] = []
    for doc in docs:
        data = doc.to_dict() or {}
        added_at = to_epoch(data.get('addedAt') or data.get('createdAt'))
        favorites.append((doc.id, added_at))

    # addedAt 없는 항목(0)은 가장 오래된 것으로 취급
    favorites.sort(key=lambda item: item[1])
    return favorites


def build_alert_message(
    events: List[Dict[str, Any]],
    is_premium: bool,
    hidden_count: int
) -> str:
    """
    사용자 DM 메시지 생성

    Args:
        events: 알림 대상 이벤트 목록
        is_premium: 프리미엄 여부
        hidden_count: 무료 플랜 제한으로 제외된 즐겨찾기 개수

    Returns:
        메시지 문자열
    """
    restored = [e for e in events if e.get('type') == EVENT_TYPE_RESTORED]
    price_changes = [e for e in events if e.get('type') == EVENT_TYPE_PRICE_CHANGE]

    lines: List[str] = ['☕️ 즐겨찾기 원두 소식']

    if restored:
        lines.append('')
        lines.append(f"♻️ 재입고 ({len(restored)})")
        for event in restored:
            brand = (event.get('brand') or '').strip()
            name = (event.get('name') or '이름 미확인').strip()
            lines.append(f"· [{brand}] {name} {format_krw(event.get('new_price_krw'))}")
            link = (event.get('link') or '').strip()
            if link:
                lines.append(f"  {link}")

    if price_changes:
        lines.append('')
        lines.append(f"💸 가격 변동 ({len(price_changes)})")
        for event in price_changes:
            brand = (event.get('brand') or '').strip()
            name = (event.get('name') or '이름 미확인').strip()
            old_price = format_krw(event.get('old_price_krw'))
            new_price = format_krw(event.get('new_price_krw'))
            lines.append(f"· [{brand}] {name} {old_price} → {new_price}")
            link = (event.get('link') or '').strip()
            if link:
                lines.append(f"  {link}")

    if not is_premium:
        lines.append('')
        if hidden_count > 0:
            lines.append(
                f"ℹ️ 무료 플랜은 즐겨찾기 {FREE_PLAN_FAVORITE_LIMIT}개까지만 알림을 받습니다 "
                f"(알림 제외 {hidden_count}개). 프리미엄은 무제한입니다."
            )
        else:
            lines.append(f"ℹ️ 무료 플랜: 즐겨찾기 {FREE_PLAN_FAVORITE_LIMIT}개까지 알림")

    return truncate_message('\n'.join(lines))


def main() -> int:
    """메인 함수"""
    args = parse_args()

    if args.verbose:
        logging.getLogger('coffee_crawler').setLevel(logging.DEBUG)
        logger.setLevel(logging.DEBUG)

    notifier = TelegramNotifier()

    if not notifier.is_enabled() and not args.dry_run:
        logger.info("TELEGRAM_BOT_TOKEN이 없어 즐겨찾기 알림을 건너뜁니다")
        return 0

    firebase_client = FirebaseClient()

    if not firebase_client.is_available():
        logger.error("Firebase를 사용할 수 없어 즐겨찾기 알림을 보낼 수 없습니다")
        return 1

    db = firebase_client.db

    try:
        events_by_bean = fetch_recent_events(db, args.since_hours)
    except Exception as e:
        logger.error(f"이벤트 조회 실패: {e}")
        return 1

    if not events_by_bean:
        logger.info("알림 대상 이벤트가 없습니다")
        return 0

    sent = 0
    skipped = 0
    matched_users = 0

    try:
        user_docs = list(db.collection('users').stream())
    except Exception as e:
        logger.error(f"사용자 조회 실패: {e}")
        return 1

    for user_doc in user_docs:
        user_data = user_doc.to_dict() or {}
        chat_id = user_data.get('telegramChatId')

        # 텔레그램 미연동 사용자는 건너뜀
        if not chat_id:
            continue

        uid = user_doc.id
        is_premium = resolve_premium(user_data, uid)

        try:
            favorites = fetch_favorites(db, uid)
        except Exception as e:
            logger.error(f"즐겨찾기 조회 실패({uid}): {e}")
            continue

        if not favorites:
            continue

        if is_premium:
            allowed = [bean_id for bean_id, _ in favorites]
            hidden_count = 0
        else:
            allowed = [bean_id for bean_id, _ in favorites[:FREE_PLAN_FAVORITE_LIMIT]]
            hidden_count = max(0, len(favorites) - FREE_PLAN_FAVORITE_LIMIT)

        matched_events: List[Dict[str, Any]] = []
        for bean_id in allowed:
            matched_events.extend(events_by_bean.get(bean_id, []))

        if not matched_events:
            skipped += 1
            continue

        matched_users += 1
        message = build_alert_message(matched_events, is_premium, hidden_count)

        plan_label = 'premium' if is_premium else 'free'
        logger.info(f"알림 대상: uid={uid} plan={plan_label} 이벤트={len(matched_events)}건")

        if args.dry_run:
            print(f"--- {uid} (chat_id={chat_id}, plan={plan_label}) ---")
            print(message)
            continue

        if notifier.send_message(str(chat_id), message):
            sent += 1

    logger.info(
        f"즐겨찾기 알림 처리 완료: 발송 {sent}명 / 대상 {matched_users}명 / "
        f"이벤트 없음 {skipped}명 / 전체 사용자 {len(user_docs)}명"
    )
    return 0


if __name__ == '__main__':
    sys.exit(main())

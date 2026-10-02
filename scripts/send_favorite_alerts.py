#!/usr/bin/env python
"""Daily favorite alerts with an event/user delivery ledger.

No live action in tests. --dry-run reads only. A sent or uncertain delivery is
never automatically replayed. The Telegram API cannot provide exactly-once
semantics across the network/Firestore boundary; uncertainty requires review.
"""
import argparse
import hashlib
import json
import logging
import math
import os
import re
import sys
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

import requests
from google.cloud import firestore

sys.path.append(os.path.abspath(os.path.dirname(os.path.dirname(__file__))))
from coffee_crawler.processors.event_recorder import (
    BEAN_EVENTS_COLLECTION, EVENT_TYPE_PRICE_CHANGE, EVENT_TYPE_RESTORED,
)
from coffee_crawler.storage.firebase_client import FirebaseClient
from coffee_crawler.utils.logger import setup_logger
from coffee_crawler.utils.telegram_notifier import format_krw, truncate_message

logger = setup_logger(name='coffee_crawler.favorite_alerts')
FREE_PLAN_FAVORITE_LIMIT = 3
PREMIUM_PLAN = 'premium'
DELIVERIES_COLLECTION = 'favorite_deliveries'
CLAIM_SECONDS = 120
MAX_ATTEMPTS = 3


def resolve_premium(user_data: Dict[str, Any], uid: str, now=None) -> bool:
    """Match src/lib/premium.ts, including existing undated manual grants."""
    if str(user_data.get('plan') or '').lower() != PREMIUM_PLAN:
        return False
    until = user_data.get('premium_until')
    if until is None:
        until = user_data.get('premiumUntil')
    if until in (None, ''):
        return True
    try:
        if isinstance(until, datetime):
            expires = until if until.tzinfo else until.replace(tzinfo=timezone.utc)
        elif callable(getattr(until, 'timestamp', None)):
            expires = datetime.fromtimestamp(until.timestamp(), tz=timezone.utc)
        elif isinstance(until, str) and re.fullmatch(r'\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?', until):
            expires = datetime.fromisoformat(until.replace('Z', '+00:00'))
            if expires.tzinfo is None:
                expires = expires.replace(tzinfo=timezone.utc)
        else:
            return False
        return expires > (now or datetime.now(timezone.utc))
    except (ValueError, TypeError, OverflowError, OSError):
        logger.warning('Invalid premium expiry; using free plan')
        return False


def to_epoch(value: Any) -> float:
    if isinstance(value, datetime):
        return (value if value.tzinfo else value.replace(tzinfo=timezone.utc)).timestamp()
    if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value):
        return float(value)
    return 0.0


def is_alert_event(event):
    if event.get('type') == EVENT_TYPE_RESTORED:
        return True
    if event.get('type') != EVENT_TYPE_PRICE_CHANGE:
        return False
    old, new = event.get('old_price_krw'), event.get('new_price_krw')
    return all(isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) and v > 0 for v in (old, new)) and new < old


def fetch_recent_events(db, since_hours: int) -> Dict[str, List[Dict[str, Any]]]:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=since_hours)
    events = {}
    for doc in db.collection(BEAN_EVENTS_COLLECTION).where('detected_at', '>=', cutoff).stream():
        data = doc.to_dict() or {}
        if data.get('bean_id') and is_alert_event(data):
            data['id'] = doc.id
            events.setdefault(data['bean_id'], []).append(data)
    return events


def fetch_favorites(db, uid: str) -> List[Tuple[str, float]]:
    favorites = []
    for doc in db.collection('users').document(uid).collection('favorites_beans').stream():
        data = doc.to_dict() or {}
        favorites.append((doc.id, to_epoch(data.get('addedAt') or data.get('createdAt'))))
    # Deterministic even for old favorites lacking timestamps.
    return sorted(favorites, key=lambda item: (item[1], item[0]))


def build_alert_message(events, is_premium, hidden_count):
    lines = ['관심 원두 일일 확인']
    for event in events:
        label = '판매페이지에서 다시 확인' if event.get('type') == EVENT_TYPE_RESTORED else '가격 인하'
        name = str(event.get('name') or '이름 미확인')[:250]
        brand = str(event.get('brand') or '')[:100]
        lines.extend(['', f'{label} · [{brand}] {name}'])
        if event.get('type') == EVENT_TYPE_PRICE_CHANGE:
            lines.append(f"{format_krw(event.get('old_price_krw'))} → {format_krw(event.get('new_price_krw'))}")
        else:
            lines.append(format_krw(event.get('new_price_krw')))
        link = str(event.get('link') or '')
        if link.startswith(('https://', 'http://')) and len(link) <= 1800:
            lines.append(link)
    lines.extend(['', '실시간 재고 정보가 아닙니다. 최종 가격·상품 구성·재고는 판매처에서 확인해 주세요.'])
    if not is_premium:
        lines.append(f'무료 알림: 먼저 등록한 즐겨찾기 {FREE_PLAN_FAVORITE_LIMIT}개' + (f' (대상 제외 {hidden_count}개)' if hidden_count else ''))
    return truncate_message('\n'.join(lines))


def delivery_id(uid, event_id):
    return hashlib.sha256(json.dumps([uid, event_id], separators=(',', ':')).encode()).hexdigest()


@dataclass(frozen=True)
class SendResult:
    status: str
    message_id: Optional[int] = None
    error: Optional[str] = None
    retryable: bool = False
    retry_after: int = 0


def send_telegram(chat_id, message, bot_token, post=None):
    """Never retries a request with an uncertain outcome; never logs bot tokens."""
    if not bot_token or not chat_id:
        return SendResult('failed', error='missing_configuration')
    try:
        response = (post or requests.post)(
            f'https://api.telegram.org/bot{bot_token}/sendMessage',
            json={'chat_id': str(chat_id), 'text': message, 'disable_web_page_preview': True}, timeout=20,
        )
        body = response.json()
        if not isinstance(body, dict):
            return SendResult('unknown', error='unexpected_response')
        message_id = (body.get('result') or {}).get('message_id') if isinstance(body.get('result'), dict) else None
        if response.status_code == 200 and body.get('ok') is True and isinstance(message_id, int) and not isinstance(message_id, bool):
            return SendResult('sent', message_id=message_id)
        if 400 <= response.status_code < 500 and body.get('ok') is False:
            retryable = response.status_code == 429
            delay = (body.get('parameters') or {}).get('retry_after', 60) if isinstance(body.get('parameters'), dict) else 60
            delay = delay if isinstance(delay, int) and not isinstance(delay, bool) else 60
            return SendResult('failed', error=f'api_{response.status_code}', retryable=retryable, retry_after=max(60, delay))
        return SendResult('unknown', error=f'uncertain_http_{response.status_code}')
    except Exception:
        return SendResult('unknown', error='transport_or_response_uncertain')


class ThrottledSender:
    """Space requests to each chat; defer remaining events after an explicit 429."""
    def __init__(self, token, send=None, clock=None, sleep=None):
        self.token = token
        self.send = send or send_telegram
        self.clock = clock or time.monotonic
        self.sleep = sleep or time.sleep
        self.last_call = {}
        self.cooldown = {}

    def __call__(self, chat_id, message):
        chat_id = str(chat_id)
        remaining = self.cooldown.get(chat_id, 0) - self.clock()
        if remaining > 0:
            return SendResult('failed', error='chat_cooldown', retryable=True, retry_after=math.ceil(remaining))
        if chat_id in self.last_call:
            delay = 1.1 - (self.clock() - self.last_call[chat_id])
            if delay > 0:
                self.sleep(delay)
        self.last_call[chat_id] = self.clock()
        result = self.send(chat_id, message, self.token)
        if result.retryable:
            self.cooldown[chat_id] = self.clock() + result.retry_after
        return result


@dataclass(frozen=True)
class ClaimResult:
    token: Optional[str] = None
    status: str = 'skipped'


class DeliveryLedger:
    def __init__(self, db):
        self.db = db

    def claim(self, uid, event, now=None):
        now = now or datetime.now(timezone.utc)
        ref = self.db.collection(DELIVERIES_COLLECTION).document(delivery_id(uid, event['id']))
        token = uuid.uuid4().hex

        @firestore.transactional
        def acquire(tx):
            snap = ref.get(transaction=tx)
            data = snap.to_dict() or {}
            status = data.get('status')
            if status in ('sent', 'unknown'):
                return ClaimResult(status='unknown' if status == 'unknown' else 'skipped')
            if status == 'sending':
                if to_epoch(data.get('claimUntil')) <= now.timestamp():
                    tx.update(ref, {'status': 'unknown', 'lastError': 'claim_expired', 'updatedAt': now})
                    return ClaimResult(status='unknown')
                return ClaimResult()
            attempts = data.get('attempts', 0)
            if status == 'failed' and (not data.get('retryable') or attempts >= MAX_ATTEMPTS or to_epoch(data.get('nextRetryAt')) > now.timestamp()):
                return ClaimResult(status='failed' if not data.get('retryable') or attempts >= MAX_ATTEMPTS else 'skipped')
            tx.set(ref, {
                'uid': uid, 'eventId': event['id'], 'event': event,
                'status': 'sending', 'claimToken': token, 'claimUntil': now + timedelta(seconds=CLAIM_SECONDS),
                'attempts': attempts + 1, 'updatedAt': now,
            }, merge=True)
            return ClaimResult(token=token, status='claimed')

        return acquire(self.db.transaction())

    def finish(self, uid, event_id, token, result, now=None):
        now = now or datetime.now(timezone.utc)
        ref = self.db.collection(DELIVERIES_COLLECTION).document(delivery_id(uid, event_id))

        @firestore.transactional
        def record(tx):
            data = ref.get(transaction=tx).to_dict() or {}
            if data.get('status') != 'sending' or data.get('claimToken') != token:
                raise RuntimeError('Delivery claim no longer owned; review outcome before replay')
            tx.update(ref, {
                'status': result.status, 'messageId': result.message_id,
                'lastError': result.error, 'retryable': result.retryable,
                'nextRetryAt': now + timedelta(seconds=result.retry_after), 'updatedAt': now,
            })
        record(self.db.transaction())

    def retry_events(self, now=None):
        """Keep eligible failed sends beyond the recent-event window."""
        now = now or datetime.now(timezone.utc)
        events_by_user = {}
        for doc in self.db.collection(DELIVERIES_COLLECTION).where('status', '==', 'failed').stream():
            data = doc.to_dict() or {}
            if data.get('retryable') and data.get('attempts', 0) < MAX_ATTEMPTS and to_epoch(data.get('nextRetryAt')) <= now.timestamp():
                event = data.get('event') or {}
                if event.get('id') and event.get('bean_id') and is_alert_event(event):
                    events_by_user.setdefault(data['uid'], []).append(event)
        return events_by_user


def deliver_event(ledger, uid, event, send, now=None):
    claim = ledger.claim(uid, event, now)
    if claim.token is None:
        return claim.status
    try:
        result = send()
    except Exception:
        result = SendResult('unknown', error='sender_uncertain')
    ledger.finish(uid, event['id'], claim.token, result, now)
    return result.status


def parse_args():
    parser = argparse.ArgumentParser(description='즐겨찾기 일일 알림 (발송 원장 적용)')
    parser.add_argument('--since-hours', type=int, default=25)
    parser.add_argument('--dry-run', '-d', action='store_true', help='읽기만 수행; 발송/원장 쓰기 없음')
    parser.add_argument('--verbose', '-v', action='store_true')
    args = parser.parse_args()
    if args.since_hours <= 0:
        parser.error('--since-hours must be positive')
    return args


def main():
    args = parse_args()
    if args.verbose:
        logging.getLogger('coffee_crawler').setLevel(logging.DEBUG)
    token = os.environ.get('TELEGRAM_BOT_TOKEN', '').strip()
    if not token and not args.dry_run:
        logger.error('TELEGRAM_BOT_TOKEN missing; no alerts sent')
        return 1
    client = FirebaseClient()
    if not client.is_available():
        return 1
    db = client.db
    ledger = DeliveryLedger(db)
    sender = ThrottledSender(token)
    counts = {'sent': 0, 'failed': 0, 'unknown': 0, 'skipped': 0, 'planned': 0}
    try:
        recent = fetch_recent_events(db, args.since_hours)
        retries = ledger.retry_events()
        for user_doc in db.collection('users').stream():
            user = user_doc.to_dict() or {}
            if not user.get('telegramChatId'):
                continue
            uid = user_doc.id
            premium = resolve_premium(user, uid)
            favorites = fetch_favorites(db, uid)
            allowed = {bean_id for bean_id, _ in (favorites if premium else favorites[:FREE_PLAN_FAVORITE_LIMIT])}
            hidden = 0 if premium else max(0, len(favorites) - FREE_PLAN_FAVORITE_LIMIT)
            matches = {e['id']: e for bean_id in allowed for e in recent.get(bean_id, [])}
            for event in retries.get(uid, []):
                if event['bean_id'] in allowed:
                    matches[event['id']] = event
            for event in sorted(matches.values(), key=lambda e: (to_epoch(e.get('detected_at')), e['id'])):
                message = build_alert_message([event], premium, hidden)
                if args.dry_run:
                    counts['planned'] += 1
                    continue
                status = deliver_event(ledger, uid, event, lambda: sender(user['telegramChatId'], message))
                counts[status] += 1
        logger.info('Delivery summary: %s', json.dumps(counts))
        return 1 if counts['failed'] or counts['unknown'] else 0
    except Exception as error:
        # Do not print transport exception text containing credential-bearing URLs.
        logger.error('Alert processing failed (%s); inspect ledger before retry', type(error).__name__)
        return 1


if __name__ == '__main__':
    sys.exit(main())

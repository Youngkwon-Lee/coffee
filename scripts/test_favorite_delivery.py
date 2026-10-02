#!/usr/bin/env python3
"""Offline behavioral proofs. No Firebase or Telegram services are contacted."""
import copy
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from scripts import send_favorite_alerts as alerts

NOW = datetime(2026, 10, 2, tzinfo=timezone.utc)
EVENT = {'id': 'event-1', 'bean_id': 'bean-1', 'type': 'restored', 'name': '원두', 'detected_at': NOW}


class Snap:
    def __init__(self, ref):
        self.id = ref.id
        self.payload = copy.deepcopy(ref.db.data.get(ref.path))
        self.exists = self.payload is not None
    def to_dict(self):
        return copy.deepcopy(self.payload)


class Ref:
    def __init__(self, db, path):
        self.db, self.path, self.id = db, path, path.split('/')[-1]
    def get(self, transaction=None):
        return Snap(self)
    def collection(self, name):
        return Collection(self.db, self.path + '/' + name)


class Collection:
    def __init__(self, db, path, filters=()):
        self.db, self.path, self.filters = db, path, filters
    def document(self, id):
        return Ref(self.db, self.path + '/' + id)
    def where(self, field, op, value):
        return Collection(self.db, self.path, self.filters + ((field, op, value),))
    def stream(self):
        for path, data in list(self.db.data.items()):
            if path.rsplit('/', 1)[0] != self.path:
                continue
            if all(data.get(field) == val if op == '==' else data.get(field) >= val for field, op, val in self.filters):
                yield Snap(Ref(self.db, path))


class Tx:
    def __init__(self, db):
        self.db = db
    def set(self, ref, data, merge=False):
        self.db.data[ref.path] = {**(self.db.data.get(ref.path, {}) if merge else {}), **copy.deepcopy(data)}
    def update(self, ref, data):
        self.set(ref, data, merge=True)


class DB:
    def __init__(self):
        self.data, self.lock = {}, threading.RLock()
    def collection(self, path):
        return Collection(self, path)
    def transaction(self):
        return Tx(self)


def atomic(fn):
    def wrapped(tx):
        with tx.db.lock:
            return fn(tx)
    return wrapped


class DeliveryTests(unittest.TestCase):
    def setUp(self):
        self.db = DB()
        self.ledger = alerts.DeliveryLedger(self.db)
        self.patcher = patch.object(alerts.firestore, 'transactional', atomic)
        self.patcher.start()
        self.addCleanup(self.patcher.stop)
    def row(self, uid='u', event=EVENT):
        return self.db.data['favorite_deliveries/' + alerts.delivery_id(uid, event['id'])]
    def test_success_replay_and_user_isolation(self):
        calls = []
        send = lambda: calls.append(True) or alerts.SendResult('sent', message_id=42)
        self.assertEqual(alerts.deliver_event(self.ledger, 'u', EVENT, send, NOW), 'sent')
        self.assertEqual(alerts.deliver_event(self.ledger, 'u', EVENT, send, NOW), 'skipped')
        self.assertEqual(alerts.deliver_event(self.ledger, 'other', EVENT, send, NOW), 'sent')
        self.assertEqual(len(calls), 2)
        self.assertEqual(self.row()['messageId'], 42)
    def test_concurrent_claim_only_one_sends(self):
        calls = []
        def attempt(_):
            return alerts.deliver_event(self.ledger, 'u', EVENT, lambda: calls.append(1) or alerts.SendResult('sent', message_id=1), NOW)
        with ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(attempt, range(8)))
        self.assertEqual(results.count('sent'), 1)
        self.assertEqual(calls, [1])
    def test_unknown_never_automatically_retries(self):
        calls = []
        send = lambda: calls.append(1) or alerts.SendResult('unknown', error='timeout')
        self.assertEqual(alerts.deliver_event(self.ledger, 'u', EVENT, send, NOW), 'unknown')
        self.assertEqual(alerts.deliver_event(self.ledger, 'u', EVENT, send, NOW + timedelta(days=1)), 'unknown')
        self.assertEqual(calls, [1])
    def test_abandoned_claim_becomes_unknown(self):
        first = self.ledger.claim('u', EVENT, NOW)
        self.assertIsNotNone(first.token)
        self.assertEqual(self.ledger.claim('u', EVENT, NOW).status, 'skipped')
        self.assertEqual(self.ledger.claim('u', EVENT, NOW + timedelta(seconds=121)).status, 'unknown')
        self.assertEqual(self.row()['status'], 'unknown')
    def test_rate_limit_retries_after_delay_and_max_attempts(self):
        send = lambda: alerts.SendResult('failed', error='api_429', retryable=True, retry_after=60)
        self.assertEqual(alerts.deliver_event(self.ledger, 'u', EVENT, send, NOW), 'failed')
        self.assertEqual(alerts.deliver_event(self.ledger, 'u', EVENT, send, NOW), 'skipped')
        for minute in (1, 2):
            self.assertEqual(alerts.deliver_event(self.ledger, 'u', EVENT, send, NOW + timedelta(minutes=minute)), 'failed')
        self.assertIsNone(self.ledger.claim('u', EVENT, NOW + timedelta(days=1)).token)
        self.assertEqual(self.row()['attempts'], 3)
    def test_retry_queue_survives_recent_window(self):
        alerts.deliver_event(self.ledger, 'u', EVENT, lambda: alerts.SendResult('failed', retryable=True, retry_after=60), NOW)
        self.assertEqual(self.ledger.retry_events(NOW + timedelta(days=3)), {'u': [EVENT]})
    def test_terminal_failure_not_retried(self):
        alerts.deliver_event(self.ledger, 'u', EVENT, lambda: alerts.SendResult('failed', error='api_403'), NOW)
        self.assertEqual(self.ledger.retry_events(NOW + timedelta(days=1)), {})
        self.assertIsNone(self.ledger.claim('u', EVENT, NOW + timedelta(days=1)).token)
    def test_wrong_claim_cannot_finish(self):
        self.ledger.claim('u', EVENT, NOW)
        with self.assertRaises(RuntimeError):
            self.ledger.finish('u', EVENT['id'], 'wrong', alerts.SendResult('sent'), NOW)
    def test_sender_exception_is_unknown(self):
        def fail(): raise RuntimeError('after send')
        self.assertEqual(alerts.deliver_event(self.ledger, 'u', EVENT, fail, NOW), 'unknown')
    def test_dry_run_is_read_only_and_does_not_send(self):
        self.db.data['users/u'] = {'telegramChatId': '1'}
        self.db.data['users/u/favorites_beans/bean-1'] = {'addedAt': NOW}
        before = copy.deepcopy(self.db.data)
        with patch.object(alerts, 'parse_args', return_value=SimpleNamespace(dry_run=True, verbose=False, since_hours=25)), \
             patch.object(alerts, 'FirebaseClient', return_value=SimpleNamespace(is_available=lambda: True, db=self.db)), \
             patch.object(alerts, 'fetch_recent_events', return_value={'bean-1': [EVENT]}), \
             patch.object(alerts, 'send_telegram') as send:
            self.assertEqual(alerts.main(), 0)
            send.assert_not_called()
        self.assertEqual(self.db.data, before)
    def test_main_surfaces_failed_and_unknown_as_nonzero(self):
        self.db.data['users/u'] = {'telegramChatId': '1'}
        self.db.data['users/u/favorites_beans/bean-1'] = {'addedAt': NOW}
        for status in ('failed', 'unknown'):
            with patch.object(alerts, 'parse_args', return_value=SimpleNamespace(dry_run=False, verbose=False, since_hours=25)), \
                 patch.dict(alerts.os.environ, {'TELEGRAM_BOT_TOKEN': 'fake'}), \
                 patch.object(alerts, 'FirebaseClient', return_value=SimpleNamespace(is_available=lambda: True, db=self.db)), \
                 patch.object(alerts, 'fetch_recent_events', return_value={'bean-1': [EVENT]}), \
                 patch.object(alerts, 'deliver_event', return_value=status):
                self.assertEqual(alerts.main(), 1)

    def test_main_free_expired_and_premium_scope(self):
        events = {}
        for index in range(4):
            bean_id = f'bean-{index}'
            self.db.data[f'users/u/favorites_beans/{bean_id}'] = {'addedAt': NOW + timedelta(seconds=index)}
            events[bean_id] = [{**EVENT, 'id': f'e-{index}', 'bean_id': bean_id}]
        for profile, expected in [({}, 3), ({'plan': 'premium', 'premium_until': NOW - timedelta(days=1)}, 3), ({'plan': 'premium', 'premium_until': datetime.now(timezone.utc) + timedelta(days=30)}, 4)]:
            self.db.data['users/u'] = {'telegramChatId': '1', **profile}
            with patch.object(alerts, 'parse_args', return_value=SimpleNamespace(dry_run=False, verbose=False, since_hours=25)), \
                 patch.dict(alerts.os.environ, {'TELEGRAM_BOT_TOKEN': 'fake'}), \
                 patch.object(alerts, 'FirebaseClient', return_value=SimpleNamespace(is_available=lambda: True, db=self.db)), \
                 patch.object(alerts, 'fetch_recent_events', return_value=events), \
                 patch.object(alerts, 'deliver_event', return_value='sent') as send:
                self.assertEqual(alerts.main(), 0)
                self.assertEqual(send.call_count, expected)


class ContentAndTransportTests(unittest.TestCase):
    def test_only_valid_price_drops(self):
        for old, new, expected in [(3000, 2900, True), (2900, 3000, False), (2900, 2900, False), (True, 1, False), (3000, 0, False), ('3000', 2900, False), (float('inf'), 2900, False)]:
            self.assertEqual(alerts.is_alert_event({'type': 'price_change', 'old_price_krw': old, 'new_price_krw': new}), expected)
        self.assertTrue(alerts.is_alert_event(EVENT))
    def test_message_does_not_promise_restock_or_realtime(self):
        msg = alerts.build_alert_message([EVENT], False, 1)
        self.assertIn('판매페이지에서 다시 확인', msg)
        self.assertIn('실시간 재고 정보가 아닙니다', msg)
        self.assertIn('대상 제외 1개', msg)
        self.assertNotIn('재입고', msg)
    def test_transport_outcomes(self):
        for http, body, expected in [
            (200, {'ok': True, 'result': {'message_id': 1}}, 'sent'),
            (200, {'ok': False}, 'unknown'), (200, {'ok': True}, 'unknown'),
            (429, {'ok': False, 'parameters': {'retry_after': 120}}, 'failed'),
            (403, {'ok': False}, 'failed'), (500, {'ok': False}, 'unknown'),
        ]:
            result = alerts.send_telegram('1', 'test', 'fake', post=lambda *a, **k: SimpleNamespace(status_code=http, json=lambda: body))
            self.assertEqual(result.status, expected)
            self.assertEqual(result.retryable, http == 429)
        def timeout(*a, **k): raise TimeoutError()
        self.assertEqual(alerts.send_telegram('1', 'test', 'fake', post=timeout).status, 'unknown')
    def test_per_chat_throttling_and_rate_limit_cooldown(self):
        clock = [100.0]
        waits, calls = [], []
        def sleep(seconds):
            waits.append(seconds)
            clock[0] += seconds
        def send(chat, message, token):
            calls.append(chat)
            return alerts.SendResult('sent', message_id=len(calls))
        sender = alerts.ThrottledSender('fake', send=send, clock=lambda: clock[0], sleep=sleep)
        sender('1', 'a'); sender('1', 'b'); sender('2', 'c')
        self.assertEqual(calls, ['1', '1', '2'])
        self.assertEqual(len(waits), 1)
        self.assertAlmostEqual(waits[0], 1.1)
        sender.send = lambda *args: alerts.SendResult('failed', retryable=True, retry_after=120)
        sender('3', 'limited')
        sender.send = lambda *args: self.fail('must not call API during cooldown')
        result = sender('3', 'deferred')
        self.assertEqual(result.status, 'failed')
        self.assertTrue(result.retryable)
        self.assertEqual(result.retry_after, 120)

    def test_exact_expiry_boundary(self):
        self.assertFalse(alerts.resolve_premium({'plan': 'premium', 'premium_until': NOW}, 'u', NOW))
        self.assertTrue(alerts.resolve_premium({'plan': 'premium', 'premium_until': NOW + timedelta(microseconds=1)}, 'u', NOW))


class ScopedTestTests(unittest.TestCase):
    setUp = DeliveryTests.setUp
    RUN = '11111111-1111-4111-8111-111111111111'

    def fixture(self):
        now = datetime.now(timezone.utc)
        event = {
            **EVENT, 'id': 'e2e-' + self.RUN, 'is_e2e_test': True, 'e2e_run_id': self.RUN,
            'e2e_uid': 'u', 'e2e_created_at': now, 'detected_at': now,
            'e2e_expires_at': now + timedelta(minutes=30), 'e2e_favorite_created': False,
        }
        self.db.data['bean_events/' + event['id']] = event
        self.db.data['users/u'] = {'telegramChatId': 'self-chat'}
        self.db.data['users/other'] = {'telegramChatId': 'other-chat', 'plan': 'premium'}
        for uid in ('u', 'other'):
            self.db.data[f'users/{uid}/favorites_beans/bean-1'] = {'addedAt': now}
        return event

    def run_scoped(self, event_id, uid='u', dry_run=False):
        args = SimpleNamespace(uid=uid, event_id=event_id, dry_run=dry_run, verbose=False, since_hours=25)
        with patch.object(alerts, 'parse_args', return_value=args), \
             patch.dict(alerts.os.environ, {'TELEGRAM_BOT_TOKEN': 'fake'}), \
             patch.object(alerts, 'FirebaseClient', return_value=SimpleNamespace(is_available=lambda: True, db=self.db)), \
             patch.object(alerts, 'send_telegram', return_value=alerts.SendResult('sent', message_id=7)) as send, \
             patch.object(alerts, 'fetch_recent_events') as recent, \
             patch.object(alerts.DeliveryLedger, 'retry_events') as retries:
            result = alerts.main()
            recent.assert_not_called()
            retries.assert_not_called()
            return result, send.call_args_list

    def test_scope_sends_only_exact_user_event_and_labels_test(self):
        event = self.fixture()
        self.db.data['bean_events/ordinary'] = {**EVENT, 'detected_at': datetime.now(timezone.utc)}
        before = copy.deepcopy(self.db.data['users/u/favorites_beans/bean-1'])
        result, calls = self.run_scoped(event['id'])
        self.assertEqual(result, 0)
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0].args[0], 'self-chat')
        self.assertIn('[TEST]', calls[0].args[1])
        self.assertIn('실제 상품 변화가 아닙니다', calls[0].args[1])
        self.assertEqual(self.db.data['users/u/favorites_beans/bean-1'], before)
        result, calls = self.run_scoped(event['id'])
        self.assertEqual(result, 0)
        self.assertEqual(calls, [])

    def test_daily_query_and_durable_retry_exclude_all_test_markers(self):
        event = self.fixture()
        for name, extra in [('ordinary', {}), ('legacy-test', {'is_e2e_test': True}), ('e2e-partial', {}), ('partial-marker', {'e2e_run_id': self.RUN})]:
            self.db.data['bean_events/' + name] = {**EVENT, 'detected_at': datetime.now(timezone.utc), **extra}
        recent = alerts.fetch_recent_events(self.db, 25)
        self.assertEqual([e['id'] for e in recent['bean-1']], ['ordinary'])
        self.db.data['favorite_deliveries/test-retry'] = {'status': 'failed', 'retryable': True, 'attempts': 1, 'uid': 'u', 'event': event}
        self.assertEqual(self.ledger.retry_events(), {})

    def test_daily_run_never_sends_test_even_when_candidate_fetch_is_mocked(self):
        event = self.fixture()
        args = SimpleNamespace(dry_run=False, verbose=False, since_hours=25)
        with patch.object(alerts, 'parse_args', return_value=args), \
             patch.dict(alerts.os.environ, {'TELEGRAM_BOT_TOKEN': 'fake'}), \
             patch.object(alerts, 'FirebaseClient', return_value=SimpleNamespace(is_available=lambda: True, db=self.db)), \
             patch.object(alerts, 'fetch_recent_events', return_value={'bean-1': [event]}), \
             patch.object(alerts, 'send_telegram') as send:
            self.assertEqual(alerts.main(), 0)
            send.assert_not_called()

    def test_wrong_owner_expired_missing_or_non_test_event_never_sends(self):
        for change in [{'e2e_uid': 'other'}, {'is_e2e_test': False}, {'e2e_run_id': 'wrong'}, {'e2e_expires_at': NOW}, {'e2e_created_at': NOW}, {'e2e_favorite_created': 'true'}]:
            event = self.fixture()
            self.db.data['bean_events/' + event['id']].update(change)
            result, calls = self.run_scoped(event['id'])
            self.assertEqual(result, 1)
            self.assertEqual(calls, [])
        self.db.data.pop('bean_events/' + event['id'])
        self.assertEqual(self.run_scoped(event['id']), (1, []))

    def test_current_free_allowance_not_bypassed(self):
        event = self.fixture()
        for index in range(3):
            self.db.data[f'users/u/favorites_beans/older-{index}'] = {'addedAt': NOW}
        self.assertEqual(self.run_scoped(event['id']), (1, []))
        self.db.data['users/u']['plan'] = 'premium'
        self.db.data['users/u']['premium_until'] = NOW - timedelta(days=1)
        self.assertEqual(self.run_scoped(event['id']), (1, []))

    def test_unlinked_user_is_rejected(self):
        event = self.fixture()
        del self.db.data['users/u']['telegramChatId']
        self.assertEqual(self.run_scoped(event['id']), (1, []))
        self.db.data.pop('users/u')
        self.assertEqual(self.run_scoped(event['id']), (1, []))

    def test_synthetic_favorite_ownership_and_dry_run(self):
        event = self.fixture()
        event.update(bean_id='e2e-favorite-' + self.RUN, e2e_favorite_created=True)
        self.db.data['bean_events/' + event['id']] = event
        path = 'users/u/favorites_beans/' + event['bean_id']
        self.db.data[path] = {'is_e2e_test': True, 'e2e_uid': 'u', 'e2e_run_id': self.RUN, 'e2e_created_at': event['e2e_created_at'], 'addedAt': event['e2e_created_at']}
        before = copy.deepcopy(self.db.data)
        self.assertEqual(self.run_scoped(event['id'], dry_run=True), (0, []))
        self.assertEqual(self.db.data, before)
        self.db.data[path]['e2e_uid'] = 'other'
        self.assertEqual(self.run_scoped(event['id']), (1, []))

    def test_cli_requires_paired_well_formed_scope(self):
        import contextlib
        import io
        for argv in [['--uid', 'u'], ['--event-id', 'e2e-' + self.RUN], ['--uid', 'u/path', '--event-id', 'e2e-' + self.RUN], ['--uid', 'u', '--event-id', 'ordinary'], ['--uid', 'u', '--event-id', 'e2e-test-restock']]:
            with patch.object(sys, 'argv', ['send_favorite_alerts.py'] + argv), contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
                alerts.parse_args()


if __name__ == '__main__':
    unittest.main(verbosity=2)

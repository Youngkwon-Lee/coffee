import test from 'node:test';
import assert from 'node:assert/strict';
import { activatePayment, calculateExpiry, paymentDocumentId, transitionRequest } from '../lib/premium.mjs';
import { premiumState, isPremium, timestampMillis, parsePremiumRequest, PREMIUM_PRICE_KRW, PREMIUM_PERIOD_DAYS } from '../../src/lib/premium.ts';

const NOW = new Date('2026-10-02T00:00:00Z');
const REQUEST = '11111111-1111-4111-8111-111111111111';
const input = overrides => ({ uid: 'u', requestId: REQUEST, reference: 'bank-transaction-001', amount: 2900, currency: 'KRW', confirmedAt: NOW, ...overrides });

class MemoryDb {
  constructor() {
    this.rows = {
      'users/u': { plan: 'free', telegramChatId: '1' },
      'premium_config/pilot': { salesEnabled: true },
      'premium_requests/u': { uid: 'u', requestId: REQUEST, status: 'awaiting_payment', priceKrw: 2900, periodDays: 30, currency: 'KRW' },
    };
    this.queue = Promise.resolve();
  }
  collection(name) { return { doc: id => ({ path: `${name}/${id}`, id }) }; }
  runTransaction(fn) {
    const run = this.queue.then(async () => {
      const staged = structuredClone(this.rows);
      const result = await fn({
        get: async ref => ({ exists: Boolean(staged[ref.path]), data: () => structuredClone(staged[ref.path]) }),
        create: (ref, data) => { if (staged[ref.path]) throw new Error('already exists'); staged[ref.path] = structuredClone(data); },
        update: (ref, data) => { if (!staged[ref.path]) throw new Error('missing'); staged[ref.path] = { ...staged[ref.path], ...structuredClone(data) }; },
      });
      this.rows = staged;
      return result;
    });
    this.queue = run.catch(() => {});
    return run;
  }
}

test('shared product is 2900 KRW for 30 days', () => {
  assert.equal(PREMIUM_PRICE_KRW, 2900);
  assert.equal(PREMIUM_PERIOD_DAYS, 30);
});
test('expiry is 30 exact days, including month end and leap years', () => {
  assert.equal(calculateExpiry({}, new Date('2026-01-31T12:00:00Z')).toISOString(), '2026-03-02T12:00:00.000Z');
  assert.equal(calculateExpiry({}, new Date('2028-01-31T12:00:00Z')).toISOString(), '2028-03-01T12:00:00.000Z');
});
test('early renewal preserves remainder; expired grant starts now', () => {
  assert.equal(calculateExpiry({ plan: 'premium', premium_until: '2026-10-15T00:00:00Z' }, NOW).toISOString(), '2026-11-14T00:00:00.000Z');
  assert.equal(calculateExpiry({ plan: 'premium', premium_until: '2026-09-01T00:00:00Z' }, NOW).toISOString(), '2026-11-01T00:00:00.000Z');
});
test('undated manual access is preserved but not silently converted into a paid period', () => {
  assert.equal(premiumState({ plan: 'PREMIUM' }, +NOW), 'manual');
  assert.equal(isPremium({ plan: 'premium' }, +NOW), true);
  assert.throws(() => calculateExpiry({ plan: 'premium' }, NOW), /수동 권한/);
});
test('UI entitlement boundary, invalid formats and legacy timestamp forms', () => {
  assert.equal(premiumState({ plan: 'premium', premium_until: NOW }, +NOW), 'expired');
  assert.equal(premiumState({ plan: 'premium', premium_until: new Date(+NOW + 1) }, +NOW), 'active');
  assert.equal(premiumState({ plan: 'premium', premium_until: 'invalid' }, +NOW), 'invalid');
  assert.equal(premiumState({ plan: 'free', premium_until: '2099-01-01T00:00:00Z' }, +NOW), 'free');
  assert.equal(timestampMillis({ toMillis: () => +NOW }), +NOW);
  assert.equal(timestampMillis('2026-10-02T00:00:00'), +NOW);
  assert.equal(premiumState({ plan: 'premium', premiumUntil: NOW }, +NOW), 'expired');
  assert.ok(Number.isNaN(timestampMillis(12345)));
  assert.equal(premiumState({ plan: 'premium', premium_until: '2099-02-30T00:00:00Z' }, +NOW), 'invalid');
  assert.equal(premiumState({ plan: 'premium', premium_until: '2099-01-01T24:00:00Z' }, +NOW), 'invalid');
  assert.ok(Number.isNaN(timestampMillis({ seconds: 9999999999 })));
  assert.equal(timestampMillis('2026-10-02T09:00:00+09:00'), +NOW);
});
test('request parser distinguishes legacy and current lifecycle', () => {
  assert.equal(parsePremiumRequest({ status: 'pending' }), null);
  assert.deepEqual(parsePremiumRequest({ requestId: REQUEST, status: 'activated' }), { requestId: REQUEST, status: 'activated' });
  assert.equal(parsePremiumRequest({ requestId: REQUEST, status: 'arbitrary' }), null);
});
test('dry-run performs no writes', async () => {
  const db = new MemoryDb(), before = structuredClone(db.rows);
  const result = await activatePayment(db, input(), { now: NOW });
  assert.equal(result.applied, false);
  assert.deepEqual(db.rows, before);
});
test('confirmed activation atomically records payment, entitlement and closed request', async () => {
  const db = new MemoryDb();
  const result = await activatePayment(db, input(), { apply: true, now: NOW });
  assert.equal(result.applied, true);
  assert.equal(db.rows['users/u'].premium_until.toISOString(), '2026-11-01T00:00:00.000Z');
  assert.equal(db.rows['premium_requests/u'].status, 'activated');
  const payment = db.rows[`premium_payments/${paymentDocumentId(input().reference)}`];
  assert.equal(payment.verification, 'operator_confirmed');
  assert.equal(payment.amount, 2900);
});
test('same payment replay is a no-op even on a later day', async () => {
  const db = new MemoryDb();
  await activatePayment(db, input(), { apply: true, now: NOW });
  const before = structuredClone(db.rows);
  assert.equal((await activatePayment(db, input(), { apply: true, now: new Date(+NOW + 86400000) })).duplicate, true);
  assert.deepEqual(db.rows, before);
});
test('concurrent replay activates only once', async () => {
  const db = new MemoryDb();
  const results = await Promise.all(Array.from({ length: 8 }, () => activatePayment(db, input(), { apply: true, now: NOW })));
  assert.equal(results.filter(r => r.applied).length, 1);
  assert.equal(Object.keys(db.rows).filter(k => k.startsWith('premium_payments/')).length, 1);
});
test('payment reference cannot cross users or request IDs', async () => {
  const db = new MemoryDb();
  await activatePayment(db, input(), { apply: true, now: NOW });
  await assert.rejects(activatePayment(db, input({ uid: 'other' }), { apply: true, now: NOW }), /다른 사용자/);
  await assert.rejects(activatePayment(db, input({ requestId: 'other-request' }), { apply: true, now: NOW }), /다른 사용자/);
});
test('a second reference cannot pay the same already closed request', async () => {
  const db = new MemoryDb();
  await activatePayment(db, input(), { apply: true, now: NOW });
  await assert.rejects(activatePayment(db, input({ reference: 'bank-transaction-002' }), { apply: true, now: NOW }), /awaiting_payment/);
});
test('reject wrong amount/currency, invalid/future confirmation and malformed references without writes', async () => {
  for (const change of [{ amount: 1 }, { amount: 2900.1 }, { currency: 'USD' }, { confirmedAt: new Date('invalid') }, { confirmedAt: new Date(+NOW + 1) }, { reference: ' padded ' }, { reference: '' }]) {
    const db = new MemoryDb(), before = structuredClone(db.rows);
    await assert.rejects(activatePayment(db, input(change), { apply: true, now: NOW }));
    assert.deepEqual(db.rows, before);
  }
});
test('missing readiness, unlinked users and wrong request state fail closed', async () => {
  for (const mutate of [db => delete db.rows['premium_config/pilot'], db => db.rows['premium_config/pilot'].salesEnabled = false, db => delete db.rows['users/u'].telegramChatId, db => db.rows['premium_requests/u'].status = 'pending', db => db.rows['premium_requests/u'].periodDays = 31, db => db.rows['users/u'].premium_until = 'broken']) {
    const db = new MemoryDb(); mutate(db);
    await assert.rejects(activatePayment(db, input(), { apply: true, now: NOW }));
  }
});
test('request transition dry-run, activation preparation and repeated transition', async () => {
  const db = new MemoryDb(); db.rows['premium_requests/u'].status = 'pending';
  await transitionRequest(db, 'u', REQUEST, 'awaiting_payment');
  assert.equal(db.rows['premium_requests/u'].status, 'pending');
  await transitionRequest(db, 'u', REQUEST, 'awaiting_payment', { apply: true, now: NOW });
  assert.equal(db.rows['premium_requests/u'].status, 'awaiting_payment');
  assert.equal((await transitionRequest(db, 'u', REQUEST, 'awaiting_payment', { apply: true })).duplicate, true);
  await assert.rejects(transitionRequest(db, 'u', 'wrong', 'declined'), /ID/);
});

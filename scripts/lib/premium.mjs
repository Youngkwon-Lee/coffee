import { createHash } from 'node:crypto';
import { PREMIUM_PRICE_KRW, PREMIUM_PERIOD_DAYS, DAY_MS, premiumUntilMillis } from '../../src/lib/premium.ts';

export { PREMIUM_PRICE_KRW, PREMIUM_PERIOD_DAYS };
export function paymentDocumentId(reference) {
  if (typeof reference !== 'string' || reference.trim() !== reference || reference.length < 3 || reference.length > 160) {
    throw new Error('입금 reference는 공백 없는 양끝, 3~160자의 고유 거래 식별값이어야 합니다.');
  }
  return createHash('sha256').update(reference).digest('hex');
}

export function calculateExpiry(profile, now) {
  const until = premiumUntilMillis(profile);
  if (until !== null && !Number.isFinite(until)) throw new Error('기존 만료일이 유효하지 않습니다. 먼저 운영자가 확인해야 합니다.');
  if (String(profile.plan ?? '').toLowerCase() === 'premium' && until === null) {
    throw new Error('만료 없는 수동 권한은 자동 변환하지 않습니다. 기간을 먼저 확인하세요.');
  }
  const base = String(profile.plan ?? '').toLowerCase() === 'premium' && until > now.getTime() ? until : now.getTime();
  return new Date(base + PREMIUM_PERIOD_DAYS * DAY_MS);
}

function validateInput(input, now) {
  for (const key of ['uid', 'requestId']) {
    if (typeof input[key] !== 'string' || !input[key] || input[key].includes('/')) throw new Error(`${key}가 올바르지 않습니다.`);
  }
  paymentDocumentId(input.reference);
  if (input.amount !== PREMIUM_PRICE_KRW || input.currency !== 'KRW') throw new Error('금액/통화가 2,900 KRW와 일치해야 합니다.');
  if (!(input.confirmedAt instanceof Date) || !Number.isFinite(input.confirmedAt.getTime()) || input.confirmedAt > now) {
    throw new Error('confirmed-at은 미래가 아닌 유효한 입금 확인 시각이어야 합니다.');
  }
}

/** All reads precede writes; Firestore retries concurrent extensions safely. */
export async function activatePayment(db, input, { apply = false, now = new Date() } = {}) {
  validateInput(input, now);
  const paymentRef = db.collection('premium_payments').doc(paymentDocumentId(input.reference));
  const userRef = db.collection('users').doc(input.uid);
  const requestRef = db.collection('premium_requests').doc(input.uid);
  const configRef = db.collection('premium_config').doc('pilot');
  return db.runTransaction(async (tx) => {
    const [payment, user, request, config] = await Promise.all([paymentRef, userRef, requestRef, configRef].map(ref => tx.get(ref)));
    if (payment.exists) {
      const existing = payment.data();
      if (existing.uid !== input.uid || existing.requestId !== input.requestId || existing.amount !== input.amount || existing.currency !== input.currency) {
        throw new Error('이미 다른 사용자/신청/금액에 사용된 입금 reference입니다.');
      }
      return { duplicate: true, applied: false, expiresAt: existing.expiresAt };
    }
    if (!user.exists || !user.data().telegramChatId) throw new Error('사용자와 텔레그램 연결을 먼저 확인하세요.');
    if (!config.exists || config.data().salesEnabled !== true) throw new Error('유료 파일럿의 판매 준비 확인이 아직 완료되지 않았습니다.');
    const req = request.data();
    if (!req || req.requestId !== input.requestId || req.uid !== input.uid || req.status !== 'awaiting_payment') {
      throw new Error('일치하는 awaiting_payment 신청이 필요합니다.');
    }
    if (req.priceKrw !== PREMIUM_PRICE_KRW || req.periodDays !== PREMIUM_PERIOD_DAYS || req.currency !== 'KRW') {
      throw new Error('신청 상품 조건이 현재 파일럿과 다릅니다.');
    }
    const expiresAt = calculateExpiry(user.data(), now);
    if (apply) {
      tx.create(paymentRef, {
        uid: input.uid, requestId: input.requestId, reference: input.reference,
        amount: input.amount, currency: input.currency, periodDays: PREMIUM_PERIOD_DAYS,
        confirmedAt: input.confirmedAt, recordedAt: now, expiresAt,
        verification: 'operator_confirmed',
      });
      tx.update(userRef, { plan: 'premium', premium_until: expiresAt, premium_updated_at: now });
      tx.update(requestRef, { status: 'activated', processedAt: now, paymentId: paymentRef.id });
    }
    return { duplicate: false, applied: apply, expiresAt };
  });
}

export async function transitionRequest(db, uid, requestId, status, { apply = false, now = new Date() } = {}) {
  if (!uid || uid.includes('/') || !requestId || !['awaiting_payment', 'declined', 'cancelled'].includes(status)) throw new Error('신청 전이 인수가 올바르지 않습니다.');
  const ref = db.collection('premium_requests').doc(uid);
  return db.runTransaction(async tx => {
    const [snap, config] = await Promise.all([tx.get(ref), tx.get(db.collection('premium_config').doc('pilot'))]);
    const current = snap.data();
    if (!current || current.requestId !== requestId) throw new Error('신청 ID가 일치하지 않습니다.');
    if (current.status === status) return { duplicate: true, applied: false };
    if (!['pending', 'awaiting_payment'].includes(current.status)) throw new Error('이미 종료된 신청입니다.');
    if (status === 'awaiting_payment' && (!config.exists || config.data().salesEnabled !== true)) throw new Error('판매 준비가 완료되지 않았습니다.');
    if (apply) tx.update(ref, { status, processedAt: now });
    return { duplicate: false, applied: apply, status };
  });
}

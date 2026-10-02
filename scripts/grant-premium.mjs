#!/usr/bin/env node
/** Operator tool. Defaults to read-only planning; never contacts users or a bank. */
import admin from 'firebase-admin';
import { activatePayment, transitionRequest } from './lib/premium.mjs';

const args = process.argv.slice(2);
const options = new Map();
const flags = new Set(['help', 'apply', 'requests', 'list', 'revoke']);
const values = new Set(['uid', 'request-id', 'status', 'payment-reference', 'amount', 'confirmed-at']);
const has = name => options.has(name);
const arg = name => options.get(name);

function parseOptions() {
  for (let i = 0; i < args.length; i++) {
    const name = args[i].startsWith('--') ? args[i].slice(2) : '';
    if ((!flags.has(name) && !values.has(name)) || options.has(name)) throw new Error(`알 수 없거나 중복된 옵션: ${args[i]}`);
    if (flags.has(name)) options.set(name, true);
    else {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`--${name} 값이 필요합니다.`);
      options.set(name, value);
    }
  }
}

async function main() {
  parseOptions();
  if (has('help') || args.length === 0) {
    console.log(`Node 24 required. Every mutation defaults to dry-run; add --apply only after review.
--requests | --list
--uid UID --request-id ID --status awaiting_payment|declined|cancelled
--uid UID --request-id ID --payment-reference REF --amount 2900 --confirmed-at ISO
--uid UID --revoke
No automatic payments. One confirmed reference grants 30 days, preserving remaining paid time.`);
    return;
  }
  if (['requests', 'list', 'revoke', 'status', 'payment-reference'].filter(has).length !== 1) throw new Error('한 번에 하나의 동작만 지정하세요. --help 참조');
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const serviceAccount = raw ? JSON.parse(raw) : null;
  const projectId = 'coffee-37b81';
  const configuredProject = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  if (serviceAccount && serviceAccount.project_id !== projectId) throw new Error('서비스 계정 프로젝트가 coffee-37b81과 다릅니다.');
  if (configuredProject && configuredProject !== projectId) throw new Error('설정된 프로젝트가 coffee-37b81과 다릅니다.');
  if (process.env.FIRESTORE_EMULATOR_HOST) throw new Error('이 운영 CLI는 emulator에서 사용하지 않습니다. 순수 helper를 demo 프로젝트 테스트에서 호출하세요.');
  admin.initializeApp({ projectId, credential: serviceAccount ? admin.credential.cert(serviceAccount) : admin.credential.applicationDefault() });
  const db = admin.firestore();
  const apply = has('apply');
  if (has('requests')) {
    const snap = await db.collection('premium_requests').where('status', 'in', ['pending', 'awaiting_payment']).get();
    for (const row of snap.docs) console.log(JSON.stringify({ uid: row.id, ...row.data() }));
    console.log(`미처리 신청 ${snap.size}건. 입금 여부는 은행 거래 내역으로 별도 확인하세요.`);
    return;
  }
  if (has('list')) {
    const snap = await db.collection('users').where('plan', '==', 'premium').get();
    for (const row of snap.docs) console.log(JSON.stringify({ uid: row.id, premium_until: row.data().premium_until ?? null }));
    console.log(`권한 ${snap.size}건. 결제 고객 수나 매출 집계가 아닙니다.`);
    return;
  }
  const uid = arg('uid');
  if (!uid || uid.includes('/')) throw new Error('--uid가 필요합니다.');
  if (has('revoke')) {
    const ref = db.collection('users').doc(uid);
    if (!(await ref.get()).exists) throw new Error('사용자가 존재하지 않습니다.');
    if (apply) await ref.update({ plan: 'free', premium_until: admin.firestore.FieldValue.delete(), premiumUntil: admin.firestore.FieldValue.delete(), premium_updated_at: admin.firestore.FieldValue.serverTimestamp() });
    console.log(`${apply ? 'APPLIED' : 'DRY-RUN'}: 권한 해지. 입금 원장은 보존되며 환불을 실행하지 않습니다.`);
    return;
  }
  let result;
  if (has('status')) {
    result = await transitionRequest(db, uid, arg('request-id'), arg('status'), { apply });
  } else {
    if (!/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:\d{2})$/.test(arg('confirmed-at') ?? '')) throw new Error('--confirmed-at은 타임존을 포함한 ISO 시각이어야 합니다.');
    result = await activatePayment(db, {
      uid, requestId: arg('request-id'), reference: arg('payment-reference'),
      amount: Number(arg('amount')), currency: 'KRW', confirmedAt: new Date(arg('confirmed-at') ?? ''),
    }, { apply });
  }
  console.log(JSON.stringify({ mode: apply ? 'APPLY' : 'DRY-RUN', ...result }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

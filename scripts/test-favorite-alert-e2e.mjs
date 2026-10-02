#!/usr/bin/env node
/** Scoped fixture tool. It never sends messages or overwrites a real favorite.
 * node scripts/test-favorite-alert-e2e.mjs --uid UID --run-id UUID --setup
 * python scripts/send_favorite_alerts.py --uid UID --event-id e2e-UUID
 * node scripts/test-favorite-alert-e2e.mjs --uid UID --run-id UUID --cleanup
 * Keep the delivery ledger. A new test needs a fresh UUID.
 */
import { pathToFileURL } from 'node:url';
import { isPremium } from '../src/lib/premium.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const UID = /^[A-Za-z0-9:_-]{1,128}$/;
export function validateScope(uid, runId) {
  if (typeof uid !== 'string' || !UID.test(uid) || typeof runId !== 'string' || !UUID.test(runId)) {
    throw new Error('A valid --uid and lowercase UUIDv4 --run-id are required.');
  }
  return { eventId: `e2e-${runId}`, favoriteId: `e2e-favorite-${runId}` };
}
function millis(value) {
  if (value instanceof Date) return value.getTime();
  return typeof value?.toMillis === 'function' ? value.toMillis() : NaN;
}
function favoriteTime(data) {
  const value = data.addedAt || data.createdAt;
  if (typeof value === 'number' && Number.isFinite(value)) return value * 1000;
  const valueMs = millis(value);
  return Number.isFinite(valueMs) ? valueMs : 0;
}
function assertOwnership(event, uid, runId, eventId) {
  if (!event || event.is_e2e_test !== true || event.e2e_uid !== uid || event.e2e_run_id !== runId
    || eventId !== `e2e-${runId}` || typeof event.e2e_favorite_created !== 'boolean'
    || !Number.isFinite(millis(event.e2e_created_at)) || millis(event.e2e_created_at) !== millis(event.detected_at)) {
    throw new Error('Fixture ownership does not match; no documents were changed.');
  }
}

export async function setupFixture(db, uid, runId, now = new Date()) {
  const { eventId, favoriteId } = validateScope(uid, runId);
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid fixture creation time.');
  const userRef = db.collection('users').doc(uid);
  const eventRef = db.collection('bean_events').doc(eventId);
  return db.runTransaction(async tx => {
    const [user, existing, favorites] = await Promise.all([
      tx.get(userRef), tx.get(eventRef), tx.get(userRef.collection('favorites_beans')),
    ]);
    if (!user.exists || !user.data().telegramChatId) throw new Error('An existing Telegram-linked user is required.');
    if (existing.exists) {
      assertOwnership(existing.data(), uid, runId, eventId);
      return { eventId, reused: true, favoriteCreated: existing.data().e2e_favorite_created };
    }
    const ordered = favorites.docs.map(row => ({ id: row.id, data: row.data() }))
      .sort((a, b) => favoriteTime(a.data) - favoriteTime(b.data) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const eligible = isPremium(user.data(), now.getTime()) ? ordered : ordered.slice(0, 3);
    // Never target another active test run or move a real favorite into the free quota.
    const target = eligible.find(row => !row.id.startsWith('e2e-') && !row.data.is_e2e_test);
    if (!target && ordered.length) throw new Error('No eligible non-test favorite. Finish the prior fixture or choose a different linked user.');
    const created = ordered.length === 0;
    const beanId = target?.id ?? favoriteId;
    const ownership = { is_e2e_test: true, e2e_uid: uid, e2e_run_id: runId, e2e_created_at: now };
    const favoriteRef = userRef.collection('favorites_beans').doc(beanId);
    if (created) tx.create(favoriteRef, { ...ownership, addedAt: now });
    tx.create(eventRef, {
      ...ownership, e2e_favorite_created: created, e2e_expires_at: new Date(now.getTime() + 30 * 60 * 1000),
      bean_id: beanId, type: 'restored', brand: '원두레이더 테스트', name: '[TEST] 개인 알림 연결 확인',
      new_price_krw: null, detected_at: now,
    });
    return { eventId, reused: false, favoriteCreated: created };
  });
}

export async function cleanupFixture(db, uid, runId) {
  const { eventId, favoriteId } = validateScope(uid, runId);
  const eventRef = db.collection('bean_events').doc(eventId);
  return db.runTransaction(async tx => {
    const event = await tx.get(eventRef);
    if (!event.exists) return { eventId, removed: false, favoriteRemoved: false };
    const data = event.data();
    assertOwnership(data, uid, runId, eventId);
    let ownedFavoriteRef = null;
    if (data.e2e_favorite_created) {
      if (data.bean_id !== favoriteId) throw new Error('Synthetic favorite path mismatch; cleanup refused.');
      const ref = db.collection('users').doc(uid).collection('favorites_beans').doc(favoriteId);
      const favorite = await tx.get(ref);
      if (favorite.exists) {
        const f = favorite.data();
        if (f.is_e2e_test !== true || f.e2e_uid !== uid || f.e2e_run_id !== runId
          || millis(f.e2e_created_at) !== millis(data.e2e_created_at)
          || millis(f.addedAt) !== millis(data.e2e_created_at)) {
          throw new Error('Favorite ownership changed; cleanup refused.');
        }
        ownedFavoriteRef = ref;
      }
    }
    if (ownedFavoriteRef) tx.delete(ownedFavoriteRef);
    tx.delete(eventRef);
    return { eventId, removed: true, favoriteRemoved: Boolean(ownedFavoriteRef) };
  });
}

export function parseOptions(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!['--uid', '--run-id', '--setup', '--cleanup'].includes(key) || key in options) throw new Error('Unknown or duplicate option.');
    if (key === '--setup' || key === '--cleanup') options[key] = true;
    else {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw new Error(`${key} requires a value.`);
      options[key] = value;
    }
  }
  validateScope(options['--uid'], options['--run-id']);
  if (Boolean(options['--setup']) === Boolean(options['--cleanup'])) throw new Error('Choose exactly one of --setup or --cleanup.');
  return options;
}
async function main() {
  const options = parseOptions(process.argv.slice(2));
  const { default: admin } = await import('firebase-admin');
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const account = raw ? JSON.parse(raw) : null;
  if (account && account.project_id !== 'coffee-37b81') throw new Error('Service account project mismatch.');
  admin.initializeApp({ projectId: 'coffee-37b81', credential: account ? admin.credential.cert(account) : admin.credential.applicationDefault() });
  const result = options['--setup']
    ? await setupFixture(admin.firestore(), options['--uid'], options['--run-id'])
    : await cleanupFixture(admin.firestore(), options['--uid'], options['--run-id']);
  console.log(JSON.stringify(result));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { setupFixture, cleanupFixture, parseOptions, validateScope } from '../test-favorite-alert-e2e.mjs';
const RUN = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const NOW = new Date('2026-10-03T00:00:00Z');
class Ref {
  constructor(path) { this.path = path; this.id = path.split('/').at(-1); }
  collection(name) { return new Collection(`${this.path}/${name}`); }
}
class Collection {
  constructor(path) { this.path = path; this.query = true; }
  doc(id) { return new Ref(`${this.path}/${id}`); }
}
class DB {
  constructor(favorites = true) {
    this.rows = { 'users/u': { telegramChatId: '123', plan: 'free' } };
    if (favorites) this.rows['users/u/favorites_beans/real'] = { addedAt: new Date('2020-01-01'), note: 'keep me' };
  }
  collection(path) { return new Collection(path); }
  async runTransaction(fn) {
    const staged = structuredClone(this.rows);
    const snapshot = (path, data) => ({ id: path.split('/').at(-1), exists: data !== undefined, data: () => structuredClone(data) });
    const result = await fn({
      get: async ref => ref.query ? { docs: Object.entries(staged).filter(([path]) => path.slice(0, path.lastIndexOf('/')) === ref.path).map(([path, data]) => snapshot(path, data)) } : snapshot(ref.path, staged[ref.path]),
      create: (ref, data) => { if (staged[ref.path]) throw new Error('exists'); staged[ref.path] = structuredClone(data); },
      delete: ref => { delete staged[ref.path]; },
    });
    this.rows = staged;
    return result;
  }
}
test('existing eligible favorite is never written or deleted', async () => {
  const db = new DB(), original = structuredClone(db.rows);
  const result = await setupFixture(db, 'u', RUN, NOW);
  assert.equal(result.favoriteCreated, false);
  assert.deepEqual(db.rows['users/u/favorites_beans/real'], original['users/u/favorites_beans/real']);
  assert.equal(db.rows[`bean_events/e2e-${RUN}`].bean_id, 'real');
  await cleanupFixture(db, 'u', RUN);
  assert.deepEqual(db.rows, original);
});
test('empty favorites create one owned synthetic fixture and remove it exactly', async () => {
  const db = new DB(false), original = structuredClone(db.rows);
  await setupFixture(db, 'u', RUN, NOW);
  const favorite = db.rows[`users/u/favorites_beans/e2e-favorite-${RUN}`];
  assert.equal(favorite.e2e_uid, 'u');
  assert.deepEqual(favorite.addedAt, NOW);
  const result = await cleanupFixture(db, 'u', RUN);
  assert.equal(result.favoriteRemoved, true);
  assert.deepEqual(db.rows, original);
});
test('setup replay cannot mutate immutable fixture timestamps', async () => {
  const db = new DB(false);
  await setupFixture(db, 'u', RUN, NOW);
  const before = structuredClone(db.rows);
  assert.equal((await setupFixture(db, 'u', RUN, new Date(+NOW + 1000))).reused, true);
  assert.deepEqual(db.rows, before);
});
test('cleanup checks run/user ownership and preserves other runs and delivery receipts', async () => {
  const db = new DB();
  await setupFixture(db, 'u', RUN, NOW);
  await setupFixture(db, 'u', OTHER, NOW);
  db.rows['favorite_deliveries/receipt'] = { eventId: `e2e-${RUN}`, status: 'sent' };
  const before = structuredClone(db.rows);
  await assert.rejects(cleanupFixture(db, 'wrong-user', RUN), /ownership/);
  assert.deepEqual(db.rows, before);
  await cleanupFixture(db, 'u', RUN);
  assert.ok(db.rows[`bean_events/e2e-${OTHER}`]);
  assert.ok(db.rows['favorite_deliveries/receipt']);
  assert.ok(db.rows['users/u/favorites_beans/real']);
  assert.equal((await cleanupFixture(db, 'u', RUN)).removed, false);
});
test('cleanup refuses replaced or modified synthetic favorite', async () => {
  for (const changed of [{ addedAt: new Date(+NOW + 1) }, { e2e_uid: 'other' }, { is_e2e_test: false }]) {
    const db = new DB(false);
    await setupFixture(db, 'u', RUN, NOW);
    Object.assign(db.rows[`users/u/favorites_beans/e2e-favorite-${RUN}`], changed);
    const before = structuredClone(db.rows);
    await assert.rejects(cleanupFixture(db, 'u', RUN), /ownership/);
    assert.deepEqual(db.rows, before);
  }
});
test('forged event cannot authorize deletion of an existing real favorite', async () => {
  const db = new DB();
  await setupFixture(db, 'u', RUN, NOW);
  db.rows[`bean_events/e2e-${RUN}`].e2e_favorite_created = true;
  const before = structuredClone(db.rows);
  await assert.rejects(cleanupFixture(db, 'u', RUN), /path mismatch/);
  assert.deepEqual(db.rows, before);
});
test('setup requires linked existing user and never changes plan or favorites to bypass quota', async () => {
  const db = new DB();
  await assert.rejects(setupFixture(db, 'missing', RUN, NOW), /linked/);
  delete db.rows['users/u'].telegramChatId;
  await assert.rejects(setupFixture(db, 'u', RUN, NOW), /linked/);
  const full = new DB(false);
  for (let index = 0; index < 3; index++) full.rows[`users/u/favorites_beans/e2e-old-${index}`] = { is_e2e_test: true, addedAt: new Date(0) };
  full.rows['users/u/favorites_beans/fourth-real'] = { addedAt: NOW };
  const before = structuredClone(full.rows);
  await assert.rejects(setupFixture(full, 'u', RUN, NOW), /eligible/);
  assert.deepEqual(full.rows, before);
});
test('malformed or ambiguous scope is rejected before DB initialization', () => {
  for (const args of [[], ['--uid', 'u', '--setup'], ['--uid', 'u', '--run-id', RUN, '--setup', '--cleanup'], ['--uid', 'u', '--run-id', RUN, '--setup', '--uid', 'other'], ['--uid', 'u/path', '--run-id', RUN, '--setup'], ['--uid', 'u', '--run-id', 'fixed-id', '--setup']]) {
    assert.throws(() => parseOptions(args));
  }
  assert.throws(() => validateScope('u', 'AAAAAAAA-1111-4111-8111-111111111111'));
  assert.equal(parseOptions(['--uid', 'u', '--run-id', RUN, '--setup'])['--setup'], true);
});

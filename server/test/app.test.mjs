import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cookieOf, makeServer, ORIGIN, signIn } from './helpers.mjs';

const attempts = (...stars) => stars.map((s, i) => ({ moves: 10 + i, stars: s }));
const progressDoc = (changes = {}) => ({
  solved: 3,
  current: 4,
  hints: 2,
  spareUndos: 0,
  records: {},
  dailyDone: null,
  daily: {},
  ...changes
});

const withCookie = (cookie) => (cookie ? { cookie } : {});
const put = (app, cookie, doc) =>
  app.inject({ method: 'PUT', url: '/progress', headers: withCookie(cookie), payload: { doc } });
const get = (app, cookie, url) => app.inject({ method: 'GET', url, headers: withCookie(cookie) });

describe('health and CORS', () => {
  it('answers /healthz', async () => {
    const { app } = await makeServer();
    const response = await app.inject({ method: 'GET', url: '/healthz' });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { ok: true });
  });

  it('lets only the listed pages call it, with cookies', async () => {
    const { app } = await makeServer();
    const allowed = await app.inject({ method: 'GET', url: '/me', headers: { origin: ORIGIN } });
    assert.equal(allowed.headers['access-control-allow-origin'], ORIGIN);
    assert.equal(allowed.headers['access-control-allow-credentials'], 'true');

    const other = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { origin: 'https://evil.example' }
    });
    assert.equal(other.headers['access-control-allow-origin'], undefined);
  });
});

describe('signing in', () => {
  it('makes a user and a session cookie from a good sign-in token', async () => {
    const { app } = await makeServer();
    const response = await app.inject({
      method: 'POST',
      url: '/auth/firebase',
      payload: { idToken: 'valid:abc' }
    });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json().user.username, null);
    const cookie = response.cookies.find((item) => item.name === 'suloop_session');
    assert.ok(cookie.value.length >= 40);
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.sameSite, 'Lax');
  });

  it('knows the same account again, and keeps one user', async () => {
    const { app, db } = await makeServer();
    await signIn(app, 'abc');
    await signIn(app, 'abc');
    await signIn(app, 'other');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 2);
  });

  it('turns down a token that does not check out, and a request without one', async () => {
    const { app } = await makeServer();
    const bad = await app.inject({
      method: 'POST',
      url: '/auth/firebase',
      payload: { idToken: 'forged' }
    });
    assert.equal(bad.statusCode, 401);
    assert.equal(bad.json().error, 'invalid-credential');
    assert.equal(cookieOf(bad), null);

    const empty = await app.inject({ method: 'POST', url: '/auth/firebase', payload: {} });
    assert.equal(empty.statusCode, 400);
  });

  it('says who is signed in, and null for nobody', async () => {
    const { app } = await makeServer();
    assert.deepEqual((await get(app, undefined, '/me')).json(), { user: null });
    const cookie = await signIn(app);
    const me = (await get(app, cookie, '/me')).json();
    assert.equal(me.user.username, null);
    assert.equal(typeof me.user.id, 'number');
    assert.deepEqual((await get(app, 'suloop_session=made-up', '/me')).json(), { user: null });
  });

  it('stores only a hash of the session token', async () => {
    const { app, db } = await makeServer();
    const cookie = await signIn(app);
    const token = cookie.split('=')[1];
    const { token_hash: hash } = db.prepare('SELECT token_hash FROM sessions').get();
    assert.notEqual(hash, token);
    assert.equal(hash.length, 64);
  });

  it('ends the session on sign-out', async () => {
    const { app } = await makeServer();
    const cookie = await signIn(app);
    const out = await app.inject({ method: 'POST', url: '/auth/logout', headers: { cookie } });
    assert.equal(out.statusCode, 204);
    assert.deepEqual((await get(app, cookie, '/me')).json(), { user: null });
  });

  it('lets a session run out, and renews one that is in use', async () => {
    let clock = 1_000_000;
    const { app, db } = await makeServer({ now: () => clock });
    const cookie = await signIn(app);

    clock += 2 * 86_400_000;
    const renewed = await get(app, cookie, '/me');
    assert.ok(renewed.cookies.some((item) => item.name === 'suloop_session'));

    clock += 31 * 86_400_000;
    assert.deepEqual((await get(app, cookie, '/me')).json(), { user: null });
    assert.ok(db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n >= 1);
  });
});

describe('usernames', () => {
  it('needs a session', async () => {
    const { app } = await makeServer();
    const response = await app.inject({
      method: 'POST',
      url: '/me/username',
      payload: { username: 'farosa' }
    });
    assert.equal(response.statusCode, 401);
  });

  it('takes a name once and shows it on the profile', async () => {
    const { app } = await makeServer();
    const cookie = await signIn(app);
    const taken = await app.inject({
      method: 'POST',
      url: '/me/username',
      headers: { cookie },
      payload: { username: 'Farosa_1' }
    });
    assert.equal(taken.statusCode, 200);
    assert.equal((await get(app, cookie, '/me')).json().user.username, 'Farosa_1');

    const again = await app.inject({
      method: 'POST',
      url: '/me/username',
      headers: { cookie },
      payload: { username: 'another' }
    });
    assert.equal(again.statusCode, 409);
    assert.equal(again.json().error, 'username-set');
  });

  it('turns down a name that is not allowed', async () => {
    const { app } = await makeServer();
    const cookie = await signIn(app);
    for (const username of ['ab', 'x'.repeat(21), 'çay', 'with space', 'dash-ed', '', 7, null]) {
      const response = await app.inject({
        method: 'POST',
        url: '/me/username',
        headers: { cookie },
        payload: { username }
      });
      assert.equal(response.statusCode, 400, String(username));
    }
  });

  it('gives a name to one player only, whatever the letter case', async () => {
    const { app } = await makeServer();
    const first = await signIn(app, 'one');
    const second = await signIn(app, 'two');
    const claim = (cookie, username) =>
      app.inject({
        method: 'POST',
        url: '/me/username',
        headers: { cookie },
        payload: { username }
      });

    assert.equal((await claim(first, 'Farosa')).statusCode, 200);
    const clash = await claim(second, 'fAROSA');
    assert.equal(clash.statusCode, 409);
    assert.equal(clash.json().error, 'username-taken');
    // The loser can still pick another.
    assert.equal((await claim(second, 'farosa2')).statusCode, 200);
  });
});

describe('progress', () => {
  it('needs a session', async () => {
    const { app } = await makeServer();
    assert.equal((await get(app, undefined, '/progress')).statusCode, 401);
    assert.equal((await put(app, undefined, progressDoc())).statusCode, 401);
  });

  it('is empty for a new player, then keeps what is sent', async () => {
    const { app } = await makeServer();
    const cookie = await signIn(app);
    assert.deepEqual((await get(app, cookie, '/progress')).json(), { doc: null });

    const doc = progressDoc({
      records: { 1: { best: 3, attempts: attempts(1, 2, 3) } },
      dailyDone: '2026-10-12',
      daily: { '2026-10-12': { moves: 23, seconds: 95, stars: 2 } }
    });
    const saved = await put(app, cookie, doc);
    assert.equal(saved.statusCode, 200);

    const read = (await get(app, cookie, '/progress')).json();
    assert.equal(read.doc.solved, 3);
    assert.deepEqual(read.doc.records[1], { best: 3, attempts: attempts(1, 2, 3) });
    assert.deepEqual(read.doc.daily['2026-10-12'], { moves: 23, seconds: 95, stars: 2 });
    assert.equal(typeof read.updatedAt, 'number');
  });

  it('keeps only the last five solutions of a level and the last sixty days', async () => {
    const { app } = await makeServer();
    const cookie = await signIn(app);
    const daily = {};
    for (let i = 1; i <= 28; i++) {
      for (const month of ['08', '09', '10']) {
        daily[`2026-${month}-${String(i).padStart(2, '0')}`] = { moves: 5, seconds: 5, stars: 3 };
      }
    }
    await put(
      app,
      cookie,
      progressDoc({ records: { 1: { best: 2, attempts: attempts(2, 2, 2, 2, 2, 2, 2) } }, daily })
    );
    const { doc } = (await get(app, cookie, '/progress')).json();
    assert.equal(doc.records[1].attempts.length, 5);
    assert.equal(Object.keys(doc.daily).length, 60);
  });

  it('never lowers progress when a device that is behind sends its own', async () => {
    const { app } = await makeServer();
    const cookie = await signIn(app);
    await put(
      app,
      cookie,
      progressDoc({
        solved: 40,
        current: 41,
        hints: 6,
        records: { 1: { best: 3, attempts: attempts(3) } },
        daily: { '2026-10-11': { moves: 20, seconds: 50, stars: 3 } }
      })
    );

    const stale = await put(
      app,
      cookie,
      progressDoc({
        solved: 5,
        current: 6,
        hints: 0,
        records: { 1: { best: 1, attempts: attempts(1) }, 2: { best: 2, attempts: attempts(2) } },
        daily: { '2026-10-12': { moves: 22, seconds: 60, stars: 2 } }
      })
    );
    const { doc } = stale.json();
    assert.equal(doc.solved, 40);
    assert.equal(doc.current, 41);
    assert.equal(doc.hints, 6);
    assert.equal(doc.records[1].best, 3);
    // What the stale device had that the account lacked is added.
    assert.equal(doc.records[2].best, 2);
    assert.ok(doc.daily['2026-10-11'] && doc.daily['2026-10-12']);
  });

  it('takes the stock of the device that is further along, and lets it spend hints', async () => {
    const { app } = await makeServer();
    const cookie = await signIn(app);
    await put(app, cookie, progressDoc({ solved: 10, current: 11, hints: 5 }));
    // The same device spends two hints; nothing else changed.
    await put(app, cookie, progressDoc({ solved: 10, current: 11, hints: 3 }));
    assert.equal((await get(app, cookie, '/progress')).json().doc.hints, 3);
  });

  it('turns down anything that is not progress', async () => {
    const { app } = await makeServer();
    const cookie = await signIn(app);
    for (const doc of [null, 'text', 7, undefined]) {
      assert.equal((await put(app, cookie, doc)).statusCode, 400, String(doc));
    }
  });

  it('keeps each player’s progress to themselves', async () => {
    const { app } = await makeServer();
    const first = await signIn(app, 'one');
    const second = await signIn(app, 'two');
    await put(app, first, progressDoc({ solved: 50, current: 51 }));
    assert.deepEqual((await get(app, second, '/progress')).json(), { doc: null });
  });

  it('refuses a body that is far too big', async () => {
    const { app } = await makeServer();
    const cookie = await signIn(app);
    const response = await put(app, cookie, progressDoc({ junk: 'x'.repeat(600 * 1024) }));
    assert.equal(response.statusCode, 413);
  });
});

describe('deleting the account', () => {
  it('removes the user, the sessions and the progress, and frees the name', async () => {
    const { app, db } = await makeServer();
    const cookie = await signIn(app, 'one');
    await app.inject({
      method: 'POST',
      url: '/me/username',
      headers: { cookie },
      payload: { username: 'farosa' }
    });
    await put(app, cookie, progressDoc());

    const response = await app.inject({ method: 'DELETE', url: '/me', headers: { cookie } });
    assert.equal(response.statusCode, 204);
    for (const table of ['users', 'sessions', 'progress']) {
      assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n, 0, table);
    }

    const next = await signIn(app, 'two');
    const claim = await app.inject({
      method: 'POST',
      url: '/me/username',
      headers: { cookie: next },
      payload: { username: 'farosa' }
    });
    assert.equal(claim.statusCode, 200);
  });
});

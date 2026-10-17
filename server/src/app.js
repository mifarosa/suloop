import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { acceptProgress } from './progress.js';
import { SESSION_COOKIE, SESSION_DAYS, Sessions } from './sessions.js';

const USERNAME = /^[A-Za-z0-9_]{3,20}$/;
/** A progress document is a few KB; this leaves room for thousands of solved levels. */
const BODY_LIMIT = 512 * 1024;

/**
 * The server: one function that makes the web app, so tests can make one of their own.
 *
 * @param {object} options
 * @param {ReturnType<import('./config.js').loadConfig>} options.config
 * @param {import('node:sqlite').DatabaseSync} options.db
 * @param {(credential: string) => Promise<{ sub: string }>} options.verifyGoogle
 * @param {() => number} [options.now] ms
 * @param {boolean} [options.limitRates] turn the request limits off in tests
 * @param {boolean | object} [options.logger]
 */
export async function createApp({
  config,
  db,
  verifyGoogle,
  now = Date.now,
  limitRates = true,
  logger = false
}) {
  const app = Fastify({ logger, bodyLimit: BODY_LIMIT });
  const sessions = new Sessions(db, now);

  await app.register(cors, {
    origin: config.allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  });
  await app.register(cookie);
  if (limitRates) await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });

  const cookieOptions = {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    maxAge: SESSION_DAYS * 86_400
  };
  const publicUser = (user) => ({ id: user.id, username: user.username });
  const stricter = (max) =>
    limitRates ? { config: { rateLimit: { max, timeWindow: '1 minute' } } } : {};

  /** The signed-in user of a request, or null; renews the cookie of a session in use. */
  function userOf(request, reply) {
    const token = request.cookies[SESSION_COOKIE];
    const user = sessions.find(token);
    if (user?.renewed) reply.setCookie(SESSION_COOKIE, token, cookieOptions);
    return user;
  }

  /** @returns {object | null} the user, or null after answering 401 */
  function requireUser(request, reply) {
    const user = userOf(request, reply);
    if (!user) reply.code(401).send({ error: 'not-signed-in' });
    return user;
  }

  app.get('/healthz', async () => ({ ok: true }));

  app.post('/auth/google', stricter(20), async (request, reply) => {
    const credential = request.body?.credential;
    if (typeof credential !== 'string' || credential === '') {
      return reply.code(400).send({ error: 'invalid-credential' });
    }
    let google;
    try {
      google = await verifyGoogle(credential);
    } catch {
      return reply.code(401).send({ error: 'invalid-credential' });
    }

    db.prepare('INSERT OR IGNORE INTO users (google_sub, created_at) VALUES (?, ?)').run(
      google.sub,
      now()
    );
    const user = db.prepare('SELECT id, username FROM users WHERE google_sub = ?').get(google.sub);
    reply.setCookie(SESSION_COOKIE, sessions.create(user.id), cookieOptions);
    return { user: publicUser(user) };
  });

  app.post('/auth/logout', async (request, reply) => {
    sessions.end(request.cookies[SESSION_COOKIE]);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.code(204).send();
  });

  // Signed out is an ordinary answer here, so a page can ask who is signed in without an error.
  app.get('/me', async (request, reply) => {
    const user = userOf(request, reply);
    return { user: user ? publicUser(user) : null };
  });

  app.delete('/me', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.code(204).send();
  });

  app.post('/me/username', stricter(20), async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const username = request.body?.username;
    if (typeof username !== 'string' || !USERNAME.test(username)) {
      return reply.code(400).send({ error: 'invalid-username' });
    }
    // A name is chosen once.
    if (user.username) return reply.code(409).send({ error: 'username-set' });

    try {
      db.prepare('UPDATE users SET username = ? WHERE id = ? AND username IS NULL').run(
        username,
        user.id
      );
    } catch (error) {
      if (/UNIQUE/i.test(String(error?.message))) {
        return reply.code(409).send({ error: 'username-taken' });
      }
      throw error;
    }
    return { user: { id: user.id, username } };
  });

  app.get('/progress', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const row = db.prepare('SELECT data, updated_at FROM progress WHERE user_id = ?').get(user.id);
    return row ? { doc: JSON.parse(row.data), updatedAt: row.updated_at } : { doc: null };
  });

  app.put('/progress', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;

    const row = db.prepare('SELECT data, updated_at FROM progress WHERE user_id = ?').get(user.id);
    const doc = acceptProgress(row ? JSON.parse(row.data) : null, request.body?.doc);
    if (!doc) return reply.code(400).send({ error: 'invalid-progress' });

    // Strictly increasing, so a client can tell which of two documents is newer.
    const updatedAt = Math.max(now(), (row?.updated_at ?? 0) + 1);
    db.prepare(
      `INSERT INTO progress (user_id, data, updated_at) VALUES (?, ?, ?)
       ON CONFLICT (user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
    ).run(user.id, JSON.stringify(doc), updatedAt);
    return { doc, updatedAt };
  });

  return app;
}

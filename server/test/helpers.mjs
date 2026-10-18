import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { openDatabase } from '../src/db.js';

export const ORIGIN = 'http://localhost:5173';

/** A server on an in-memory database; "valid:<id>" is a sign-in token for the player <id>. */
export async function makeServer({ now = Date.now } = {}) {
  const db = openDatabase(':memory:');
  const config = loadConfig({ FIREBASE_PROJECT_ID: 'project', ALLOWED_ORIGIN: ORIGIN });
  const app = await createApp({
    config,
    db,
    now,
    limitRates: false,
    verifyIdentity: async (token) => {
      if (!token.startsWith('valid:')) throw new Error('Bad token');
      return { sub: token.slice('valid:'.length) };
    }
  });
  return { app, db, config };
}

/** The cookie a response sets, as a header value to send back. */
export function cookieOf(response) {
  const cookie = response.cookies.find((item) => item.name === 'suloop_session');
  return cookie ? `suloop_session=${cookie.value}` : null;
}

/** Signs a player in and returns the cookie of their session. */
export async function signIn(app, id = 'google-1') {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/firebase',
    payload: { idToken: `valid:${id}` }
  });
  return cookieOf(response);
}

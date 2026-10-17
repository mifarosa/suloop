import { createHash, randomBytes } from 'node:crypto';

export const SESSION_COOKIE = 'suloop_session';
export const SESSION_DAYS = 30;
const DAY_MS = 86_400_000;

const hashOf = (token) => createHash('sha256').update(token).digest('hex');

/** Sessions of signed-in players; the token lives in a cookie, its hash in the database. */
export class Sessions {
  #db;
  #now;

  /** @param {import('node:sqlite').DatabaseSync} db @param {() => number} [now] ms */
  constructor(db, now = Date.now) {
    this.#db = db;
    this.#now = now;
  }

  /** Starts a session for a user and returns its token. */
  create(userId) {
    const token = randomBytes(32).toString('base64url');
    this.#db
      .prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
      .run(hashOf(token), userId, this.#now() + SESSION_DAYS * DAY_MS);
    return token;
  }

  /**
   * The user a token belongs to, or null. A session in use keeps running: it is extended when
   * it is a day old.
   * @returns {{ id: number, username: string | null, renewed: boolean } | null}
   */
  find(token) {
    if (typeof token !== 'string' || token === '') return null;
    const hash = hashOf(token);
    const row = this.#db
      .prepare(
        `SELECT users.id AS id, users.username AS username, sessions.expires_at AS expires
         FROM sessions JOIN users ON users.id = sessions.user_id
         WHERE sessions.token_hash = ?`
      )
      .get(hash);
    const now = this.#now();
    if (!row || row.expires <= now) return null;

    const renewed = row.expires < now + (SESSION_DAYS - 1) * DAY_MS;
    if (renewed) {
      this.#db
        .prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?')
        .run(now + SESSION_DAYS * DAY_MS, hash);
    }
    return { id: row.id, username: row.username, renewed };
  }

  end(token) {
    if (typeof token === 'string') {
      this.#db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashOf(token));
    }
  }

  /** Forgets the sessions that ran out. */
  purgeExpired() {
    this.#db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(this.#now());
  }
}

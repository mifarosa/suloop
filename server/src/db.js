import { DatabaseSync } from 'node:sqlite';

/**
 * The database, one SQLite file. Each entry is a step that moves the schema one version on;
 * the version sits in the file (PRAGMA user_version), so a step runs once. Add a step for a
 * change, never edit one that has shipped.
 */
const MIGRATIONS = [
  `
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    google_sub TEXT NOT NULL UNIQUE,
    -- Chosen after the first sign-in; names differ by more than letter case.
    username TEXT UNIQUE COLLATE NOCASE,
    created_at INTEGER NOT NULL
  );

  -- Only a hash of each session's token is kept, so a copy of the file signs nobody in.
  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX sessions_by_user ON sessions (user_id);

  CREATE TABLE progress (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  `
];

/**
 * @param {string} file path of the database file, or ":memory:"
 * @returns {DatabaseSync}
 */
export function openDatabase(file) {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  migrate(db);
  return db;
}

function migrate(db) {
  const { user_version: current } = db.prepare('PRAGMA user_version').get();
  for (let version = current; version < MIGRATIONS.length; version++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[version]);
      db.exec(`PRAGMA user_version = ${version + 1}`);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}

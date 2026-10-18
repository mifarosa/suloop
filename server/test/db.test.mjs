import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { openDatabase } from '../src/db.js';

describe('the database', () => {
  it('builds its tables and remembers its version, so a second open changes nothing', () => {
    const folder = mkdtempSync(join(tmpdir(), 'suloop-'));
    try {
      const file = join(folder, 'suloop.db');
      const first = openDatabase(file);
      first.prepare('INSERT INTO users (auth_sub, created_at) VALUES (?, ?)').run('g', 1);
      const { user_version: version } = first.prepare('PRAGMA user_version').get();
      first.close();
      assert.ok(version >= 1);

      const second = openDatabase(file);
      assert.equal(second.prepare('SELECT COUNT(*) AS n FROM users').get().n, 1);
      assert.equal(second.prepare('PRAGMA user_version').get().user_version, version);
      second.close();
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });

  it('keeps the players of a database made before the identity column was renamed', () => {
    const folder = mkdtempSync(join(tmpdir(), 'suloop-'));
    try {
      const file = join(folder, 'old.db');
      const old = new DatabaseSync(file);
      old.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY, google_sub TEXT NOT NULL UNIQUE,
        username TEXT UNIQUE COLLATE NOCASE, created_at INTEGER NOT NULL);
        CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL
        REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
        CREATE INDEX sessions_by_user ON sessions (user_id);
        CREATE TABLE progress (user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        data TEXT NOT NULL, updated_at INTEGER NOT NULL);
        INSERT INTO users (google_sub, username, created_at) VALUES ('old-id', 'farosa', 1);
        PRAGMA user_version = 1;`);
      old.close();

      const db = openDatabase(file);
      const row = db.prepare('SELECT auth_sub, username FROM users').get();
      assert.equal(row.auth_sub, 'old-id');
      assert.equal(row.username, 'farosa');
      db.close();
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });

  it('removes a user’s sessions and progress along with the user', () => {
    const db = openDatabase(':memory:');
    db.prepare('INSERT INTO users (id, auth_sub, created_at) VALUES (1, ?, 1)').run('g');
    db.prepare('INSERT INTO sessions VALUES (?, 1, 99)').run('h');
    db.prepare('INSERT INTO progress VALUES (1, ?, 1)').run('{}');
    db.prepare('DELETE FROM users WHERE id = 1').run();
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM progress').get().n, 0);
  });
});

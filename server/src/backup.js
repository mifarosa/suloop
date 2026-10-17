import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const KEEP = 14;
const dataDir = process.env.DATA_DIR ?? './data';
const folder = join(dataDir, 'backups');
mkdirSync(folder, { recursive: true });

// A consistent copy, safe while the server runs.
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const file = join(folder, `suloop-${stamp}.db`);
const db = new DatabaseSync(join(dataDir, 'suloop.db'));
db.exec(`VACUUM INTO '${file.replaceAll("'", "''")}'`);
db.close();
console.log(`Backed up to ${file}`);

// Only the newest copies stay.
const copies = readdirSync(folder)
  .filter((name) => /^suloop-.*\.db$/.test(name))
  .sort();
for (const name of copies.slice(0, Math.max(0, copies.length - KEEP))) {
  rmSync(join(folder, name));
}

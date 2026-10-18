import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createApp } from './app.js';
import { loadConfig, problemsWith } from './config.js';
import { openDatabase } from './db.js';
import { createFirebaseVerifier } from './firebaseAuth.js';
import { Sessions } from './sessions.js';

const config = loadConfig();
const problems = problemsWith(config);
if (problems.length > 0) {
  console.error(`suloop-server cannot start: ${problems.join('; ')}. See .env.example.`);
  process.exit(1);
}

mkdirSync(config.dataDir, { recursive: true });
const db = openDatabase(join(config.dataDir, 'suloop.db'));
const app = await createApp({
  config,
  db,
  verifyIdentity: createFirebaseVerifier({ projectId: config.firebaseProjectId }),
  logger: { level: process.env.LOG_LEVEL ?? 'info' }
});

// Sessions that ran out are dropped now and then.
const sessions = new Sessions(db);
sessions.purgeExpired();
const purgeTimer = setInterval(() => sessions.purgeExpired(), 6 * 60 * 60 * 1000);
purgeTimer.unref();

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    await app.close();
    db.close();
    process.exit(0);
  });
}

await app.listen({ port: config.port, host: config.host });

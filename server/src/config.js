/**
 * The server's settings, from environment variables (see .env.example).
 * @param {Record<string, string | undefined>} [env]
 */
export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT ?? 3000),
    host: env.HOST ?? '0.0.0.0',
    dataDir: env.DATA_DIR ?? './data',
    // The Firebase project players sign in through. It only names the project, no secret.
    firebaseProjectId: env.FIREBASE_PROJECT_ID ?? 'suloop-8ee05',
    // The pages that may call the server, e.g. "https://mifarosa.com,http://localhost:5173".
    allowedOrigins: (env.ALLOWED_ORIGIN ?? 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    // Browsers send a Secure cookie only over HTTPS (localhost counts as secure in most).
    cookieSecure: ['1', 'true'].includes(String(env.COOKIE_SECURE ?? '').toLowerCase())
  };
}

/** What is wrong with the settings, in words; empty when the server can start. */
export function problemsWith(config) {
  const problems = [];
  if (!config.firebaseProjectId) problems.push('FIREBASE_PROJECT_ID is empty');
  if (!Number.isInteger(config.port) || config.port <= 0) problems.push('PORT is not a number');
  return problems;
}

import { createRemoteJWKSet, jwtVerify } from 'jose';

const FIREBASE_KEYS = new URL(
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
);

/**
 * Checks the ID token Firebase Authentication hands the page after a Google sign-in: signed
 * by Firebase, made for this game's Firebase project, not expired. No secret is needed; the
 * keys that sign these tokens are public.
 *
 * @param {{ projectId: string, keys?: Parameters<typeof jwtVerify>[1] }} options keys: where to
 *   get Firebase's public keys; the real ones unless a test brings its own
 * @returns {(idToken: string) => Promise<{ sub: string }>} resolves with the player's Firebase
 *   user id; rejects for a token that does not check out
 */
export function createFirebaseVerifier({ projectId, keys = createRemoteJWKSet(FIREBASE_KEYS) }) {
  return async (idToken) => {
    const { payload } = await jwtVerify(idToken, keys, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId
    });
    if (typeof payload.sub !== 'string' || payload.sub === '') throw new Error('No subject');
    return { sub: payload.sub };
  };
}

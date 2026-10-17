import { createRemoteJWKSet, jwtVerify } from 'jose';

const GOOGLE_KEYS = new URL('https://www.googleapis.com/oauth2/v3/certs');
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

/**
 * Checks the ID token Google's sign-in button hands the page: signed by Google, made for this
 * game, not expired.
 *
 * @param {{ clientId: string, keys?: Parameters<typeof jwtVerify>[1] }} options keys: where to
 *   get Google's public keys; the real ones unless a test brings its own
 * @returns {(credential: string) => Promise<{ sub: string }>} resolves with Google's id of the
 *   player; rejects for a token that does not check out
 */
export function createGoogleVerifier({ clientId, keys = createRemoteJWKSet(GOOGLE_KEYS) }) {
  return async (credential) => {
    const { payload } = await jwtVerify(credential, keys, {
      issuer: GOOGLE_ISSUERS,
      audience: clientId
    });
    if (typeof payload.sub !== 'string' || payload.sub === '') throw new Error('No subject');
    if (payload.email_verified === false) throw new Error('Email not verified');
    return { sub: payload.sub };
  };
}

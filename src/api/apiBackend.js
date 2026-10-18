import { finishRedirect, redirectPending, signInWithGoogle } from './firebaseSignIn.js';

/**
 * What the account and the sync need from the game's server (see cloud/account.js for the
 * shape). Every call goes through `client`, which carries the session cookie. Players sign in
 * with Google through Firebase, which gives an ID token that the server checks and turns into
 * a session of its own.
 *
 * @param {object} options
 * @param {ReturnType<import('./client.js').createApiClient>} options.client
 * @param {{ signIn: () => Promise<string>, pending: () => boolean, finish: () => Promise<string | null> }} [options.google]
 *   how an ID token is got; Firebase's sign-in unless a test brings its own
 * @returns {import('../cloud/account.js').Backend & {
 *   updateProgress: (uid: string, update: (doc: object | null) => object) => Promise<void> }}
 */
export function createApiBackend({
  client,
  google = { signIn: signInWithGoogle, pending: redirectPending, finish: finishRedirect }
}) {
  let listener = () => {};

  const asUser = (user) => (user ? { uid: String(user.id), name: null } : null);
  const fail = (code) => Object.assign(new Error(code), { code });

  /** Gives the server the ID token; it answers with the player and a session cookie. */
  async function exchange(idToken) {
    const { ok, data } = await client.request('POST', '/auth/firebase', { idToken });
    if (!ok) throw fail(data?.error ?? 'sign-in-failed');
    listener(asUser(data.user));
  }

  return {
    /** Whether a sign-in that left the page for Google's is waiting to be picked up. */
    hasPendingSignIn: () => google.pending(),

    async watchAuth(next) {
      listener = next;
      if (google.pending()) {
        try {
          const idToken = await google.finish();
          if (idToken) await exchange(idToken);
        } catch {
          // Without it the player is simply not signed in; they can try again.
        }
      }
      const { ok, data } = await client.request('GET', '/me');
      next(ok ? asUser(data?.user) : null);
      return () => {
        listener = () => {};
      };
    },

    async signIn() {
      await exchange(await google.signIn());
    },

    async signOut() {
      await client.request('POST', '/auth/logout');
      listener(null);
    },

    async readProfile() {
      const { ok, data } = await client.request('GET', '/me');
      if (!ok) throw fail('profile-failed');
      return data?.user?.username ? { username: data.user.username } : null;
    },

    async claimUsername(uid, username) {
      const { ok, status, data } = await client.request('POST', '/me/username', { username });
      if (ok) return;
      throw fail(status === 409 && data?.error === 'username-taken' ? 'username-taken' : 'failed');
    },

    /** Reads the progress the server holds, lets `update` make the new one, and sends it. */
    async updateProgress(uid, update) {
      const read = await client.request('GET', '/progress');
      if (!read.ok) throw fail('progress-read-failed');
      const write = await client.request('PUT', '/progress', {
        doc: update(read.data?.doc ?? null)
      });
      if (!write.ok) throw fail('progress-write-failed');
    },

    async deleteAccount() {
      const { ok } = await client.request('DELETE', '/me');
      if (!ok) throw fail('delete-failed');
      listener(null);
    }
  };
}

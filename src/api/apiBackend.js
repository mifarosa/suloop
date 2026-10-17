import { renderGoogleButton } from './googleSignIn.js';

/**
 * What the account and the sync need from the game's server (see cloud/account.js for the
 * shape). Every call goes through `client`, which carries the session cookie.
 *
 * @param {object} options
 * @param {ReturnType<import('./client.js').createApiClient>} options.client
 * @param {string} options.googleClientId
 * @param {string} [options.locale]
 * @param {typeof renderGoogleButton} [options.drawButton]
 * @returns {import('../cloud/account.js').Backend & {
 *   updateProgress: (uid: string, update: (doc: object | null) => object) => Promise<void> }}
 */
export function createApiBackend({
  client,
  googleClientId,
  locale = 'tr',
  drawButton = renderGoogleButton
}) {
  let listener = () => {};

  const asUser = (user) => (user ? { uid: String(user.id), name: null } : null);
  const fail = (code) => Object.assign(new Error(code), { code });

  return {
    async watchAuth(next) {
      listener = next;
      const { ok, data } = await client.request('GET', '/me');
      next(ok ? asUser(data?.user) : null);
      return () => {
        listener = () => {};
      };
    },

    async renderSignIn(element, { onStart, onError }) {
      await drawButton(element, {
        clientId: googleClientId,
        locale,
        onCredential: async (credential) => {
          onStart();
          try {
            const { ok, data } = await client.request('POST', '/auth/google', { credential });
            if (!ok) throw fail(data?.error ?? 'sign-in-failed');
            listener(asUser(data.user));
          } catch (error) {
            onError(error?.code ?? 'sign-in-failed');
          }
        }
      });
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

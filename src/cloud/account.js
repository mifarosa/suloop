/**
 * The player's account: who is signed in, and the public name they go by. It knows nothing of
 * the network; a backend does the talking (see api/apiBackend.js), so this logic is easy to test.
 *
 * @typedef {object} Backend
 * @property {(listener: (user: User | null) => void) => Promise<() => void>} watchAuth reports
 *   the signed-in user now and whenever it changes; returns a function that stops listening
 * @property {() => Promise<void>} signIn opens Google's sign-in and, once the player picks an
 *   account, reports the new user through `watchAuth`'s listener; rejects with `{ code }`
 * @property {() => boolean} [hasPendingSignIn] true when the page left for Google's sign-in and
 *   has to pick the answer up
 * @property {() => Promise<void>} signOut
 * @property {(uid: string) => Promise<{ username: string } | null>} readProfile
 * @property {(uid: string, username: string) => Promise<void>} claimUsername rejects with
 *   `{ code: 'username-taken' }` when someone has the name
 * @property {(uid: string) => Promise<void>} deleteAccount removes the account and its data
 *
 * @typedef {{ uid: string, name: string | null }} User
 *
 * @typedef {object} AccountState
 * @property {'signedOut' | 'signingIn' | 'loading' | 'needsName' | 'ready'} status
 * @property {User | null} user
 * @property {string | null} username
 * @property {string | null} error a code of what just went wrong, for a message
 */

const STORAGE_KEY = 'suloop:account:v1';
export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;

/**
 * A username fit to take, or null: 3 to 20 letters, digits and underscores, with no accents,
 * since it is also looked up in lower case.
 */
export function cleanUsername(name) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  return USERNAME_PATTERN.test(trimmed) ? trimmed : null;
}

export class Account {
  #backend;
  #storage;
  #state = { status: 'signedOut', user: null, username: null, error: null };
  #listeners = new Set();
  #watching = null;

  /**
   * @param {Backend} backend
   * @param {Storage | null} [storage] remembers that the player signed in, so a later visit
   *   knows to restore the session
   */
  constructor(backend, storage = browserStorage()) {
    this.#backend = backend;
    this.#storage = storage;
  }

  /** @returns {AccountState} */
  get state() {
    return this.#state;
  }

  /** @param {(state: AccountState) => void} listener */
  onChange(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Picks up the session of an earlier visit; nothing is loaded for a player who never signed in. */
  async restore() {
    const pending = this.#backend.hasPendingSignIn?.() === true;
    if (this.#storage?.getItem(STORAGE_KEY) !== '1' && !pending) return;
    await this.#watch();
  }

  /** Signs in with Google. The result arrives as the state of the account. */
  async signIn() {
    this.#set({ status: 'signingIn', error: null });
    try {
      await this.#watch();
      await this.#backend.signIn();
    } catch (error) {
      const closed = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request'];
      this.#set({
        status: this.#state.user ? this.#state.status : 'signedOut',
        error: closed.includes(error?.code) ? null : (error?.code ?? 'unknown')
      });
    }
  }

  async signOut() {
    await this.#backend.signOut();
  }

  /**
   * Takes a public name for the player.
   * @returns {Promise<'ok' | 'invalid' | 'taken' | 'failed'>}
   */
  async claimUsername(name) {
    const username = cleanUsername(name);
    const { user } = this.#state;
    if (!username) return 'invalid';
    if (!user) return 'failed';
    try {
      await this.#backend.claimUsername(user.uid, username);
    } catch (error) {
      return error?.code === 'username-taken' ? 'taken' : 'failed';
    }
    this.#set({ status: 'ready', username, error: null });
    return 'ok';
  }

  /** Deletes the account and everything kept for it. @returns {Promise<boolean>} */
  async deleteAccount() {
    const { user } = this.#state;
    if (!user) return false;
    try {
      await this.#backend.deleteAccount(user.uid);
    } catch (error) {
      this.#set({ error: error?.code ?? 'unknown' });
      return false;
    }
    return true;
  }

  #watch() {
    this.#watching ??= this.#backend
      .watchAuth((user) => this.#handleUser(user))
      .then(() => {})
      .catch((error) => {
        this.#watching = null;
        throw error;
      });
    return this.#watching;
  }

  async #handleUser(user) {
    if (!user) {
      this.#remember(false);
      this.#set({ status: 'signedOut', user: null, username: null, error: null });
      return;
    }
    this.#remember(true);
    this.#set({ status: 'loading', user, username: null, error: null });
    try {
      const profile = await this.#backend.readProfile(user.uid);
      // Someone else may have signed in meanwhile.
      if (this.#state.user?.uid !== user.uid) return;
      this.#set(
        profile
          ? { status: 'ready', username: profile.username }
          : { status: 'needsName', username: null }
      );
    } catch (error) {
      if (this.#state.user?.uid === user.uid) {
        // The name could not be looked up (e.g. no network); do not ask for one meanwhile.
        this.#set({ status: 'ready', username: null, error: error?.code ?? 'profile-failed' });
      }
    }
  }

  #remember(signedIn) {
    try {
      if (signedIn) this.#storage?.setItem(STORAGE_KEY, '1');
      else this.#storage?.removeItem(STORAGE_KEY);
    } catch {
      // Storage can be blocked; the session is then picked up on the next sign-in only.
    }
  }

  #set(changes) {
    this.#state = { ...this.#state, ...changes };
    for (const listener of this.#listeners) listener(this.#state);
  }
}

function browserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

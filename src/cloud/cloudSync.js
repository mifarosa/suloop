import { docToState, mergeProgress, stateToDoc } from '../app/cloudProgress.js';

const UPLOAD_DELAY_MS = 3000;

/**
 * Keeps this device's progress and the account's together. When the player signs in (or an
 * earlier session is restored) it merges what the account holds into this device and writes
 * the result back; afterwards it only sends changes made here, a few seconds after the last
 * one. Changes made on another device are picked up the next time the game opens, so the
 * board never changes under the player's fingers.
 *
 * @typedef {'idle' | 'syncing' | 'synced' | 'failed'} SyncStatus
 */
export class CloudSync {
  #backend;
  #getLocal;
  #apply;
  #delayMs;
  #timer = null;
  #uid = null;
  #started = false;
  #running = null;
  #again = false;
  /** @type {SyncStatus} */
  #status = 'idle';
  #listeners = new Set();

  /**
   * @param {object} options
   * @param {import('./account.js').Account} options.account
   * @param {{ updateProgress: (uid: string, update: (doc: object | null) => object) => Promise<void> }} options.backend
   *   `updateProgress` reads the account's document, lets `update` make the new one and
   *   writes it, as one step
   * @param {() => import('../app/cloudProgress.js').State} options.getLocal
   * @param {(merged: import('../app/cloudProgress.js').State) => void} options.apply takes in
   *   what the account had and this device lacked
   * @param {number} [options.delayMs]
   */
  constructor({ account, backend, getLocal, apply, delayMs = UPLOAD_DELAY_MS }) {
    this.#backend = backend;
    this.#getLocal = getLocal;
    this.#apply = apply;
    this.#delayMs = delayMs;
    account.onChange((state) => this.#handleAccount(state));
  }

  /** @returns {SyncStatus} */
  get status() {
    return this.#status;
  }

  /** @param {(status: SyncStatus) => void} listener */
  onStatus(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Notes that progress changed here; it goes to the account shortly. */
  schedule() {
    if (this.#uid === null) return;
    clearTimeout(this.#timer);
    // Until the first sync has worked, the next one is the first.
    this.#timer = setTimeout(() => this.#sync(!this.#started), this.#delayMs);
  }

  /** Syncs at once, e.g. when the player asks to retry. */
  syncNow() {
    if (this.#uid === null) return Promise.resolve();
    clearTimeout(this.#timer);
    return this.#sync(!this.#started);
  }

  #handleAccount({ user }) {
    const uid = user?.uid ?? null;
    if (uid === this.#uid) return;
    this.#uid = uid;
    this.#started = false;
    clearTimeout(this.#timer);
    if (uid === null) {
      this.#setStatus('idle');
      return;
    }
    this.#sync(true);
  }

  /** @param {boolean} first whether this is the first sync after signing in */
  async #sync(first) {
    if (this.#uid === null) return;
    // One at a time; a change that comes meanwhile is sent right after.
    if (this.#running) {
      this.#again = true;
      return this.#running;
    }
    this.#running = this.#run(first).finally(() => {
      this.#running = null;
      if (this.#again) {
        this.#again = false;
        this.schedule();
      }
    });
    return this.#running;
  }

  async #run(first) {
    const uid = this.#uid;
    this.#setStatus('syncing');
    try {
      const local = this.#getLocal();
      let merged = null;
      await this.#backend.updateProgress(uid, (doc) => {
        merged = mergeProgress(local, docToState(doc));
        return stateToDoc(merged);
      });
      if (this.#uid !== uid) return;
      this.#started = true;
      if (first && merged?.changed) this.#apply({ progress: merged.progress, daily: merged.daily });
      this.#setStatus('synced');
    } catch {
      if (this.#uid === uid) this.#setStatus('failed');
    }
  }

  #setStatus(status) {
    this.#status = status;
    for (const listener of this.#listeners) listener(status);
  }
}

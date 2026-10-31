/**
 * What the game tells the screen: the title bar, a short message and the win dialog. It keeps
 * the latest of each and tells the React side, which draws them. It has the methods of the
 * website's Hud (src/app/hud.js) that the game controller calls.
 */
export class NativeHud {
  #listeners = new Set();
  #toastTimer = null;
  state = { view: null, toast: null, win: null };

  /** @param {(state: NativeHud['state']) => void} listener @returns {() => void} */
  subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  render(view) {
    this.#set({ view });
  }

  showToast(message, { long = false } = {}) {
    clearTimeout(this.#toastTimer);
    this.#set({ toast: message });
    this.#toastTimer = setTimeout(() => this.#set({ toast: null }), long ? 6000 : 2600);
  }

  showWin(win) {
    this.#set({ win });
  }

  hideWin() {
    this.#set({ win: null });
  }

  #set(change) {
    this.state = { ...this.state, ...change };
    for (const listener of this.#listeners) listener(this.state);
  }
}

/**
 * What the game tells the screen: the title bar, a short message, the win dialog, the level
 * list and the rules. It keeps the latest of each and tells the React side, which draws them.
 * It has the methods of the website's Hud, LevelMenu and RulesDialog that the game controller
 * calls, so the controller needs no change.
 */
export class NativeHud {
  #listeners = new Set();
  #toastTimer = null;
  state = { view: null, toast: null, win: null, menu: null, rules: null };

  /** The level list, as the controller gives it. */
  menu = {
    show: (menu) => this.#set({ menu }),
    hide: () => this.#set({ menu: null })
  };

  /** The rules of a level, or everything about it from the info button. */
  rules = {
    show: (rules) => this.#set({ rules }),
    hide: () => this.#set({ rules: null }),
    isShowingInfo: false
  };

  constructor() {
    Object.defineProperty(this.rules, 'isShowingInfo', {
      get: () => Boolean(this.state.rules?.info)
    });
  }

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

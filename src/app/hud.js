const TOAST_DURATION_MS = 2400;
const LONG_TOAST_DURATION_MS = 5000;

/**
 * The page around the game board: title, move counter, buttons, toast message and win dialog.
 * It only displays what it is given and forwards button clicks.
 */
export class Hud {
  #elements;
  #toastTimer;

  /** @param {ParentNode} root */
  constructor(root) {
    const find = (selector) => root.querySelector(selector);
    this.#elements = {
      title: find('#title'),
      subtitle: find('#subtitle'),
      undo: find('#undo'),
      hint: find('#hint'),
      restart: find('#restart'),
      levels: find('#levels-open'),
      toast: find('#toast'),
      win: find('#win'),
      winText: find('#win-text'),
      next: find('#next'),
      winLevels: find('#win-levels')
    };
  }

  /**
   * @param {object} actions
   * @param {() => void} actions.onUndo
   * @param {() => void} actions.onHint
   * @param {() => void} actions.onRestart
   * @param {() => void} actions.onShowLevels
   * @param {() => void} actions.onContinue
   * @param {() => void} actions.onContinueToLevels
   */
  bindActions({ onUndo, onHint, onRestart, onShowLevels, onContinue, onContinueToLevels }) {
    const { undo, hint, restart, levels, next, winLevels } = this.#elements;
    undo.addEventListener('click', onUndo);
    hint.addEventListener('click', onHint);
    restart.addEventListener('click', onRestart);
    levels.addEventListener('click', onShowLevels);
    next.addEventListener('click', onContinue);
    winLevels.addEventListener('click', onContinueToLevels);
  }

  /**
   * @param {{ title: string, subtitle: string, canUndo: boolean }} state
   */
  render({ title, subtitle, canUndo }) {
    this.#elements.title.textContent = title;
    this.#elements.subtitle.textContent = subtitle;
    this.#elements.undo.disabled = !canUndo;
  }

  /**
   * Shows a short message for a few seconds.
   * @param {string} message
   * @param {{ long?: boolean }} [options] long: leaves time to read an explanation
   */
  showToast(message, { long = false } = {}) {
    const { toast } = this.#elements;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(this.#toastTimer);
    this.#toastTimer = setTimeout(
      () => toast.classList.remove('show'),
      long ? LONG_TOAST_DURATION_MS : TOAST_DURATION_MS
    );
  }

  /** @param {{ message: string, continueLabel: string }} win */
  showWin({ message, continueLabel }) {
    const { win, winText, next } = this.#elements;
    winText.textContent = message;
    next.textContent = continueLabel;
    win.hidden = false;
    next.focus();
  }

  hideWin() {
    this.#elements.win.hidden = true;
  }
}

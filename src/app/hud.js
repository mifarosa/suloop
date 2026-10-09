const TOAST_DURATION_MS = 2400;

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
      moves: find('#moves'),
      undo: find('#undo'),
      hint: find('#hint'),
      restart: find('#restart'),
      mode: find('#mode'),
      toast: find('#toast'),
      win: find('#win'),
      winText: find('#win-text'),
      next: find('#next')
    };
  }

  /**
   * @param {object} actions
   * @param {() => void} actions.onUndo
   * @param {() => void} actions.onHint
   * @param {() => void} actions.onRestart
   * @param {() => void} actions.onToggleMode
   * @param {() => void} actions.onContinue
   */
  bindActions({ onUndo, onHint, onRestart, onToggleMode, onContinue }) {
    const { undo, hint, restart, mode, next } = this.#elements;
    undo.addEventListener('click', onUndo);
    hint.addEventListener('click', onHint);
    restart.addEventListener('click', onRestart);
    mode.addEventListener('click', onToggleMode);
    next.addEventListener('click', onContinue);
  }

  /**
   * @param {{ title: string, moves: string, canUndo: boolean, modeLabel: string }} state
   */
  render({ title, moves, canUndo, modeLabel }) {
    this.#elements.title.textContent = title;
    this.#elements.moves.textContent = moves;
    this.#elements.undo.disabled = !canUndo;
    this.#elements.mode.textContent = modeLabel;
  }

  /** Shows a short message for a few seconds. */
  showToast(message) {
    const { toast } = this.#elements;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(this.#toastTimer);
    this.#toastTimer = setTimeout(() => toast.classList.remove('show'), TOAST_DURATION_MS);
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

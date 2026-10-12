/**
 * A full-screen layer that dims the board and holds a dialog. It closes on a tap on the dimmed
 * area or on Escape, and gives focus back to whatever had it before it opened.
 */
export class Overlay {
  #element;
  #returnFocusTo = null;

  /**
   * @param {HTMLElement} element the overlay, hidden while closed
   * @param {() => void} onDismiss called when the player taps outside the dialog or presses Escape
   */
  constructor(element, onDismiss) {
    this.#element = element;
    element.addEventListener('click', (event) => {
      if (event.target === element) onDismiss();
    });
    element.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') onDismiss();
    });
  }

  /** @param {HTMLElement} focusTarget the element to focus inside the dialog */
  open(focusTarget) {
    if (this.#element.hidden) this.#returnFocusTo = document.activeElement;
    this.#element.hidden = false;
    focusTarget.focus({ preventScroll: true });
  }

  close() {
    if (this.#element.hidden) return;

    this.#element.hidden = true;
    this.#returnFocusTo?.focus?.();
    this.#returnFocusTo = null;
  }
}

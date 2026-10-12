import { Overlay } from './overlay.js';
import { progressLink } from './progressCode.js';
import { texts } from './texts.js';

const COPIED_FEEDBACK_MS = 2000;

/**
 * The dialog that carries progress to another device: it shows this device's code and a link
 * to share, and takes a code from another device.
 */
export class TransferDialog {
  #overlay;
  #elements;
  #link = '';
  #copyLabel;
  #copiedTimer;
  #actions = { onImport: () => {}, onClose: () => {} };

  /** @param {ParentNode} root */
  constructor(root) {
    const find = (selector) => root.querySelector(selector);
    this.#overlay = new Overlay(find('#transfer'), () => this.#actions.onClose());
    this.#elements = {
      code: find('#transfer-code'),
      copy: find('#transfer-copy'),
      share: find('#transfer-share'),
      form: find('#transfer-form'),
      input: find('#transfer-input'),
      message: find('#transfer-message')
    };
    const { copy, share, form, input } = this.#elements;
    this.#copyLabel = copy.textContent;

    find('#transfer-close').addEventListener('click', () => this.#actions.onClose());
    copy.addEventListener('click', () => this.#copyLink());
    // Phones offer their share sheet, the easiest way to send the link to yourself.
    share.hidden = typeof navigator.share !== 'function';
    share.addEventListener('click', () => {
      navigator.share({ url: this.#link }).catch(() => {
        // The player closed the share sheet; nothing to do.
      });
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.#actions.onImport(input.value);
    });
  }

  /**
   * @param {object} actions
   * @param {(code: string) => void} actions.onImport
   * @param {() => void} actions.onClose
   */
  bindActions(actions) {
    this.#actions = actions;
  }

  /** @param {{ code: string }} transfer this device's progress code */
  show({ code }) {
    const { code: codeElement, copy, input } = this.#elements;
    this.#link = progressLink(location.href, code);
    codeElement.textContent = code;
    copy.textContent = this.#copyLabel;
    input.value = '';
    this.#showMessage('');
    this.#overlay.open(copy);
  }

  hide() {
    this.#overlay.close();
  }

  /** Shows why a typed code was not taken. */
  showError(message) {
    this.#showMessage(message);
    this.#elements.input.focus();
  }

  async #copyLink() {
    const { copy } = this.#elements;
    try {
      await navigator.clipboard.writeText(this.#link);
    } catch {
      // Clipboard access can be blocked; the code on screen can still be noted down.
      this.#showMessage(texts.copyFailed);
      return;
    }
    copy.textContent = texts.linkCopied;
    clearTimeout(this.#copiedTimer);
    this.#copiedTimer = setTimeout(() => (copy.textContent = this.#copyLabel), COPIED_FEEDBACK_MS);
  }

  #showMessage(message) {
    const { message: element } = this.#elements;
    element.textContent = message;
    element.hidden = !message;
  }
}

import { Overlay } from './overlay.js';

/**
 * The settings dialog: the theme, sounds and vibration, and installing the game as an app
 * where the browser offers it. Changes apply at once; it only reports them.
 */
export class SettingsDialog {
  #overlay;
  #elements;
  #actions = { onChange: () => {}, onInstall: () => {}, onClose: () => {} };

  /** @param {ParentNode} root */
  constructor(root) {
    const find = (selector) => root.querySelector(selector);
    this.#overlay = new Overlay(find('#settings'), () => this.#actions.onClose());
    this.#elements = {
      themes: [...root.querySelectorAll('#settings input[name="theme"]')],
      sound: find('#setting-sound'),
      haptics: find('#setting-haptics'),
      hapticsNote: find('#haptics-note'),
      symbols: find('#setting-symbols'),
      install: find('#install-app'),
      close: find('#settings-close')
    };
    const { themes, sound, haptics, symbols, install, close } = this.#elements;
    for (const input of themes) {
      input.addEventListener('change', () => this.#actions.onChange({ theme: input.value }));
    }
    sound.addEventListener('change', () => this.#actions.onChange({ sound: sound.checked }));
    haptics.addEventListener('change', () => this.#actions.onChange({ haptics: haptics.checked }));
    symbols.addEventListener('change', () => this.#actions.onChange({ symbols: symbols.checked }));
    install.addEventListener('click', () => this.#actions.onInstall());
    close.addEventListener('click', () => this.#actions.onClose());
  }

  /**
   * @param {object} actions
   * @param {(change: Partial<import('./settings.js').Settings>) => void} actions.onChange
   * @param {() => void} actions.onInstall
   * @param {() => void} actions.onClose
   */
  bindActions(actions) {
    this.#actions = actions;
  }

  /**
   * @param {import('./settings.js').Settings} settings
   * @param {{ canVibrate: boolean, canInstall: boolean }} device
   */
  show(settings, device) {
    this.render(settings, device);
    const checked = this.#elements.themes.find((input) => input.checked);
    this.#overlay.open(checked ?? this.#elements.close);
  }

  /** Shows the settings as they are, e.g. right after a change. */
  render({ theme, sound, haptics, symbols }, { canVibrate, canInstall }) {
    const elements = this.#elements;
    for (const input of elements.themes) input.checked = input.value === theme;
    elements.sound.checked = sound;
    elements.haptics.checked = haptics && canVibrate;
    elements.symbols.checked = symbols;
    elements.haptics.disabled = !canVibrate;
    elements.hapticsNote.hidden = canVibrate;
    elements.install.hidden = !canInstall;
  }

  hide() {
    this.#overlay.close();
  }
}

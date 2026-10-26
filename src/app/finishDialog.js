import { Overlay } from './overlay.js';
import { texts } from './texts.js';

/**
 * The page a player gets for finishing every level: the name in its colors, a few numbers
 * about the run, and a way to share it. Like the other dialogs it only displays what it is
 * given and reports what the player picks.
 */
export class FinishDialog {
  #root;
  #overlay;
  #actions = { onShare: () => {}, onLevels: () => {}, onClose: () => {} };
  #shareText = '';

  /** @param {ParentNode} root */
  constructor(root) {
    this.#root = root.querySelector('#finish');
    this.#overlay = new Overlay(this.#root, () => this.#actions.onClose());
  }

  /**
   * @param {object} actions
   * @param {(text: string) => void} actions.onShare
   * @param {() => void} actions.onLevels
   * @param {() => void} actions.onClose
   * @param {() => void} [actions.onCelebrate] throws the confetti
   */
  bindActions(actions) {
    this.#actions = { onCelebrate: () => {}, ...actions };
  }

  /** @param {import('./controller.js').FinishSummary} summary */
  show(summary) {
    this.#shareText = summary.shareText;
    const card = this.#root.querySelector('.finish-card');
    card.replaceChildren(
      wordmark(),
      element('h2', '', texts.finishTitle),
      element('p', 'finish-text', texts.finishText(summary.total)),
      stats([
        [texts.finishStars, `${summary.stars} / ${summary.maxStars}`],
        [texts.finishPerfect, `${summary.perfect} / ${summary.total}`]
      ]),
      button('finish-share', 'primary', texts.finishShare, () =>
        this.#actions.onShare(this.#shareText)
      ),
      button('finish-levels', '', texts.finishLevels, () => this.#actions.onLevels()),
      coffee()
    );
    this.#overlay.open(card.querySelector('.finish-share'));
    this.#actions.onCelebrate?.();
  }

  hide() {
    this.#overlay.close();
  }
}

const LETTER_COLORS = ['#ef4444', '#fb923c', '#fde047', '#22c55e', '#38bdf8', '#6366f1', '#d946ef'];

function wordmark() {
  const mark = element('div', 'wordmark');
  mark.setAttribute('aria-label', 'Wasorty');
  [...'Wasorty'].forEach((letter, index) => {
    const span = element('span', '', letter);
    span.style.setProperty('--c', LETTER_COLORS[index]);
    mark.append(span);
  });
  return mark;
}

function stats(rows) {
  const list = element('dl', 'win-stats');
  for (const [name, value] of rows) {
    const row = element('div');
    row.append(element('dt', '', name), element('dd', '', value));
    list.append(row);
  }
  return list;
}

function button(className, extra, text, onClick) {
  const node = element('button', [className, extra].filter(Boolean).join(' '), text);
  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
}

function coffee() {
  const link = element('a', 'button coffee', texts.coffee);
  link.href = 'https://buymeacoffee.com/mifarosa';
  link.target = '_blank';
  link.rel = 'noopener';
  return link;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

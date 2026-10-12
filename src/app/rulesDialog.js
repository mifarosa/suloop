import { hasRuleIcon, drawRuleIcon } from '../scene/ruleIcon.js';
import { attemptItem } from './hud.js';
import { Overlay } from './overlay.js';
import { starRow } from './starIcons.js';
import { texts } from './texts.js';

const UNDO_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7 4 12l5 5"/><path d="M4.5 12H14a5.5 5.5 0 0 1 0 11h-2"/></svg>`;

/**
 * @typedef {object} RulesModel
 * @property {string} title
 * @property {Array<{ id: string, name: string, text: string }>} rules
 * @property {string} action the label of the button that closes the dialog
 * @property {boolean} [info] the full picture of the level, from the info button, rather than
 *   the rules it brings in
 * @property {Array<{ stars: number, text: string }> | null} [stars] what each star takes;
 *   null while the fewest moves are being worked out
 * @property {string} [starsPending] shown in place of the stars meanwhile
 * @property {string[]} [supplies] undos and hints the player has
 * @property {Array<{ moves: number, stars: number }> | null} [attempts] the last solutions,
 *   newest first; null when the puzzle keeps none
 */

/**
 * The dialog that explains rules: the new ones as a level brings them in, each with a sample
 * tube drawn like on the board, or from the info button everything about the level on the
 * board. It only displays what it is given.
 */
export class RulesDialog {
  #overlay;
  #elements;
  #getGlassColor;
  #showingInfo = false;
  #actions = { onClose: () => {} };

  /**
   * @param {ParentNode} root
   * @param {{ getGlassColor: () => string }} options the color the glass of the sample tubes
   *   is drawn in
   */
  constructor(root, { getGlassColor }) {
    const find = (selector) => root.querySelector(selector);
    this.#overlay = new Overlay(find('#rules'), () => this.#actions.onClose());
    this.#elements = {
      overlay: find('#rules'),
      title: find('#rules-title'),
      body: find('#rules-body'),
      action: find('#rules-action')
    };
    this.#getGlassColor = getGlassColor;
    find('#rules-close').addEventListener('click', () => this.#actions.onClose());
    this.#elements.action.addEventListener('click', () => this.#actions.onClose());
  }

  /** @param {{ onClose: () => void }} actions */
  bindActions(actions) {
    this.#actions = actions;
  }

  /** Whether the dialog is open with everything about the level. */
  get isShowingInfo() {
    return this.#showingInfo && !this.#elements.overlay.hidden;
  }

  /** @param {RulesModel} model */
  show(model) {
    const { title, body, action } = this.#elements;
    this.#showingInfo = Boolean(model.info);
    title.textContent = model.title;
    action.textContent = model.action;
    body.replaceChildren(...this.#sections(model));
    this.#overlay.open(action);

    // The sample tubes need the laid out size of their canvas, so they are drawn once shown.
    const glassColor = this.#getGlassColor();
    for (const canvas of body.querySelectorAll('canvas[data-rule]')) {
      drawRuleIcon(canvas, canvas.dataset.rule, glassColor);
    }
  }

  hide() {
    this.#overlay.close();
  }

  #sections({ info, rules, stars, starsPending, supplies, attempts }) {
    const list = element('ul', 'rule-list');
    list.append(...rules.map(ruleItem));
    if (!info) return [list];

    const sections = [section(texts.rulesHeading, list)];
    sections.push(
      section(
        texts.starsHeading,
        stars
          ? listOf(
              'star-rules',
              stars.map(({ stars: count, text }) => {
                const item = element('li', '', text);
                item.prepend(starRow(count));
                return item;
              })
            )
          : element('p', 'muted', starsPending)
      )
    );
    sections.push(
      section(
        texts.suppliesHeading,
        listOf(
          'supplies',
          supplies.map((supply) => element('li', '', supply))
        )
      )
    );
    if (attempts) {
      sections.push(
        section(
          texts.attemptsTitle,
          attempts.length > 0
            ? listOf('attempts', attempts.map(attemptItem), 'ol')
            : element('p', 'muted', texts.noAttempts)
        )
      );
    }
    return sections;
  }
}

function ruleItem({ id, name, text }) {
  const item = element('li', 'rule');
  let icon;
  if (hasRuleIcon(id)) {
    icon = element('canvas', 'rule-icon');
    icon.dataset.rule = id;
    icon.setAttribute('aria-hidden', 'true');
  } else {
    icon = element('span', 'rule-icon symbol');
    icon.innerHTML = UNDO_ICON;
  }
  const words = element('div', 'rule-text');
  words.append(element('strong', '', name), element('p', '', text));
  item.append(icon, words);
  return item;
}

function section(heading, content) {
  const node = element('section', 'rules-section');
  node.append(element('h3', '', heading), content);
  return node;
}

function listOf(className, items, tag = 'ul') {
  const list = element(tag, className);
  list.append(...items);
  return list;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

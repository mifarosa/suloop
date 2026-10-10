/**
 * @typedef {object} LevelMenuModel
 * @property {{ title: string, date: string, action: string, solved: boolean, playing: boolean }} daily
 * @property {Array<{
 *   id: string,
 *   name: string,
 *   detail: string,
 *   progress: string,
 *   difficulty: number,
 *   levels: Array<{ level: number, state: 'solved' | 'open' | 'locked', playing: boolean, label: string }>
 * }>} chapters
 */

const LOCK_ICON = `<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`;

/**
 * The level list: today's puzzle on top, then every level grouped by difficulty. Like the
 * HUD it only displays what it is given and reports what the player picks.
 */
export class LevelMenu {
  #overlay;
  #body;
  #closeButton;
  #returnFocusTo = null;
  #actions = { onPickLevel: () => {}, onPickDaily: () => {}, onClose: () => {} };

  /** @param {ParentNode} root */
  constructor(root) {
    this.#overlay = root.querySelector('#levels');
    this.#body = root.querySelector('#levels-body');
    this.#closeButton = root.querySelector('#levels-close');

    this.#closeButton.addEventListener('click', () => this.#actions.onClose());
    // A tap on the dimmed area around the panel closes it, like the close button.
    this.#overlay.addEventListener('click', (event) => {
      if (event.target === this.#overlay) this.#actions.onClose();
    });
    this.#overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.#actions.onClose();
    });
    this.#body.addEventListener('click', (event) => this.#handlePick(event));
  }

  /**
   * @param {object} actions
   * @param {(level: number) => void} actions.onPickLevel
   * @param {() => void} actions.onPickDaily
   * @param {() => void} actions.onClose
   */
  bindActions(actions) {
    this.#actions = actions;
  }

  /** @param {LevelMenuModel} model */
  show(model) {
    if (this.#overlay.hidden) this.#returnFocusTo = document.activeElement;

    this.#body.replaceChildren(dailyCard(model.daily), ...model.chapters.map(chapterSection));
    this.#overlay.hidden = false;

    const playing = this.#body.querySelector('[aria-current="true"]') ?? this.#closeButton;
    playing.scrollIntoView({ block: 'center' });
    playing.focus({ preventScroll: true });
  }

  hide() {
    if (this.#overlay.hidden) return;

    this.#overlay.hidden = true;
    this.#returnFocusTo?.focus?.();
    this.#returnFocusTo = null;
  }

  #handlePick(event) {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;

    if (button.dataset.daily !== undefined) this.#actions.onPickDaily();
    else this.#actions.onPickLevel(Number(button.dataset.level));
  }
}

function dailyCard({ title, date, action, solved, playing }) {
  const card = element('button', 'daily-card');
  card.type = 'button';
  card.dataset.daily = '';
  card.classList.toggle('solved', solved);
  if (playing) card.setAttribute('aria-current', 'true');

  const text = element('span', 'daily-text');
  text.append(element('strong', '', title), element('span', 'daily-date', date));
  card.append(text, element('span', 'daily-action', action));
  return card;
}

function chapterSection({ id, name, detail, progress, difficulty, levels }) {
  const section = element('section', 'chapter');
  section.dataset.chapter = id;
  section.setAttribute('aria-label', name);

  const header = element('header', 'chapter-header');
  const title = element('div', 'chapter-title');
  title.append(element('h3', '', name), difficultyBars(difficulty));
  header.append(title, element('span', 'chapter-progress', progress));

  const grid = element('div', 'level-grid');
  grid.append(...levels.map(levelTile));

  section.append(header, element('p', 'chapter-detail', detail), grid);
  return section;
}

/** One to four filled bars, like a signal meter, so the difficulty reads at a glance. */
function difficultyBars(difficulty) {
  const bars = element('span', 'difficulty');
  bars.setAttribute('aria-hidden', 'true');
  for (let i = 1; i <= 4; i++) bars.append(element('i', i <= difficulty ? 'on' : ''));
  return bars;
}

function levelTile({ level, state, playing, label }) {
  const tile = element('button', `level-tile ${state}`);
  tile.type = 'button';
  tile.dataset.level = String(level);
  tile.disabled = state === 'locked';
  tile.setAttribute('aria-label', label);
  if (playing) tile.setAttribute('aria-current', 'true');

  tile.append(element('span', 'level-number', String(level)));
  if (state === 'locked') tile.insertAdjacentHTML('beforeend', LOCK_ICON);
  return tile;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

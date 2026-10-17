/**
 * @typedef {object} LevelMenuModel
 * @property {{
 *   title: string,
 *   date: string,
 *   action: string,
 *   solved: boolean,
 *   playing: boolean,
 *   result: { text: string, stars: number } | null,
 *   streak: string | null
 * }} daily today's result and the streak, when there are any
 * @property {{ title: string, text: string, action: string }} editor
 * @property {Array<{
 *   id: string,
 *   name: string,
 *   detail: string,
 *   progress: string,
 *   difficulty: number,
 *   levels: Array<{
 *     level: number,
 *     state: 'solved' | 'open' | 'locked',
 *     stars: number,
 *     playing: boolean,
 *     label: string
 *   }>
 * }>} chapters
 */

import { Overlay } from './overlay.js';
import { starRow } from './starIcons.js';

const LOCK_ICON = `<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`;

/**
 * The level list: today's puzzle on top, then every level grouped by difficulty. Like the
 * HUD it only displays what it is given and reports what the player picks.
 */
export class LevelMenu {
  #overlay;
  #body;
  #closeButton;
  #actions = {
    onPickLevel: () => {},
    onPickDaily: () => {},
    onLeaderboard: () => {},
    onEditor: () => {},
    onClose: () => {}
  };

  /** @param {ParentNode} root */
  constructor(root) {
    this.#overlay = new Overlay(root.querySelector('#levels'), () => this.#actions.onClose());
    this.#body = root.querySelector('#levels-body');
    this.#closeButton = root.querySelector('#levels-close');

    this.#closeButton.addEventListener('click', () => this.#actions.onClose());
    root
      .querySelector('#leaderboard-open')
      .addEventListener('click', () => this.#actions.onLeaderboard());
    this.#body.addEventListener('click', (event) => this.#handlePick(event));
  }

  /**
   * @param {object} actions
   * @param {(level: number) => void} actions.onPickLevel
   * @param {() => void} actions.onPickDaily
   * @param {() => void} actions.onLeaderboard opens the daily leaderboard
   * @param {() => void} actions.onEditor opens the puzzle editor
   * @param {() => void} actions.onClose
   */
  bindActions(actions) {
    this.#actions = actions;
  }

  /** @param {LevelMenuModel} model */
  show(model) {
    this.#body.replaceChildren(
      dailyCard(model.daily),
      editorCard(model.editor),
      ...model.chapters.map(chapterSection)
    );

    const playing = this.#body.querySelector('[aria-current="true"]') ?? this.#closeButton;
    this.#overlay.open(playing);
    playing.scrollIntoView({ block: 'center' });
  }

  hide() {
    this.#overlay.close();
  }

  #handlePick(event) {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;

    if (button.dataset.daily !== undefined) this.#actions.onPickDaily();
    else if (button.dataset.editor !== undefined) this.#actions.onEditor();
    else this.#actions.onPickLevel(Number(button.dataset.level));
  }
}

function dailyCard({ title, date, action, solved, playing, result = null, streak = null }) {
  const card = element('button', 'daily-card');
  card.type = 'button';
  card.dataset.daily = '';
  card.classList.toggle('solved', solved);
  if (playing) card.setAttribute('aria-current', 'true');

  const text = element('span', 'daily-text');
  text.append(element('strong', '', title), element('span', 'daily-date', date));
  if (result) {
    const line = element('span', 'daily-result', result.text);
    line.append(starRow(result.stars));
    text.append(line);
  }
  if (streak) text.append(element('span', 'daily-streak-line', streak));
  card.append(text, element('span', 'daily-action', action));
  return card;
}

function editorCard({ title, text, action }) {
  const card = element('button', 'daily-card editor-card');
  card.type = 'button';
  card.dataset.editor = '';
  const words = element('span', 'daily-text');
  words.append(element('strong', '', title), element('span', 'daily-date', text));
  card.append(words, element('span', 'daily-action', action));
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

function levelTile({ level, state, stars, playing, label }) {
  const tile = element('button', `level-tile ${state}`);
  tile.type = 'button';
  tile.dataset.level = String(level);
  tile.disabled = state === 'locked';
  tile.setAttribute('aria-label', label);
  if (playing) tile.setAttribute('aria-current', 'true');

  tile.append(element('span', 'level-number', String(level)));
  if (state === 'locked') tile.insertAdjacentHTML('beforeend', LOCK_ICON);
  // Levels solved before stars were counted have none to show.
  if (state === 'solved' && stars > 0) tile.append(starRow(stars, 'stars tile-stars'));
  return tile;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

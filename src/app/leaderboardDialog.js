import { NAME_MAX_LENGTH } from './dailyResults.js';
import { Overlay } from './overlay.js';
import { starRow } from './starIcons.js';
import { texts } from './texts.js';

/**
 * The daily leaderboard: how the player did today and their streak, then the best players
 * of the day when scores are shared, or the player's own last days when they are not. It
 * asks for a name before the player's score can be shared.
 */
export class LeaderboardDialog {
  #overlay;
  #body;
  #close;
  #actions = { onSetName: () => {}, onPlayDaily: () => {}, onClose: () => {} };

  /** @param {ParentNode} root */
  constructor(root) {
    this.#overlay = new Overlay(root.querySelector('#leaderboard'), () => this.#actions.onClose());
    this.#body = root.querySelector('#leaderboard-body');
    this.#close = root.querySelector('#leaderboard-close');
    this.#close.addEventListener('click', () => this.#actions.onClose());
  }

  /**
   * @param {object} actions
   * @param {(name: string) => void} actions.onSetName
   * @param {() => void} actions.onPlayDaily
   * @param {() => void} actions.onClose
   */
  bindActions(actions) {
    this.#actions = actions;
  }

  /** Opens the dialog at once while the scores load. */
  showLoading() {
    this.#body.replaceChildren(element('p', 'muted', texts.leaderboardLoading));
    this.#overlay.open(this.#close);
  }

  /** @param {Awaited<ReturnType<import('./dailyBoard.js').DailyBoard['view']>>} view */
  show(view) {
    this.#body.replaceChildren(...this.#sections(view));
    this.#overlay.open(this.#body.querySelector('input, button.primary') ?? this.#close);
  }

  hide() {
    this.#overlay.close();
  }

  #sections({ online, name, today, streak, history, top, failed }) {
    const sections = [];

    const summary = element('section', 'daily-summary');
    if (today) {
      const line = element('p', 'daily-today', texts.dailyToday(today.moves, today.seconds));
      line.append(starRow(today.stars));
      summary.append(line);
    } else {
      const play = element('button', 'primary', texts.playDaily);
      play.type = 'button';
      play.addEventListener('click', () => this.#actions.onPlayDaily());
      summary.append(element('p', 'muted', texts.dailyNotSolved), play);
    }
    if (streak > 0) summary.append(element('p', 'daily-streak', texts.dailyStreak(streak)));
    sections.push(summary);

    if (online && !name) sections.push(this.#nameForm());

    if (online) {
      const heading = element('h3', '', texts.leaderboardTop);
      if (failed) {
        sections.push(section(heading, element('p', 'muted', texts.leaderboardFailed)));
      } else if (top.length === 0) {
        sections.push(section(heading, element('p', 'muted', texts.leaderboardEmpty)));
      } else {
        const list = element('ol', 'ranking');
        top.forEach((score, i) => {
          const mine =
            today &&
            score.name === name &&
            score.moves === today.moves &&
            score.seconds === Math.min(today.seconds, 86400);
          list.append(scoreRow(i + 1, score.name, score, mine));
        });
        sections.push(section(heading, list));
      }
    } else {
      const heading = element('h3', '', texts.dailyHistory);
      const list = element('ol', 'ranking history');
      for (const result of history) {
        list.append(scoreRow(null, texts.dailyDate(result.day), result, false));
      }
      sections.push(
        section(
          heading,
          history.length > 0 ? list : element('p', 'muted', texts.dailyNoHistory),
          element('p', 'note', texts.leaderboardLocalOnly)
        )
      );
    }
    return sections;
  }

  #nameForm() {
    const form = element('form', 'name-form');
    const label = element('label', '', texts.leaderboardName);
    const input = element('input');
    input.type = 'text';
    input.id = 'leaderboard-name';
    input.maxLength = NAME_MAX_LENGTH;
    input.autocomplete = 'nickname';
    input.placeholder = texts.leaderboardNamePlaceholder;
    label.htmlFor = input.id;
    const save = element('button', 'primary', texts.save);
    save.type = 'submit';
    const row = element('div', 'transfer-row');
    row.append(input, save);
    form.append(label, row);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.#actions.onSetName(input.value);
    });
    return form;
  }
}

function scoreRow(rank, label, { moves, seconds, stars }, mine) {
  const row = element('li', mine ? 'mine' : '');
  if (rank !== null) row.append(element('span', 'rank', String(rank)));
  row.append(
    element('span', 'who', label),
    element('span', 'moves', texts.attemptMoves(moves)),
    element('span', 'time', texts.duration(seconds)),
    starRow(stars)
  );
  return row;
}

function section(...children) {
  const node = element('section', 'rules-section');
  node.append(...children);
  return node;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

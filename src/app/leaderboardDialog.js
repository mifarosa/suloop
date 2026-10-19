import { Overlay } from './overlay.js';
import { starRow } from './starIcons.js';
import { texts } from './texts.js';

/**
 * The daily leaderboard: how the player did today and their streak, then the best players
 * of the day with their points when scores are shared, or the player's own last days when they
 * are not. A player who has not signed in (or has no username yet) is asked to, since scores
 * go under a username.
 */
export class LeaderboardDialog {
  #overlay;
  #body;
  #close;
  #actions = { onSignIn: () => {}, onPlayDaily: () => {}, onClose: () => {} };

  /** @param {ParentNode} root */
  constructor(root) {
    this.#overlay = new Overlay(root.querySelector('#leaderboard'), () => this.#actions.onClose());
    this.#body = root.querySelector('#leaderboard-body');
    this.#close = root.querySelector('#leaderboard-close');
    this.#close.addEventListener('click', () => this.#actions.onClose());
  }

  /**
   * @param {object} actions
   * @param {() => void} actions.onSignIn opens the account, to sign in or pick a username
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

  /**
   * @param {Awaited<ReturnType<import('./dailyBoard.js').DailyBoard['view']>>} view
   * @param {{ signedIn: boolean, username: string | null }} account
   */
  show(view, account) {
    this.#body.replaceChildren(...this.#sections(view, account));
    this.#overlay.open(this.#body.querySelector('input, button.primary') ?? this.#close);
  }

  hide() {
    this.#overlay.close();
  }

  #sections({ online, today, streak, history, top, rank, failed }, { signedIn, username }) {
    const sections = [];

    const summary = element('section', 'daily-summary');
    if (today) {
      const line = element(
        'p',
        'daily-today',
        texts.dailyToday(today.moves, today.seconds, today.score)
      );
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

    if (online) {
      if (!username) sections.push(this.#signInPrompt(signedIn));
      else if (today && !today.shared && today.score !== undefined) {
        sections.push(section(element('p', 'note', texts.leaderboardSending)));
      }

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
            username !== null &&
            score.name === username &&
            score.moves === today.moves &&
            score.seconds === Math.min(today.seconds, 86400);
          list.append(scoreRow(i + 1, score.name, score, mine));
        });
        const parts = [heading];
        if (rank !== null) parts.push(element('p', 'daily-rank', texts.leaderboardMyRank(rank)));
        sections.push(section(...parts, list, element('p', 'note', texts.leaderboardHow)));
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

  /** Scores go under a username, so a player without one is asked to sign in or pick one. */
  #signInPrompt(signedIn) {
    const prompt = element('section', 'sign-in-prompt');
    const action = element('button', 'primary', signedIn ? texts.pickUsername : texts.signInToRank);
    action.type = 'button';
    action.addEventListener('click', () => this.#actions.onSignIn());
    prompt.append(
      element('p', 'muted', signedIn ? texts.leaderboardNeedsName : texts.leaderboardSignIn),
      action
    );
    return prompt;
  }
}

/** A line of the list: on the day's ranking the points close it, on the player's own days the stars. */
function scoreRow(rank, label, { moves, seconds, stars, score }, mine) {
  const row = element('li', mine ? 'mine' : '');
  if (rank !== null) row.append(element('span', 'rank', String(rank)));
  row.append(
    element('span', 'who', label),
    element('span', 'moves', texts.attemptMoves(moves)),
    element('span', 'time', texts.duration(seconds))
  );
  row.append(rank !== null ? element('span', 'points', texts.points(score)) : starRow(stars));
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

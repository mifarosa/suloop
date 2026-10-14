import { starRow } from './starIcons.js';
import { texts } from './texts.js';

const TOAST_DURATION_MS = 2400;
const LONG_TOAST_DURATION_MS = 5000;

/**
 * The page around the game board: title and move counter, the toolbar with the undos and
 * hints left, the toast message and the win dialog. It only displays what it is given and
 * forwards button clicks.
 */
export class Hud {
  #elements;
  #toastTimer;
  #shareText = null;

  /** @param {ParentNode} root */
  constructor(root) {
    const find = (selector) => root.querySelector(selector);
    this.#elements = {
      title: find('#title'),
      subtitle: find('#subtitle'),
      info: find('#info'),
      settings: find('#settings-open'),
      undo: find('#undo'),
      undoCount: find('#undo .count'),
      hint: find('#hint'),
      hintCount: find('#hint .count'),
      restart: find('#restart'),
      levels: find('#levels-open'),
      toast: find('#toast'),
      win: find('#win'),
      winStars: find('#win-stars'),
      winTitle: find('#win-title'),
      winMoves: find('#win-moves'),
      winFewest: find('#win-fewest'),
      winFewestLabel: find('#win-fewest-label'),
      winNotes: find('#win-notes'),
      winAttemptsSection: find('#win-attempts-section'),
      winAttempts: find('#win-attempts'),
      replay: find('#replay'),
      winLeaderboard: find('#win-leaderboard'),
      share: find('#share-result'),
      next: find('#next'),
      winLevels: find('#win-levels')
    };
  }

  /**
   * @param {object} actions
   * @param {() => void} actions.onUndo
   * @param {() => void} actions.onHint
   * @param {() => void} actions.onRestart
   * @param {() => void} actions.onInfo
   * @param {() => void} actions.onSettings
   * @param {() => void} actions.onShowLevels
   * @param {() => void} actions.onContinue
   * @param {() => void} actions.onReplay
   * @param {() => void} actions.onContinueToLevels
   * @param {() => void} actions.onLeaderboard
   */
  bindActions(actions) {
    const { undo, hint, restart, info, settings, levels, next, replay, winLevels, winLeaderboard } =
      this.#elements;
    undo.addEventListener('click', actions.onUndo);
    hint.addEventListener('click', actions.onHint);
    restart.addEventListener('click', actions.onRestart);
    info.addEventListener('click', actions.onInfo);
    settings.addEventListener('click', actions.onSettings);
    levels.addEventListener('click', actions.onShowLevels);
    next.addEventListener('click', actions.onContinue);
    replay.addEventListener('click', actions.onReplay);
    winLevels.addEventListener('click', actions.onContinueToLevels);
    winLeaderboard.addEventListener('click', actions.onLeaderboard);
    this.#elements.share.addEventListener('click', () => this.#shareResult());
  }

  /**
   * @param {object} state
   * @param {string} state.title
   * @param {string} state.subtitle
   * @param {boolean} state.canUndo
   * @param {string | null} state.undoCount undos left, or null when there is no limit
   * @param {string} state.undoLabel the undo button described for screen readers
   * @param {string} state.hintCount hints left
   * @param {string} state.hintLabel
   * @param {string} [state.levelsLabel] the label of the button that leaves the board
   */
  render({ title, subtitle, canUndo, undoCount, undoLabel, hintCount, hintLabel, levelsLabel }) {
    const elements = this.#elements;
    elements.title.textContent = title;
    elements.subtitle.textContent = subtitle;
    elements.undo.disabled = !canUndo;
    elements.undo.setAttribute('aria-label', undoLabel);
    elements.undoCount.hidden = undoCount === null;
    elements.undoCount.textContent = undoCount ?? '';
    elements.hint.setAttribute('aria-label', hintLabel);
    elements.hintCount.textContent = hintCount;
    elements.hint.classList.toggle('empty', hintCount === '0');
    if (levelsLabel) elements.levels.textContent = levelsLabel;
  }

  /**
   * Shows a short message for a few seconds.
   * @param {string} message
   * @param {{ long?: boolean }} [options] long: leaves time to read an explanation
   */
  showToast(message, { long = false } = {}) {
    const { toast } = this.#elements;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(this.#toastTimer);
    this.#toastTimer = setTimeout(
      () => toast.classList.remove('show'),
      long ? LONG_TOAST_DURATION_MS : TOAST_DURATION_MS
    );
  }

  /**
   * @param {object} win
   * @param {string} win.title
   * @param {number} win.stars
   * @param {number} win.moves the player's moves
   * @param {number} win.fewest the fewest moves
   * @param {string} win.fewestLabel
   * @param {string[]} win.notes what the win opened or earned
   * @param {Array<{ moves: number, stars: number }> | null} win.attempts the last solutions,
   *   newest first; null for none to show
   * @param {string} win.continueLabel
   * @param {boolean} [win.leaderboard] offer the daily leaderboard
   * @param {string | null} [win.shareText] what the share button sends, without the link;
   *   null for a puzzle that is not shared this way
   */
  showWin({
    title,
    stars,
    moves,
    fewest,
    fewestLabel,
    notes,
    attempts,
    continueLabel,
    leaderboard = false,
    shareText = null
  }) {
    const elements = this.#elements;
    elements.winStars.replaceChildren(starRow(stars, 'stars big'));
    elements.winStars.setAttribute('aria-label', texts.starsLabel(stars));
    elements.winTitle.textContent = title;
    elements.winMoves.textContent = String(moves);
    elements.winFewest.textContent = String(fewest);
    elements.winFewestLabel.textContent = fewestLabel;
    elements.winNotes.replaceChildren(...notes.map((note) => listItem(note)));
    elements.winNotes.hidden = notes.length === 0;
    elements.winAttemptsSection.hidden = !attempts;
    if (attempts) elements.winAttempts.replaceChildren(...attempts.map(attemptItem));
    elements.next.textContent = continueLabel;
    elements.winLeaderboard.hidden = !leaderboard;
    this.#shareText = shareText;
    elements.share.hidden = shareText === null;
    elements.share.textContent = texts.shareResult;
    elements.win.hidden = false;
    elements.next.focus();
  }

  hideWin() {
    this.#elements.win.hidden = true;
  }

  /** Sends the result with the share sheet where there is one, and copies it otherwise. */
  async #shareResult() {
    if (this.#shareText === null) return;
    const url = `${location.origin}${location.pathname}`;
    const { share } = this.#elements;
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ text: this.#shareText, url });
        return;
      }
      await navigator.clipboard.writeText(`${this.#shareText}\n${url}`);
    } catch (error) {
      // The player closed the share sheet; nothing to do. Anything else: nothing was copied.
      if (error?.name !== 'AbortError') this.showToast(texts.copyFailed);
      return;
    }
    share.textContent = texts.shareCopied;
    setTimeout(() => (share.textContent = texts.shareResult), 2000);
  }
}

/**
 * One solution in a list of the last ones: its moves and stars.
 * @param {{ moves: number, stars: number }} attempt
 */
export function attemptItem({ moves, stars }) {
  const item = listItem(texts.attemptMoves(moves));
  item.prepend(starRow(stars));
  item.setAttribute('aria-label', `${texts.attemptMoves(moves)}, ${texts.starsLabel(stars)}`);
  return item;
}

function listItem(text) {
  const item = document.createElement('li');
  item.append(document.createTextNode(text));
  return item;
}

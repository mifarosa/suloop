import { createDailyPuzzle, createLevelPuzzle } from '../game/levels.js';
import { GameSession } from '../game/session.js';
import { localDateKey } from './calendar.js';
import { texts } from './texts.js';

/**
 * Runs the game: applies the player's actions to the session, plays the matching
 * animations, keeps the HUD up to date and saves progress.
 */
export class GameController {
  #scene;
  #hud;
  #progress;
  #saveProgress;
  #now;
  /** @type {GameSession} */
  #session;
  /** The calendar day of the daily puzzle being played. */
  #puzzleDay;
  /** Set while a pour or the win celebration plays; input waits until it is over. */
  #animating = false;

  /**
   * @param {object} deps
   * @param {import('../scene/tubeScene.js').TubeScene} deps.scene
   * @param {import('./hud.js').Hud} deps.hud
   * @param {import('./progress.js').Progress} deps.progress
   * @param {(progress: import('./progress.js').Progress) => void} deps.saveProgress
   * @param {() => Date} [deps.now]
   */
  constructor({ scene, hud, progress, saveProgress, now = () => new Date() }) {
    this.#scene = scene;
    this.#hud = hud;
    this.#progress = { ...progress };
    this.#saveProgress = saveProgress;
    this.#now = now;
  }

  /** Starts the puzzle for the current mode: today's daily puzzle or the next level. */
  start() {
    this.#puzzleDay = this.#now();
    const tubes = this.#isDaily()
      ? createDailyPuzzle(localDateKey(this.#puzzleDay))
      : createLevelPuzzle(this.#progress.level);

    this.#session = new GameSession(tubes);
    this.#scene.showPuzzle(this.#session.tubes);
    this.#hud.hideWin();
    this.#refreshHud();
  }

  /** @param {number} index */
  async tapTube(index) {
    if (this.#animating) return;

    const result = this.#session.tap(index);
    switch (result.type) {
      case 'selected':
        this.#scene.setLifted(result.tube, true);
        break;
      case 'deselected':
        this.#scene.setLifted(result.tube, false);
        break;
      case 'rejected':
        this.#scene.shake(result.tube);
        break;
      case 'blocked':
        this.#scene.setLifted(result.from, false);
        this.#scene.shake(result.to);
        break;
      case 'poured':
        await this.#playPour(result);
        break;
    }
  }

  undo() {
    if (this.#animating || !this.#session.canUndo) return;

    this.#session.undo();
    this.#scene.showContents(this.#session.tubes);
    this.#refreshHud();
  }

  restart() {
    if (this.#animating || this.#session.solved) return;

    this.#session.restart();
    this.#scene.showContents(this.#session.tubes);
    this.#refreshHud();
  }

  showHint() {
    if (this.#animating || this.#session.solved) return;

    this.#putSelectionDown();
    const move = this.#session.hint();
    if (!move) {
      this.#hud.showToast(texts.hintDeadEnd);
      return;
    }
    const [from, to] = move;
    this.#scene.highlight([from, to]);
    this.#hud.showToast(texts.hintMove(from, to));
  }

  /** Switches between the numbered levels and the daily puzzle. */
  toggleMode() {
    if (this.#animating) return;

    this.#updateProgress({ mode: this.#isDaily() ? 'level' : 'daily' });
    this.start();
  }

  /** Closes the win dialog: on to the next level, or back to the levels after the daily puzzle. */
  continueAfterWin() {
    if (this.#isDaily()) this.#updateProgress({ mode: 'level' });
    this.start();
  }

  async #playPour({ from, to, amount, filled, solved }) {
    this.#animating = true;
    this.#refreshHud();
    try {
      await this.#scene.pour(from, to, amount, this.#session.tubes);
      if (filled) this.#scene.hop(to);
      if (solved) await this.#celebrateWin();
    } finally {
      this.#animating = false;
    }
  }

  async #celebrateWin() {
    const wasDaily = this.#isDaily();
    if (wasDaily) {
      this.#updateProgress({ dailyDone: localDateKey(this.#puzzleDay) });
    } else {
      this.#updateProgress({ level: this.#progress.level + 1 });
    }

    await this.#scene.celebrate();
    this.#hud.showWin({
      message: texts.solvedIn(this.#session.moveCount),
      continueLabel: wasDaily ? texts.backToLevels : texts.nextLevel
    });
  }

  #putSelectionDown() {
    const result = this.#session.deselect();
    if (result.type === 'deselected') this.#scene.setLifted(result.tube, false);
  }

  #updateProgress(changes) {
    this.#progress = { ...this.#progress, ...changes };
    this.#saveProgress(this.#progress);
  }

  #isDaily() {
    return this.#progress.mode === 'daily';
  }

  #refreshHud() {
    const { level, dailyDone } = this.#progress;
    const daily = this.#isDaily();
    this.#hud.render({
      title: daily
        ? texts.dailyTitle(this.#puzzleDay, dailyDone === localDateKey(this.#puzzleDay))
        : texts.levelTitle(level),
      moves: texts.moves(this.#session.moveCount),
      canUndo: this.#session.canUndo,
      modeLabel: daily ? texts.showLevels : texts.showDaily
    });
  }
}

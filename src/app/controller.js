import {
  createDailyPuzzle,
  createLevelPuzzle,
  DAILY_SETTINGS,
  levelCountOf,
  levelSettings,
  MASTER_STAGE,
  rulesFirstUsedAt,
  specialRules,
  STAGE_LEVEL_COUNT,
  STAGE_STARTS,
  stageOfLevel,
  STAGES
} from '../game/levels.js';
import { boardOf, rulesOf } from '../game/customPuzzle.js';
import { GameSession } from '../game/session.js';
import { MAX_STARS, starsFor, twoStarLimit } from '../game/stars.js';
import { localDateKey } from './calendar.js';
import {
  MAX_SPARE_UNDOS,
  recordDailyWin,
  recordLevelWin,
  spendHint,
  spendSpareUndo
} from './economy.js';
import { lastOpenLevel } from './progress.js';
import { decodeProgressCode, encodeProgressCode } from './progressCode.js';
import { decodeSnapshot, encodeSnapshot, mergeSnapshot } from './progressSnapshot.js';
import { texts } from './texts.js';

/**
 * @typedef {{ moves: number, proven: boolean } | null} Fewest the fewest moves of a puzzle
 *   (see fewestMoves in shortest.js)
 */

/** After this many solutions in a row of one level without every star, the player may watch it. */
export const WATCH_AFTER_SOLVES = 5;
/** How long a tube stays lifted before the pour of a move being shown. */
const WATCH_LIFT_MS = 350;

/** Feedback that makes no sound and no vibration, for when none is given. */
const SILENT = Object.freeze({
  pick() {},
  putDown() {},
  reject() {},
  undo() {},
  hint() {},
  win() {}
});

/**
 * Runs the game: applies the player's actions to the session, plays the matching
 * animations, keeps the HUD and the level list up to date and saves progress.
 */
export class GameController {
  #scene;
  #hud;
  #menu;
  #transfer;
  #rules;
  #feedback;
  #onDailySolved;
  #getDailySummary;
  #dailyResults;
  #leaderboardOnline;
  #onEditPuzzle;
  #findFewestMoves;
  #findSolution;
  #progress;
  #saveProgress;
  #now;
  /** @type {GameSession} */
  #session;
  /** The numbered level on the board; null while the daily or a custom puzzle is played. */
  #level = null;
  /**
   * A custom puzzle on the board, made in the editor or opened from a shared link; it is not
   * saved, and leaves the progress as it is.
   * @type {{ puzzle: import('../game/customPuzzle.js').CustomPuzzle, fromEditor: boolean } | null}
   */
  #custom = null;
  /** The calendar day of the daily puzzle being played. */
  #puzzleDay;
  /** When the puzzle on the board was put there, in ms: the daily puzzle's clock. */
  #startedAt = 0;
  /** @type {Promise<Fewest>} the fewest moves of the puzzle on the board, once worked out */
  #fewest;
  /** @type {Fewest | undefined} the same, as soon as it is known */
  #fewestKnown;
  /** The last hint and the position it was for: asking again there costs nothing. */
  #lastHint = null;
  /**
   * How many solutions in a row the level on the board has had without every star; it starts
   * over on another level.
   */
  #tries = { level: null, count: 0 };
  /**
   * The solution being shown, one move for each tap: the moves, how many are played and
   * whether one is playing. Null when the player plays themselves.
   * @type {{ moves: Array<[number, number]>, done: number, busy: boolean } | null}
   */
  #watch = null;
  /** Set while the win celebration plays; input waits until it is over. Pours do not block. */
  #animating = false;

  /**
   * @param {object} deps
   * @param {import('../scene/tubeScene.js').TubeScene} deps.scene
   * @param {import('./hud.js').Hud} deps.hud
   * @param {import('./levelMenu.js').LevelMenu} deps.menu
   * @param {import('./transferDialog.js').TransferDialog} deps.transfer
   * @param {import('./rulesDialog.js').RulesDialog} deps.rules
   * @param {(puzzle: { level: number } | { day: string }) => Promise<Fewest>} deps.findFewestMoves
   * @param {(puzzle: { level: number }) => Promise<Array<[number, number]> | null>}
   *   [deps.findSolution] a shortest solution of a numbered level
   * @param {import('./feedback.js').Feedback} [deps.feedback] sounds and vibration
   * @param {(day: string, result: { moves: number, seconds: number, stars: number }) => void}
   *   [deps.onDailySolved] called with each solution of a daily puzzle
   * @param {(today: Date) => { today: { moves: number, seconds: number, stars: number } | null,
   *   streak: number }} [deps.getDailySummary] the player's daily result and streak
   * @param {{ results: () => object, merge: (results: object) => void }} [deps.dailyResults]
   *   the daily puzzle results kept on this device, to carry them along with the progress
   * @param {boolean} [deps.leaderboardOnline] whether daily scores are shared with others
   * @param {(puzzle: import('../game/customPuzzle.js').CustomPuzzle) => void} [deps.onEditPuzzle]
   *   takes a custom puzzle back to the editor after a test play
   * @param {import('./progress.js').Progress} deps.progress
   * @param {(progress: import('./progress.js').Progress) => void} deps.saveProgress
   * @param {() => Date} [deps.now]
   */
  constructor({
    scene,
    hud,
    menu,
    transfer,
    rules,
    findFewestMoves,
    findSolution = () => Promise.resolve(null),
    feedback = SILENT,
    onDailySolved = () => {},
    getDailySummary = () => ({ today: null, streak: 0 }),
    dailyResults = { results: () => ({}), merge: () => {} },
    leaderboardOnline = false,
    onEditPuzzle = () => {},
    progress,
    saveProgress,
    now = () => new Date()
  }) {
    this.#scene = scene;
    this.#hud = hud;
    this.#menu = menu;
    this.#transfer = transfer;
    this.#rules = rules;
    this.#feedback = feedback;
    this.#onDailySolved = onDailySolved;
    this.#getDailySummary = getDailySummary;
    this.#dailyResults = dailyResults;
    this.#leaderboardOnline = leaderboardOnline;
    this.#onEditPuzzle = onEditPuzzle;
    this.#findFewestMoves = findFewestMoves;
    this.#findSolution = findSolution;
    this.#progress = { ...progress };
    this.#saveProgress = saveProgress;
    this.#now = now;
  }

  /** Starts the puzzle for the current mode: today's daily puzzle or the current level. */
  start() {
    this.#puzzleDay = this.#now();
    this.#startedAt = this.#puzzleDay.getTime();
    this.#level = this.#custom || this.#isDaily() ? null : this.#progress.current;
    this.#watch = null;
    if (this.#tries.level !== this.#level) this.#tries = { level: this.#level, count: 0 };
    const { tubes, board } = this.#custom
      ? boardOf(this.#custom.puzzle)
      : this.#isDaily()
        ? createDailyPuzzle(localDateKey(this.#puzzleDay))
        : createLevelPuzzle(this.#level);
    const settings = this.#settings();
    const { hiddenColors, undoLimit } = settings;

    this.#session = new GameSession(board, tubes, { hiddenColors, undoLimit });
    this.#lastHint = null;
    this.#watchFewestMoves();
    this.#scene.showPuzzle(this.#session.visibleTubes, {
      sizes: tubes.map((_, index) => board.sizeOf(index)),
      oilColors: [...board.oilColors],
      kinds: tubes.map((_, index) => ({
        oneWay: board.oneWay.has(index),
        lockKey: board.locks.get(index) ?? null,
        fills: board.cracked.get(index) ?? null
      }))
    });
    this.#hud.hideWin();
    this.#menu.hide();
    this.#rules.hide();
    this.#refreshHud();
    this.#introduceNewRules();
  }

  /**
   * Works out the fewest moves of the new puzzle in the background. A puzzle replaced
   * meanwhile drops its answer.
   */
  #watchFewestMoves() {
    const session = this.#session;
    const puzzle = this.#custom
      ? { custom: this.#custom.puzzle }
      : this.#isDaily()
        ? { day: localDateKey(this.#puzzleDay) }
        : { level: this.#level };
    this.#fewestKnown = undefined;
    this.#fewest = this.#findFewestMoves(puzzle);
    this.#fewest.then((fewest) => {
      if (this.#session !== session) return;
      this.#fewestKnown = fewest;
      // The rules dialog may be waiting for it to show the stars.
      if (this.#rules.isShowingInfo) this.showInfo();
    });
  }

  /**
   * On a level that brings in new rules, shows them before the player starts; only until the
   * level is solved, so a replay goes straight to the board. The very first level explains
   * the game.
   */
  #introduceNewRules() {
    if (this.#level === null || this.#level <= this.#progress.solved) return;

    const newRules = this.#level === 1 ? ['basics'] : rulesFirstUsedAt(this.#level);
    if (newRules.length === 0) return;
    this.#rules.show({
      title: texts.newRulesTitle(newRules.length),
      rules: newRules.map((rule) => this.#describeRule(rule)),
      action: texts.gotIt
    });
  }

  /** Shows every rule of the puzzle on the board, the stars it can earn and how it went. */
  showInfo() {
    if (this.#animating) return;

    this.#putSelectionDown();
    const settings = this.#settings();
    const fewest = this.#fewestKnown;
    const attempts =
      this.#level === null ? null : (this.#progress.records[this.#level]?.attempts ?? []);
    const rules = this.#custom ? rulesOf(this.#custom.puzzle) : specialRules(settings);
    this.#rules.show({
      title: this.#title(),
      info: true,
      rules: ['basics', ...rules].map((rule) => this.#describeRule(rule)),
      stars: fewest
        ? [3, 2, 1].map((stars) => ({
            stars,
            text: texts.starRule(stars, fewest.moves, twoStarLimit(fewest.moves))
          }))
        : null,
      starsPending: texts.fewestPending,
      supplies: [
        texts.undoSupply(settings.undoLimit, this.#session.undosLeft),
        ...(settings.undoLimit === null
          ? []
          : [texts.spareUndoSupply(this.#progress.spareUndos, MAX_SPARE_UNDOS)]),
        texts.hintSupply(this.#progress.hints)
      ],
      attempts: attempts && attempts.slice().reverse(),
      action: texts.close
    });
  }

  closeRules() {
    this.#rules.hide();
  }

  #describeRule(rule) {
    return { id: rule, name: texts.ruleName(rule), text: texts.ruleText(rule, this.#settings()) };
  }

  /** @param {number} index */
  async tapTube(index) {
    if (this.#animating) return;
    if (this.#watch) {
      await this.#showNextMove();
      return;
    }
    await this.#handleTap(index);
  }

  async #handleTap(index) {
    const result = this.#session.tap(index);
    switch (result.type) {
      case 'selected':
        this.#scene.setLifted(result.tube, true);
        this.#feedback.pick();
        break;
      case 'deselected':
        this.#scene.setLifted(result.tube, false);
        this.#feedback.putDown();
        break;
      case 'rejected':
        this.#scene.shake(result.tube);
        this.#feedback.reject();
        break;
      case 'blocked':
        this.#scene.setLifted(result.from, false);
        this.#scene.shake(result.to);
        this.#feedback.reject();
        break;
      case 'poured':
        await this.#playPour(result);
        break;
    }
  }

  /**
   * Takes the last move back: the pour plays in reverse, after the cap comes off a tube the
   * move completed. Once the level's undos are used up, the player's spare undos pay.
   */
  undo() {
    const session = this.#session;
    if (this.#animating || !this.#canUndo()) return;
    if (this.#watch) {
      this.#hud.showToast(texts.watchNoUndo);
      return;
    }

    const spare = !session.canUndo;
    this.#putSelectionDown();
    const move = session.undo({ spare });
    if (!move) return;
    if (spare) {
      this.#setProgress(spendSpareUndo(this.#progress));
      this.#hud.showToast(texts.spareUndoUsed(this.#progress.spareUndos));
    }
    this.#feedback.undo();
    this.#refreshHud();

    if (move.onTop) {
      // Caps come off and locks freeze again first; the liquid then flows back.
      this.#scene.showTubeStates(this.#tubeStates());
      this.#scene.pour(move.to, move.from, move.amount, session.visibleTubes);
    } else {
      // Water that sank under oil cannot be seen leaving; the board changes at once.
      this.#scene.showContents(session.visibleTubes);
      this.#scene.showTubeStates(this.#tubeStates());
    }
  }

  restart() {
    if (this.#animating || this.#session.solved) return;
    if (this.#watch) {
      // Leaving the demonstration: the level starts over for the player.
      this.start();
      return;
    }

    this.#session.restart();
    this.#scene.showContents(this.#session.visibleTubes);
    this.#scene.showTubeStates(this.#tubeStates(), { instant: true });
    this.#refreshHud();
  }

  /**
   * Points out the next move of the shortest solution from here. A hint costs one of the
   * player's hints and counts as a move; asking again in the same position shows the same
   * move for free, and a dead end costs nothing.
   */
  showHint() {
    const session = this.#session;
    if (this.#animating || session.solved) return;
    if (this.#watch) {
      this.#hud.showToast(texts.watchNoHint);
      return;
    }

    this.#putSelectionDown();
    let move = this.#lastHint?.position === session.position ? this.#lastHint.move : null;
    // Hints on a puzzle the player made themselves cost nothing.
    const free = this.#custom?.fromEditor === true;
    if (!move) {
      if (!free && this.#progress.hints === 0) {
        this.#hud.showToast(texts.noHints, { long: true });
        return;
      }
      move = session.hint();
      if (!move) {
        const outOfUndos = !this.#canUndo();
        this.#hud.showToast(outOfUndos ? texts.hintDeadEndNoUndo : texts.hintDeadEnd);
        return;
      }
      if (!free) this.#setProgress(spendHint(this.#progress));
      session.countHint();
      this.#lastHint = { position: session.position, move };
      this.#refreshHud();
    }
    const [from, to] = move;
    this.#scene.highlight([from, to]);
    this.#feedback.hint();
    this.#hud.showToast(texts.hintMove(from, to));
  }

  /** Opens the level list over the board; from a puzzle under test, goes back to the editor. */
  showLevels() {
    if (this.#animating) return;
    if (this.#custom?.fromEditor) {
      this.leaveCustom();
      return;
    }

    this.#putSelectionDown();
    this.#menu.show(this.#levelMenuModel());
  }

  closeLevels() {
    this.#menu.hide();
  }

  /** Opens the dialog that carries progress to another device, in place of the level list. */
  showTransfer() {
    if (this.#animating) return;

    this.#menu.hide();
    this.#transfer.show({
      code: encodeProgressCode(this.#progress.solved),
      fullCode: encodeSnapshot(this.#progress, this.#dailyResults.results())
    });
  }

  closeTransfer() {
    this.#transfer.hide();
  }

  /**
   * Takes over the progress in a code, typed into the dialog or opened as a link. Progress only
   * ever moves forward, so an old code or one from a device that is behind changes nothing.
   * @param {string} code
   * @param {{ fromLink?: boolean }} [options] a link has no dialog to show an error in
   */
  importProgress(code, { fromLink = false } = {}) {
    if (this.#animating) return;

    // A link or long code carries everything; a short code only the solved levels.
    const snapshot =
      decodeSnapshot(code) ??
      (() => {
        const solved = decodeProgressCode(code);
        return solved === null
          ? null
          : { solved, hints: null, spareUndos: null, bests: [], dailyDone: null, daily: {} };
      })();
    if (snapshot === null) {
      if (fromLink) this.#hud.showToast(texts.transferInvalid);
      else this.#transfer.showError(texts.transferInvalid);
      return;
    }

    this.#transfer.hide();
    const merged = mergeSnapshot(this.#progress, this.#dailyResults.results(), snapshot);
    if (!merged.changed) {
      this.#hud.showToast(texts.transferUnchanged(this.#progress.solved));
      return;
    }
    this.#dailyResults.merge(merged.daily);
    this.#setProgress(merged.progress);
    this.#custom = null;
    this.start();
    this.#hud.showToast(texts.transferLoaded(merged.progress.solved));
  }

  /** Plays a level picked from the list; levels that are still locked are ignored. */
  playLevel(level) {
    if (this.#animating || level < 1 || level > lastOpenLevel(this.#progress)) return;

    this.#custom = null;
    this.#updateProgress({ mode: 'level', current: level });
    this.start();
  }

  playDaily() {
    if (this.#animating) return;

    this.#custom = null;
    this.#updateProgress({ mode: 'daily' });
    this.start();
  }

  /**
   * Closes the win dialog: on to the next level, back to the levels after the daily or a
   * shared puzzle, or back to the editor after testing a custom one.
   */
  continueAfterWin() {
    const custom = this.#custom;
    this.#custom = null;
    if (this.#isDaily()) this.#updateProgress({ mode: 'level' });
    this.start();
    if (custom?.fromEditor) this.#onEditPuzzle(custom.puzzle);
  }

  /** Plays the puzzle just solved once more, e.g. to try for more stars. */
  replay() {
    if (this.#level !== null) this.#updateProgress({ current: this.#level });
    this.start();
  }

  /**
   * Shows the shortest solution of the level just played, a move at a time: the board starts
   * over and every tap on a tube plays the next move. Nothing of it counts: no stars, no
   * moves in the level's record and no hints spent; the player then plays the level for real.
   */
  async watchSolution() {
    const level = this.#level;
    if (this.#animating || level === null) return;

    this.#hud.showToast(texts.watchPreparing);
    const solution = await this.#findSolution({ level });
    // The player may have gone to another level meanwhile.
    if (this.#level !== level || this.#custom || this.#isDaily()) return;
    if (!solution || solution.length === 0) {
      this.#hud.showToast(texts.watchFailed);
      return;
    }

    this.#updateProgress({ current: level });
    this.start();
    this.#watch = { moves: solution, done: 0, busy: false };
    this.#refreshHud();
    this.#pointAtNextMove();
    this.#hud.showToast(texts.watchTapToStart, { long: true });
  }

  /** Lights up the two tubes of the move that comes next. */
  #pointAtNextMove() {
    const { moves, done } = this.#watch;
    if (done < moves.length) this.#scene.highlight(moves[done]);
  }

  /** Plays the next move of the solution being shown: lifts its tube, then pours. */
  async #showNextMove() {
    const watch = this.#watch;
    if (watch.busy || watch.done >= watch.moves.length) return;

    const [from, to] = watch.moves[watch.done];
    watch.busy = true;
    try {
      await this.#handleTap(from);
      await new Promise((resolve) => setTimeout(resolve, WATCH_LIFT_MS));
      // The player may have left the demonstration meanwhile.
      if (this.#watch !== watch) return;
      watch.done++;
      await this.#handleTap(to);
      if (this.#watch !== watch) return;
      this.#pointAtNextMove();
    } finally {
      watch.busy = false;
    }
  }

  /** The solution being shown reached its end: the player gets the level to play for real. */
  async #endWatch() {
    await this.#scene.celebrate();
    this.start();
    this.#hud.showToast(texts.watchDone, { long: true });
  }

  /**
   * Plays a custom puzzle: one being made in the editor, or one shared by link.
   * @param {import('../game/customPuzzle.js').CustomPuzzle} puzzle
   * @param {{ fromEditor?: boolean }} [options]
   */
  playCustom(puzzle, { fromEditor = false } = {}) {
    if (this.#animating) return;

    this.#custom = { puzzle, fromEditor };
    this.start();
  }

  /** Leaves a custom puzzle for the editor it came from, or for the levels. */
  leaveCustom() {
    if (this.#animating || !this.#custom) return;
    this.continueAfterWin();
  }

  /** Moves on as after a win, but lets the player pick from the level list first. */
  continueToLevels() {
    this.continueAfterWin();
    this.showLevels();
  }

  /**
   * Plays a pour. The player can go on with the next move meanwhile; the scene sorts out
   * pours that overlap. Only the win celebration holds input back.
   */
  async #playPour({ from, to, amount, solved, unlocked }) {
    const session = this.#session;
    if (solved) this.#animating = true;
    this.#refreshHud();
    try {
      const poured = this.#scene.pour(from, to, amount, session.visibleTubes);
      // A cracked tube's fill is used up at once. The cap of a tube the pour completed goes
      // on once the liquid has landed (the scene waits for the pour), and a lock opens then.
      this.#scene.showTubeStates(this.#tubeStates(unlocked));
      await poured;
      // Undo, restart or another level may have replaced the board meanwhile.
      if (this.#session !== session) return;
      if (unlocked.length > 0) this.#scene.showTubeStates(this.#tubeStates());
      if (solved) await (this.#watch ? this.#endWatch() : this.#celebrateWin());
    } finally {
      if (solved) this.#animating = false;
    }
  }

  /**
   * Fills left, locks and caps, per tube.
   * @param {number[]} [stillLocked] tubes to show locked although they just opened
   */
  #tubeStates(stillLocked = []) {
    const session = this.#session;
    return session.tubes.map((tube, index) => ({
      fills: session.fills[index],
      locked: session.isLocked(index) || stillLocked.includes(index),
      capped: session.board.isComplete(tube)
    }));
  }

  /**
   * Saves the solution at once, then rates it against the fewest moves while the tubes
   * celebrate, and shows how it went.
   */
  async #celebrateWin() {
    const moves = this.#session.moveCount;
    const notes = [];
    if (this.#level !== null) {
      const opened = this.#recordSolvedLevel(this.#level);
      if (opened) notes.push(texts.stageOpened(opened));
    }

    this.#feedback.win();
    const [fewest] = await Promise.all([this.#fewest, this.#scene.celebrate()]);
    const fewestMoves = fewest?.moves ?? moves;
    const stars = starsFor(moves, fewestMoves);
    let attempts = null;
    let shareText = null;
    let offerWatch = false;
    if (this.#isDaily()) {
      const day = localDateKey(this.#puzzleDay);
      const { progress, earnedHint } = recordDailyWin(this.#progress, day);
      this.#setProgress(progress);
      if (earnedHint) notes.push(texts.earnedHint);
      // The clock runs from when the puzzle was opened; a restart does not reset it.
      const seconds = Math.max(1, Math.round((this.#now().getTime() - this.#startedAt) / 1000));
      this.#onDailySolved(day, { moves, seconds, stars });
      const { streak } = this.#getDailySummary(this.#puzzleDay);
      if (streak >= 2) notes.push(texts.dailyStreakNote(streak));
      shareText = texts.shareDailyText(this.#puzzleDay, stars, moves, seconds, streak);
    } else if (this.#level !== null) {
      const { progress, earnedUndo } = recordLevelWin(
        this.#progress,
        this.#level,
        { moves, stars },
        { limitedUndo: this.#settings().undoLimit !== null }
      );
      this.#setProgress(progress);
      if (earnedUndo) notes.push(texts.earnedUndo);
      attempts = progress.records[this.#level].attempts.slice().reverse();
      shareText = texts.shareLevelText(this.#level, stars, moves, fewestMoves);
      const count = stars === MAX_STARS ? 0 : this.#tries.count + 1;
      this.#tries = { level: this.#level, count };
      offerWatch = count >= WATCH_AFTER_SOLVES && progress.records[this.#level].best < MAX_STARS;
      // Work the solution out while the player reads the result.
      if (offerWatch) this.#findSolution({ level: this.#level });
    }
    this.#refreshHud();

    this.#hud.showWin({
      title: texts.winTitle(stars),
      stars,
      moves,
      fewest: fewestMoves,
      fewestLabel: texts.fewestMoves(fewest?.proven ?? true),
      notes,
      attempts,
      continueLabel: this.#custom?.fromEditor
        ? texts.backToEditor
        : this.#level === null
          ? texts.backToLevels
          : texts.nextLevel,
      leaderboard: this.#isDaily() && this.#leaderboardOnline,
      watch: offerWatch,
      shareText
    });
  }

  /**
   * Saves a solved level.
   * @returns {string | null} the stage the solution opened, if any
   */
  #recordSolvedLevel(level) {
    const firstSolve = level > this.#progress.solved;
    this.#updateProgress({ solved: Math.max(this.#progress.solved, level), current: level + 1 });

    const next = level + 1;
    const opensStage =
      firstSolve && (STAGE_STARTS.includes(next) || next === STAGE_LEVEL_COUNT + 1);
    return opensStage ? stageOfLevel(next).id : null;
  }

  /** Whether an undo is possible: within the level's limit, or with a spare undo. */
  #canUndo() {
    const session = this.#session;
    return session.canUndo || (session.hasMoves && this.#spareUndos() > 0);
  }

  /** Spare undos the puzzle on the board can use: on numbered levels with a limit only. */
  #spareUndos() {
    return this.#level !== null && this.#session.undosLeft !== null ? this.#progress.spareUndos : 0;
  }

  #levelMenuModel() {
    const { dailyDone } = this.#progress;
    const today = this.#now();
    const dailySolved = dailyDone === localDateKey(today);

    const chapters = STAGES.map((stage, index) => {
      const count = levelCountOf(stage);
      const levels = this.#levelTiles(STAGE_STARTS[index], count);
      return {
        id: stage.id,
        name: texts.stageName(stage.id),
        detail: texts.stageDetail(stage.id, stage.undoLimit),
        progress: texts.chapterProgress(countSolved(levels), count),
        // Two stages to a bar, so the meter fills up toward the end.
        difficulty: Math.min(4, Math.ceil((index + 1) / 2)),
        levels
      };
    });

    // The master levels never end, so the list shows them a block at a time: up to the end of
    // the block holding the furthest open level, and at least the first block.
    const openMasterLevels = lastOpenLevel(this.#progress) - STAGE_LEVEL_COUNT;
    const shownBlocks = Math.max(1, Math.ceil(openMasterLevels / MASTER_BLOCK));
    const masterLevels = this.#levelTiles(STAGE_LEVEL_COUNT + 1, shownBlocks * MASTER_BLOCK);
    chapters.push({
      id: MASTER_STAGE.id,
      name: texts.stageName(MASTER_STAGE.id),
      detail: texts.stageDetail(MASTER_STAGE.id, MASTER_STAGE.undoLimit),
      progress: texts.masterProgress(countSolved(masterLevels)),
      difficulty: 4,
      levels: masterLevels
    });

    return {
      editor: {
        title: texts.editorCardTitle,
        text: texts.editorCardText,
        action: texts.editorCardAction
      },
      daily: {
        title: texts.dailyCardTitle,
        date: texts.dailyCardDate(today),
        action: texts.dailyCardAction(dailySolved),
        solved: dailySolved,
        playing: this.#isDaily(),
        ...this.#dailyCardStats(today)
      },
      chapters
    };
  }

  /** Today's result and the streak, as the daily puzzle's card shows them. */
  #dailyCardStats(today) {
    const summary = this.#getDailySummary(today);
    return {
      result: summary.today
        ? {
            text: texts.dailyResult(summary.today.moves, summary.today.seconds),
            stars: summary.today.stars
          }
        : null,
      streak: summary.streak > 0 ? texts.dailyStreak(summary.streak) : null
    };
  }

  /** Tiles for `count` levels starting at `first`. */
  #levelTiles(first, count) {
    const { solved, records } = this.#progress;
    const lastOpen = lastOpenLevel(this.#progress);
    return Array.from({ length: count }, (_, i) => {
      const level = first + i;
      const state = level <= solved ? 'solved' : level <= lastOpen ? 'open' : 'locked';
      const stars = records[level]?.best ?? 0;
      return {
        level,
        state,
        stars,
        playing: level === this.#level,
        label: texts.levelTileLabel(level, state, stars)
      };
    });
  }

  #putSelectionDown() {
    const result = this.#session.deselect();
    if (result.type === 'deselected') this.#scene.setLifted(result.tube, false);
  }

  #updateProgress(changes) {
    this.#setProgress({ ...this.#progress, ...changes });
  }

  #setProgress(progress) {
    this.#progress = progress;
    this.#saveProgress(progress);
  }

  #isDaily() {
    return !this.#custom && this.#progress.mode === 'daily';
  }

  /** How the puzzle on the board is played. */
  #settings() {
    if (this.#custom) {
      const { hidden, undoLimit, capacity } = this.#custom.puzzle;
      return { hiddenColors: hidden, undoLimit, capacity };
    }
    return this.#isDaily() ? DAILY_SETTINGS : levelSettings(this.#level);
  }

  /** The stage, then the rules the level adds to the stage's own, then the moves. */
  #levelSubtitle(moveCount) {
    const stage = stageOfLevel(this.#level);
    const extras = specialRules(this.#settings()).filter((rule) => rule !== stage.rule);
    return texts.levelSubtitle(stage.id, extras, moveCount);
  }

  #title() {
    if (this.#custom) return texts.customTitle(this.#custom.fromEditor);
    return this.#isDaily()
      ? texts.dailyTitle(
          this.#puzzleDay,
          this.#progress.dailyDone === localDateKey(this.#puzzleDay)
        )
      : texts.levelTitle(this.#level);
  }

  #refreshHud() {
    const session = this.#session;
    const { hints } = this.#progress;
    const spare = this.#spareUndos();
    this.#hud.render({
      title: this.#title(),
      subtitle: this.#watch
        ? texts.watchStep(this.#watch.done, this.#watch.moves.length)
        : this.#custom
          ? texts.customSubtitle(rulesOf(this.#custom.puzzle), session.moveCount)
          : this.#isDaily()
            ? texts.moves(session.moveCount)
            : this.#levelSubtitle(session.moveCount),
      canUndo: this.#canUndo(),
      undoCount: texts.undoCount(session.undosLeft, spare),
      undoLabel: texts.undoLabel(session.undosLeft, spare),
      hintCount: String(hints),
      hintLabel: texts.hintLabel(hints),
      levelsLabel: this.#custom?.fromEditor ? texts.editorButton : texts.levelsButton
    });
  }
}

/** How many master levels the level list adds at a time. */
const MASTER_BLOCK = 10;

function countSolved(levels) {
  return levels.filter((level) => level.state === 'solved').length;
}

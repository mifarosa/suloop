import {
  CHAPTER_LEVEL_COUNT,
  chapterIdOfLevel,
  CHAPTERS,
  createDailyPuzzle,
  createLevelPuzzle,
  DAILY_SETTINGS,
  isMasterLevel,
  levelSettings,
  LEVELS_PER_CHAPTER,
  rulesFirstUsedAt,
  specialRules
} from '../game/levels.js';
import { GameSession } from '../game/session.js';
import { localDateKey } from './calendar.js';
import { lastOpenLevel } from './progress.js';
import { decodeProgressCode, encodeProgressCode } from './progressCode.js';
import { texts } from './texts.js';

/**
 * Runs the game: applies the player's actions to the session, plays the matching
 * animations, keeps the HUD and the level list up to date and saves progress.
 */
export class GameController {
  #scene;
  #hud;
  #menu;
  #transfer;
  #progress;
  #saveProgress;
  #now;
  /** @type {GameSession} */
  #session;
  /** The numbered level on the board; null while the daily puzzle is played. */
  #level = null;
  /** The calendar day of the daily puzzle being played. */
  #puzzleDay;
  /** Set while the win celebration plays; input waits until it is over. Pours do not block. */
  #animating = false;

  /**
   * @param {object} deps
   * @param {import('../scene/tubeScene.js').TubeScene} deps.scene
   * @param {import('./hud.js').Hud} deps.hud
   * @param {import('./levelMenu.js').LevelMenu} deps.menu
   * @param {import('./transferDialog.js').TransferDialog} deps.transfer
   * @param {import('./progress.js').Progress} deps.progress
   * @param {(progress: import('./progress.js').Progress) => void} deps.saveProgress
   * @param {() => Date} [deps.now]
   */
  constructor({ scene, hud, menu, transfer, progress, saveProgress, now = () => new Date() }) {
    this.#scene = scene;
    this.#hud = hud;
    this.#menu = menu;
    this.#transfer = transfer;
    this.#progress = { ...progress };
    this.#saveProgress = saveProgress;
    this.#now = now;
  }

  /** Starts the puzzle for the current mode: today's daily puzzle or the current level. */
  start() {
    this.#puzzleDay = this.#now();
    this.#level = this.#isDaily() ? null : this.#progress.current;
    const { tubes, board } = this.#isDaily()
      ? createDailyPuzzle(localDateKey(this.#puzzleDay))
      : createLevelPuzzle(this.#level);
    const settings = this.#settings();
    const { hiddenColors, undoLimit } = settings;

    this.#session = new GameSession(board, tubes, { hiddenColors, undoLimit });
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
    this.#refreshHud();

    const newRules = this.#isDaily() ? [] : rulesFirstUsedAt(this.#level);
    if (newRules.length > 0) {
      const intro = newRules.map((rule) => texts.ruleIntro(rule, settings)).join(' ');
      this.#hud.showToast(intro, { long: true });
    }
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
    this.#showBoard();
    this.#refreshHud();
  }

  restart() {
    if (this.#animating || this.#session.solved) return;

    this.#session.restart();
    this.#showBoard();
    this.#refreshHud();
  }

  showHint() {
    if (this.#animating || this.#session.solved) return;

    this.#putSelectionDown();
    const move = this.#session.hint();
    if (!move) {
      const outOfUndos = this.#session.undosLeft === 0;
      this.#hud.showToast(outOfUndos ? texts.hintDeadEndNoUndo : texts.hintDeadEnd);
      return;
    }
    const [from, to] = move;
    this.#scene.highlight([from, to]);
    this.#hud.showToast(texts.hintMove(from, to));
  }

  /** Opens the level list over the board. */
  showLevels() {
    if (this.#animating) return;

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
    this.#transfer.show({ code: encodeProgressCode(this.#progress.solved) });
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

    const solved = decodeProgressCode(code);
    if (solved === null) {
      if (fromLink) this.#hud.showToast(texts.transferInvalid);
      else this.#transfer.showError(texts.transferInvalid);
      return;
    }

    this.#transfer.hide();
    if (solved <= this.#progress.solved) {
      this.#hud.showToast(texts.transferUnchanged(this.#progress.solved));
      return;
    }
    this.#updateProgress({ mode: 'level', solved, current: solved + 1 });
    this.start();
    this.#hud.showToast(texts.transferLoaded(solved));
  }

  /** Plays a level picked from the list; levels that are still locked are ignored. */
  playLevel(level) {
    if (this.#animating || level < 1 || level > lastOpenLevel(this.#progress)) return;

    this.#updateProgress({ mode: 'level', current: level });
    this.start();
  }

  playDaily() {
    if (this.#animating) return;

    this.#updateProgress({ mode: 'daily' });
    this.start();
  }

  /** Closes the win dialog: on to the next level, or back to the levels after the daily puzzle. */
  continueAfterWin() {
    if (this.#isDaily()) this.#updateProgress({ mode: 'level' });
    this.start();
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
  async #playPour({ from, to, amount, filled, solved, unlocked }) {
    const session = this.#session;
    if (solved) this.#animating = true;
    this.#refreshHud();
    // A cracked tube's fill is used up at once; a lock opens once the liquid has landed.
    this.#scene.showTubeStates(this.#tubeStates(unlocked));
    try {
      await this.#scene.pour(from, to, amount, session.visibleTubes);
      // Undo, restart or another level may have replaced the board meanwhile.
      if (this.#session !== session) return;
      if (unlocked.length > 0) this.#scene.showTubeStates(this.#tubeStates());
      if (filled) this.#scene.hop(to);
      if (solved) await this.#celebrateWin();
    } finally {
      if (solved) this.#animating = false;
    }
  }

  /** Shows the board as the session has it, at once, e.g. after an undo. */
  #showBoard() {
    this.#scene.showContents(this.#session.visibleTubes);
    this.#scene.showTubeStates(this.#tubeStates());
  }

  /**
   * Fills left and locks, per tube.
   * @param {number[]} [stillLocked] tubes to show locked although they just opened
   */
  #tubeStates(stillLocked = []) {
    const session = this.#session;
    return session.tubes.map((_, index) => ({
      fills: session.fills[index],
      locked: session.isLocked(index) || stillLocked.includes(index)
    }));
  }

  async #celebrateWin() {
    const solvedIn = texts.solvedIn(this.#session.moveCount);
    let win;
    if (this.#isDaily()) {
      this.#updateProgress({ dailyDone: localDateKey(this.#puzzleDay) });
      win = { message: solvedIn, continueLabel: texts.backToLevels };
    } else {
      win = this.#recordSolvedLevel(this.#level, solvedIn);
    }

    await this.#scene.celebrate();
    this.#hud.showWin(win);
  }

  /** Saves a solved level and says what it opened up. */
  #recordSolvedLevel(level, solvedIn) {
    const firstSolve = level > this.#progress.solved;
    this.#updateProgress({ solved: Math.max(this.#progress.solved, level), current: level + 1 });

    // Master levels run on without chapters, so only the chapters announce what comes next.
    const opensChapter = firstSolve && !isMasterLevel(level) && level % LEVELS_PER_CHAPTER === 0;
    return {
      message: opensChapter
        ? `${solvedIn} ${texts.chapterOpened(chapterIdOfLevel(level + 1))}`
        : solvedIn,
      continueLabel: texts.nextLevel
    };
  }

  #levelMenuModel() {
    const { dailyDone } = this.#progress;
    const today = this.#now();
    const dailySolved = dailyDone === localDateKey(today);

    const chapters = CHAPTERS.map((chapter, index) => {
      const levels = this.#levelTiles(index * LEVELS_PER_CHAPTER + 1, LEVELS_PER_CHAPTER);
      return {
        id: chapter.id,
        name: texts.chapterName(chapter.id),
        detail: texts.chapterDetail(chapter),
        progress: texts.chapterProgress(countSolved(levels), LEVELS_PER_CHAPTER),
        difficulty: index + 1,
        levels
      };
    });

    // The master levels never end, so the list shows them a block at a time: up to the end of
    // the block holding the furthest open level, and at least the first block.
    const openMasterLevels = lastOpenLevel(this.#progress) - CHAPTER_LEVEL_COUNT;
    const shownBlocks = Math.max(1, Math.ceil(openMasterLevels / LEVELS_PER_CHAPTER));
    const masterLevels = this.#levelTiles(
      CHAPTER_LEVEL_COUNT + 1,
      shownBlocks * LEVELS_PER_CHAPTER
    );
    chapters.push({
      id: 'master',
      name: texts.chapterName('master'),
      detail: texts.masterDetail,
      progress: texts.masterProgress(countSolved(masterLevels)),
      difficulty: CHAPTERS.length,
      levels: masterLevels
    });

    return {
      daily: {
        title: texts.dailyCardTitle,
        date: texts.dailyCardDate(today),
        action: texts.dailyCardAction(dailySolved),
        solved: dailySolved,
        playing: this.#isDaily()
      },
      chapters
    };
  }

  /** Tiles for `count` levels starting at `first`. */
  #levelTiles(first, count) {
    const { solved } = this.#progress;
    const lastOpen = lastOpenLevel(this.#progress);
    return Array.from({ length: count }, (_, i) => {
      const level = first + i;
      const state = level <= solved ? 'solved' : level <= lastOpen ? 'open' : 'locked';
      return {
        level,
        state,
        playing: level === this.#level,
        label: texts.levelTileLabel(level, state)
      };
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

  /** How the puzzle on the board is played. */
  #settings() {
    return this.#isDaily() ? DAILY_SETTINGS : levelSettings(this.#level);
  }

  #refreshHud() {
    const moveCount = this.#session.moveCount;
    const daily = this.#isDaily();
    this.#hud.render({
      title: daily
        ? texts.dailyTitle(
            this.#puzzleDay,
            this.#progress.dailyDone === localDateKey(this.#puzzleDay)
          )
        : texts.levelTitle(this.#level),
      subtitle: daily
        ? texts.moves(moveCount)
        : texts.levelSubtitle(
            chapterIdOfLevel(this.#level),
            specialRules(this.#settings()),
            moveCount
          ),
      canUndo: this.#session.canUndo,
      undoLabel: texts.undo(this.#session.undosLeft)
    });
  }
}

function countSolved(levels) {
  return levels.filter((level) => level.state === 'solved').length;
}

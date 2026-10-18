import { HIDDEN } from './rules.js';
import { solveShortest } from './shortest.js';
import { solve } from './solver.js';

// Hints run while the player waits. They look for the shortest way on first, so following
// them earns every star; a position too tangled for that gets any way out instead.
const HINT_SHORTEST_LIMIT = 40_000;
const HINT_SEARCH_LIMIT = 150_000;

/**
 * @typedef {(
 *   | { type: 'ignored' }
 *   | { type: 'selected', tube: number }
 *   | { type: 'deselected', tube: number }
 *   | { type: 'rejected', tube: number }
 *   | { type: 'blocked', from: number, to: number }
 *   | { type: 'poured', from: number, to: number, amount: number, filled: boolean,
 *       solved: boolean, unlocked: number[] }
 * )} TapResult
 * - `rejected`: the tube cannot be picked up: it is empty, complete, one-way or locked.
 * - `blocked`: the selected tube cannot be poured into the tapped one; the selection is dropped.
 * - `filled`: the pour completed the target tube.
 * - `unlocked`: locked tubes the pour opened.
 */

/**
 * A move as the history keeps it: the position before it, and the pour.
 * @typedef {object} Move
 * @property {import('./rules.js').Position} before
 * @property {number} from
 * @property {number} to
 * @property {number} amount
 * @property {boolean} onTop whether the poured units ended up on top of the target, so they
 *   can be seen going back on an undo; water that sank under oil did not
 */

/**
 * One play-through of a puzzle: the board, the selected tube and the move history.
 * It holds no UI; every action reports what changed so the caller can animate it.
 *
 * With hidden colors only the top unit of each tube shows at first. A unit below shows once
 * everything above it has been poured off, and stays shown: undo and restart do not hide
 * again what the player has seen. Oil, floating on top, always shows; only water hides, so
 * water poured under oil always lands above the hidden units. The rules and the hints always
 * use the real colors.
 *
 * With an undo limit the player may take back only that many moves; a restart gives them
 * all back.
 *
 * A hint counts as a move: it adds one to the move count, so a solution found with help
 * earns fewer stars. An undo does not take it back; a restart starts the count afresh.
 */
export class GameSession {
  /**
   * @param {import('./rules.js').Board} board the rules of the board
   * @param {number[][]} initialTubes
   * @param {{ hiddenColors?: boolean, undoLimit?: number | null }} [options] undoLimit: null
   *   for no limit
   */
  constructor(board, initialTubes, { hiddenColors = false, undoLimit = null } = {}) {
    this.board = board;
    this.initialTubes = initialTubes.map((tube) => tube.slice());
    this.undoLimit = undoLimit;
    /**
     * Per tube, how many units at the bottom are still hidden. The units there never move
     * while hidden, since a unit has to be on top to be poured, so the count only shrinks.
     */
    this.hiddenCounts = initialTubes.map((tube) =>
      hiddenColors ? Math.min(Math.max(0, tube.length - 1), board.waterCount(tube)) : 0
    );
    this.restart();
  }

  /** @returns {number[][]} */
  get tubes() {
    return this.position.tubes;
  }

  /** How many more times each cracked tube can be poured into; null for other tubes. */
  get fills() {
    return this.position.fills;
  }

  /** Whether the tube at `index` is locked right now. */
  isLocked(index) {
    return this.board.isLocked(this.position, index);
  }

  /** The board as the player sees it: hidden units are HIDDEN. */
  get visibleTubes() {
    return this.tubes.map((tube, index) =>
      tube.map((color, slot) => (slot < this.hiddenCounts[index] ? HIDDEN : color))
    );
  }

  /** Moves made, plus one for each hint taken. */
  get moveCount() {
    return this.history.length + this.hintsTaken;
  }

  /** The moves played so far, as [from, to] pairs, the ones taken back left out. */
  moveLog() {
    return this.history.map(({ from, to }) => [from, to]);
  }

  /** How many hints the player was given. */
  get hints() {
    return this.hintsTaken;
  }

  /** Counts a hint the player was given as a move. */
  countHint() {
    this.hintsTaken++;
  }

  /** Whether there is a move to take back, whatever the undo limit says. */
  get hasMoves() {
    return this.history.length > 0 && !this.solved;
  }

  /** Whether the undo limit still allows taking a move back. */
  get canUndo() {
    return this.hasMoves && this.undosLeft !== 0;
  }

  restart() {
    this.position = this.board.start(this.initialTubes);
    /** @type {Move[]} */
    this.history = [];
    /** @type {number | null} */
    this.selected = null;
    this.solved = false;
    /** @type {number | null} null when undo has no limit */
    this.undosLeft = this.undoLimit;
    this.hintsTaken = 0;
  }

  /**
   * The first tap picks a tube up; the second pours it into the tapped tube.
   * @param {number} index
   * @returns {TapResult}
   */
  tap(index) {
    if (this.solved) return { type: 'ignored' };
    if (this.selected === null) return this.#pickUp(index);
    if (this.selected === index) return this.deselect();
    return this.#pourSelectedInto(index);
  }

  /** @returns {TapResult} */
  deselect() {
    if (this.selected === null) return { type: 'ignored' };

    const tube = this.selected;
    this.selected = null;
    return { type: 'deselected', tube };
  }

  /**
   * Takes the last move back.
   * @param {{ spare?: boolean }} [options] spare: the player pays with a spare undo of their
   *   own, which works even when the limit of the level is used up and leaves it as it is
   * @returns {Move | null} the move taken back, or null when there was none to take back
   */
  undo({ spare = false } = {}) {
    if (spare ? !this.hasMoves : !this.canUndo) return null;

    this.selected = null;
    const move = this.history.pop();
    this.position = move.before;
    if (!spare && this.undosLeft !== null) this.undosLeft--;
    return move;
  }

  /**
   * The next move of a solution from the current position, of the shortest one when it can
   * be found quickly.
   * @returns {[number, number] | null} null when the position is a dead end
   */
  hint() {
    const { position, board } = this;
    const solution =
      solveShortest(position, { board, maxNodes: HINT_SHORTEST_LIMIT }) ??
      solve(position, { board, maxNodes: HINT_SEARCH_LIMIT });
    return solution && solution.length > 0 ? solution[0] : null;
  }

  #pickUp(index) {
    if (!this.board.canPourFrom(this.position, index)) return { type: 'rejected', tube: index };

    this.selected = index;
    return { type: 'selected', tube: index };
  }

  #pourSelectedInto(to) {
    const from = this.selected;
    this.selected = null;

    const { position, amount } = this.board.pour(this.position, from, to);
    if (amount === 0) return { type: 'blocked', from, to };

    const lockedBefore = this.#lockedTubes();
    const onTop =
      this.board.isOil(this.tubes[from].at(-1)) || !this.board.isOil(this.tubes[to].at(-1));
    this.history.push({ before: this.position, from, to, amount, onTop });
    this.position = position;
    this.solved = this.board.isSolved(position);
    const filled = this.board.isComplete(this.tubes[to]);
    this.#reveal(from, to, filled);
    const unlocked = lockedBefore.filter((index) => !this.isLocked(index));
    return { type: 'poured', from, to, amount, filled, solved: this.solved, unlocked };
  }

  #lockedTubes() {
    return [...this.board.locks.keys()].filter((index) => this.isLocked(index));
  }

  /** Shows the new top of the source, and all of a target the pour completed. */
  #reveal(from, to, filled) {
    const source = this.tubes[from];
    this.hiddenCounts[from] = Math.min(this.hiddenCounts[from], Math.max(0, source.length - 1));
    if (filled) this.hiddenCounts[to] = 0;
  }
}

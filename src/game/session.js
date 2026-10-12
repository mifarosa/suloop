import { HIDDEN } from './rules.js';
import { solve } from './solver.js';

// Hints run while the player waits, so they search less than level generation does.
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

  get moveCount() {
    return this.history.length;
  }

  get canUndo() {
    return this.history.length > 0 && !this.solved && this.undosLeft !== 0;
  }

  restart() {
    this.position = this.board.start(this.initialTubes);
    this.history = [];
    /** @type {number | null} */
    this.selected = null;
    this.solved = false;
    /** @type {number | null} null when undo has no limit */
    this.undosLeft = this.undoLimit;
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

  /** @returns {boolean} whether a move was undone */
  undo() {
    if (!this.canUndo) return false;

    this.selected = null;
    this.position = this.history.pop();
    if (this.undosLeft !== null) this.undosLeft--;
    return true;
  }

  /**
   * The next move of a solution from the current position.
   * @returns {[number, number] | null} null when the position is a dead end
   */
  hint() {
    const solution = solve(this.position, { board: this.board, maxNodes: HINT_SEARCH_LIMIT });
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
    this.history.push(this.position);
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

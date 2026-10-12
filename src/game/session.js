import {
  applyPour,
  cloneTubes,
  HIDDEN,
  isSolved,
  isTubeComplete,
  pourAmount,
  TUBE_CAPACITY
} from './rules.js';
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
 *   | { type: 'poured', from: number, to: number, amount: number, filled: boolean, solved: boolean }
 * )} TapResult
 * - `rejected`: an empty or complete tube cannot be picked up.
 * - `blocked`: the selected tube cannot be poured into the tapped one; the selection is dropped.
 * - `filled`: the pour completed the target tube.
 */

/**
 * One play-through of a puzzle: the board, the selected tube and the move history.
 * It holds no UI; every action reports what changed so the caller can animate it.
 *
 * With hidden colors only the top unit of each tube shows at first. A unit below shows once
 * everything above it has been poured off, and stays shown: undo and restart do not hide
 * again what the player has seen. The rules and the hints always use the real colors.
 */
export class GameSession {
  /**
   * @param {number[][]} initialTubes
   * @param {{ capacity?: number, hiddenColors?: boolean }} [options]
   */
  constructor(initialTubes, { capacity = TUBE_CAPACITY, hiddenColors = false } = {}) {
    this.initialTubes = cloneTubes(initialTubes);
    this.capacity = capacity;
    /**
     * Per tube, how many units at the bottom are still hidden. The units there never move
     * while hidden, since a unit has to be on top to be poured, so the count only shrinks.
     */
    this.hiddenCounts = initialTubes.map((tube) =>
      hiddenColors ? Math.max(0, tube.length - 1) : 0
    );
    this.restart();
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
    return this.history.length > 0 && !this.solved;
  }

  restart() {
    this.tubes = cloneTubes(this.initialTubes);
    this.history = [];
    /** @type {number | null} */
    this.selected = null;
    this.solved = false;
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
    this.tubes = this.history.pop();
    return true;
  }

  /**
   * The next move of a solution from the current position.
   * @returns {[number, number] | null} null when the position is a dead end
   */
  hint() {
    const solution = solve(this.tubes, { capacity: this.capacity, maxNodes: HINT_SEARCH_LIMIT });
    return solution && solution.length > 0 ? solution[0] : null;
  }

  #pickUp(index) {
    const tube = this.tubes[index];
    if (tube.length === 0 || isTubeComplete(tube, this.capacity)) {
      return { type: 'rejected', tube: index };
    }

    this.selected = index;
    return { type: 'selected', tube: index };
  }

  #pourSelectedInto(to) {
    const from = this.selected;
    this.selected = null;

    const amount = pourAmount(this.tubes, from, to, this.capacity);
    if (amount === 0) return { type: 'blocked', from, to };

    this.history.push(this.tubes);
    this.tubes = applyPour(this.tubes, from, to, this.capacity).tubes;
    this.solved = isSolved(this.tubes, this.capacity);
    const filled = isTubeComplete(this.tubes[to], this.capacity);
    this.#reveal(from, to, filled);
    return { type: 'poured', from, to, amount, filled, solved: this.solved };
  }

  /** Shows the new top of the source, and all of a target the pour completed. */
  #reveal(from, to, filled) {
    const source = this.tubes[from];
    this.hiddenCounts[from] = Math.min(this.hiddenCounts[from], Math.max(0, source.length - 1));
    if (filled) this.hiddenCounts[to] = 0;
  }
}

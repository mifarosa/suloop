/**
 * The rules of the puzzle.
 *
 * A tube is an array of color ids listed bottom to top; `tubes` is the whole board.
 * Liquid can be poured onto an empty tube or onto the same color, and a pour moves the
 * whole same-colored run from the top of the source, as far as the target has room.
 *
 * A board has `capacity` units of each color, and a full-size tube holds exactly that many.
 * Some boards add half tubes that hold fewer. Functions that need each tube's size take
 * `sizes`: one number for every tube, or a list with one number per tube.
 * All functions are pure: they never change the arrays they receive.
 */

/** Units of each color, and what a full-size tube holds; tall tubes hold more. */
export const TUBE_CAPACITY = 4;
export const TALL_TUBE_CAPACITY = 5;
/** Units a half tube holds. It can never hold a whole color, so it ends up empty. */
export const HALF_TUBE_SIZE = 2;

/** Stands for a unit the player has not seen yet, in the board as it is shown. */
export const HIDDEN = -1;

/** @param {number[][]} tubes */
export function cloneTubes(tubes) {
  return tubes.map((tube) => tube.slice());
}

/** @param {number[]} tube */
function topColor(tube) {
  return tube[tube.length - 1];
}

/**
 * The same-colored run at the top of a tube.
 * @param {number[]} tube
 * @returns {{ color: number | null, count: number }}
 */
export function topRun(tube) {
  if (tube.length === 0) return { color: null, count: 0 };

  const color = topColor(tube);
  let count = 0;
  for (let i = tube.length - 1; i >= 0 && tube[i] === color; i--) count++;
  return { color, count };
}

/**
 * How many units the tube at `index` holds.
 * @param {number | number[]} sizes
 * @param {number} index
 */
export function sizeOf(sizes, index) {
  return typeof sizes === 'number' ? sizes : sizes[index];
}

/** A tube is complete when it holds every unit of a single color. */
export function isTubeComplete(tube, capacity = TUBE_CAPACITY) {
  return tube.length === capacity && tube.every((color) => color === tube[0]);
}

/** The puzzle is solved when every tube is either empty or complete. */
export function isSolved(tubes, capacity = TUBE_CAPACITY) {
  return tubes.every((tube) => tube.length === 0 || isTubeComplete(tube, capacity));
}

/**
 * @param {number[][]} tubes
 * @param {number} from index of the source tube
 * @param {number} to index of the target tube
 * @param {number | number[]} [sizes] units each tube holds
 */
export function canPour(tubes, from, to, sizes = TUBE_CAPACITY) {
  if (from === to) return false;

  const source = tubes[from];
  const target = tubes[to];
  if (!source || !target) return false;
  if (source.length === 0 || target.length >= sizeOf(sizes, to)) return false;
  return target.length === 0 || topColor(target) === topColor(source);
}

/** How many units a pour would move; 0 when the pour is not allowed. */
export function pourAmount(tubes, from, to, sizes = TUBE_CAPACITY) {
  if (!canPour(tubes, from, to, sizes)) return 0;
  return Math.min(topRun(tubes[from]).count, sizeOf(sizes, to) - tubes[to].length);
}

/**
 * Pours from one tube into another.
 * @returns {{ tubes: number[][], amount: number }} the new board and the number of units moved;
 *   the original board is returned unchanged when the pour is not allowed.
 */
export function applyPour(tubes, from, to, sizes = TUBE_CAPACITY) {
  const amount = pourAmount(tubes, from, to, sizes);
  if (amount === 0) return { tubes, amount };

  const next = cloneTubes(tubes);
  for (let i = 0; i < amount; i++) next[to].push(next[from].pop());
  return { tubes: next, amount };
}

/**
 * The rules of the puzzle.
 *
 * A tube is an array of color ids listed bottom to top; `tubes` is the whole board.
 * Liquid can be poured onto an empty tube or onto the same color, and a pour moves the
 * whole same-colored run from the top of the source, as far as the target has room.
 * All functions are pure: they never change the arrays they receive.
 */

export const TUBE_CAPACITY = 4;

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

/** A tube is complete when it is full and holds a single color. */
export function isTubeComplete(tube) {
  return tube.length === TUBE_CAPACITY && tube.every((color) => color === tube[0]);
}

/** The puzzle is solved when every tube is either empty or complete. */
export function isSolved(tubes) {
  return tubes.every((tube) => tube.length === 0 || isTubeComplete(tube));
}

/**
 * @param {number[][]} tubes
 * @param {number} from index of the source tube
 * @param {number} to index of the target tube
 */
export function canPour(tubes, from, to) {
  if (from === to) return false;

  const source = tubes[from];
  const target = tubes[to];
  if (!source || !target) return false;
  if (source.length === 0 || target.length >= TUBE_CAPACITY) return false;
  return target.length === 0 || topColor(target) === topColor(source);
}

/** How many units a pour would move; 0 when the pour is not allowed. */
export function pourAmount(tubes, from, to) {
  if (!canPour(tubes, from, to)) return 0;
  return Math.min(topRun(tubes[from]).count, TUBE_CAPACITY - tubes[to].length);
}

/**
 * Pours from one tube into another.
 * @returns {{ tubes: number[][], amount: number }} the new board and the number of units moved;
 *   the original board is returned unchanged when the pour is not allowed.
 */
export function applyPour(tubes, from, to) {
  const amount = pourAmount(tubes, from, to);
  if (amount === 0) return { tubes, amount };

  const next = cloneTubes(tubes);
  for (let i = 0; i < amount; i++) next[to].push(next[from].pop());
  return { tubes: next, amount };
}

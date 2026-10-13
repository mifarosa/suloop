import { Board, topRun } from './rules.js';
import { createRandom } from './random.js';
import { solve } from './solver.js';

/** How many times a puzzle too big to search for its shortest solution is tried. */
export const SOLVE_TRIES = 4;

/**
 * Finds the fewest moves that solve a puzzle, with an A* search.
 *
 * Every pour removes at most one same-colored run from the board (the run it moves either
 * joins the same color in the target or starts a new run there), and a solved board has one
 * run per color. So the runs on the board minus the colors is a lower bound on the moves
 * left, and the first solution A* takes off its queue is a shortest one.
 *
 * The search keeps every position it reaches, so it stops once it holds `maxNodes` of them,
 * which also bounds its memory; it then reports no solution, and the caller falls back to a
 * quicker search. The hardest levels need under 50,000.
 *
 * @param {import('./rules.js').Position | number[][]} start
 * @param {{ board?: Board, maxNodes?: number, weight?: number }} [options] weight: how much
 *   the estimate of the moves left counts. 1 finds a shortest solution; more makes the search
 *   head for the goal sooner, so it finds some solution quicker, a little longer than the
 *   shortest, and the result is no longer proven to be one
 * @returns {Array<[number, number]> | null} the moves, or null when the search gave up or the
 *   puzzle has no solution
 */
export function solveShortest(start, { board = new Board(), maxNodes = 200_000, weight = 1 } = {}) {
  const position = Array.isArray(start) ? board.start(start) : start;
  const colors = countColors(position.tubes);
  const queue = new MinQueue();
  /** For each position seen: the fewest moves to it, and how it was reached. */
  const seen = new Map();

  const startKey = board.positionKey(position);
  seen.set(startKey, { moves: 0, parent: null, move: null });
  queue.push(weight * lowerBound(position.tubes, colors), 0, {
    position,
    key: startKey,
    moves: 0
  });

  while (queue.size > 0) {
    const { position: current, key, moves } = queue.pop();
    if (seen.get(key).moves < moves) continue;
    if (board.isSolved(current)) return pathTo(seen, key);
    if (seen.size > maxNodes) return null;

    for (const [from, to] of usefulMoves(board, current)) {
      const next = board.pour(current, from, to).position;
      const nextKey = board.positionKey(next);
      const known = seen.get(nextKey);
      if (known && known.moves <= moves + 1) continue;

      seen.set(nextKey, { moves: moves + 1, parent: key, move: [from, to] });
      const estimate = moves + 1 + weight * lowerBound(next.tubes, colors);
      queue.push(estimate, moves + 1, { position: next, key: nextKey, moves: moves + 1 });
    }
  }
  return null;
}

/**
 * The moves worth trying from a position. Like the depth-first solver, it skips pours that
 * lead to the same position again or to a dead end (see solve in solver.js).
 */
function* usefulMoves(board, position) {
  const { tubes, fills } = position;
  for (let from = 0; from < tubes.length; from++) {
    if (!board.canPourFrom(position, from)) continue;

    const source = tubes[from];
    const run = topRun(source);
    const sourceIsSingleColor = run.count === source.length;
    const sourceTraits = board.traitsOf(from);
    const triedEmpty = new Set();

    for (let to = 0; to < tubes.length; to++) {
      if (to === from) continue;
      if (tubes[to].length === 0) {
        const traits = board.traitsOf(to);
        if (sourceIsSingleColor && traits === sourceTraits) continue;
        const kind = `${traits}${fills[to] ?? ''}`;
        if (triedEmpty.has(kind)) continue;
        triedEmpty.add(kind);
      }
      if (!board.canPour(position, from, to)) continue;
      if (board.oneWay.has(to) && tubes[to].length > 0 && tubes[to][0] !== run.color) continue;
      yield [from, to];
    }
  }
}

function countColors(tubes) {
  return new Set(tubes.flat()).size;
}

/**
 * Same-colored runs on the board minus one per color, plus one per color at the bottom of no
 * tube. Such a color still has to be poured where nothing lies under it, and that pour starts
 * a new run, so it removes none.
 */
function lowerBound(tubes, colors) {
  let runs = 0;
  const atBottom = new Set();
  for (const tube of tubes) {
    if (tube.length > 0) atBottom.add(tube[0]);
    for (let i = 0; i < tube.length; i++) {
      if (i === 0 || tube[i] !== tube[i - 1]) runs++;
    }
  }
  return runs - colors + (colors - atBottom.size);
}

function pathTo(seen, key) {
  const path = [];
  for (let entry = seen.get(key); entry.parent !== null; entry = seen.get(entry.parent)) {
    path.push(entry.move);
  }
  return path.reverse();
}

/**
 * A binary heap of items by estimate; among equal estimates the one with more moves made
 * comes first, which reaches a solution sooner.
 */
class MinQueue {
  #items = [];

  get size() {
    return this.#items.length;
  }

  push(estimate, moves, value) {
    const items = this.#items;
    items.push({ estimate, moves, value });
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!before(items[i], items[parent])) break;
      [items[i], items[parent]] = [items[parent], items[i]];
      i = parent;
    }
  }

  pop() {
    const items = this.#items;
    const top = items[0];
    const last = items.pop();
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const left = 2 * i + 1;
        const right = left + 1;
        let first = i;
        if (left < items.length && before(items[left], items[first])) first = left;
        if (right < items.length && before(items[right], items[first])) first = right;
        if (first === i) break;
        [items[i], items[first]] = [items[first], items[i]];
        i = first;
      }
    }
    return top.value;
  }
}

function before(a, b) {
  return a.estimate < b.estimate || (a.estimate === b.estimate && a.moves > b.moves);
}

/**
 * The fewest moves that solve a puzzle, for rating a solution.
 * @param {import('./rules.js').Position | number[][]} start
 * @param {{ board?: Board, maxNodes?: number }} [options]
 * @returns {{ moves: number, proven: boolean } | null} proven: false when the shortest search
 *   gave up and `moves` is just the length of some solution; null when there is none
 */
export function fewestMoves(start, { board = new Board(), maxNodes = 250_000 } = {}) {
  const shortest = solveShortest(start, { board, maxNodes });
  if (shortest) return { moves: shortest.length, proven: true };
  return closeToShortest(start, board);
}

/** Search weights that trade the guarantee of the shortest solution for speed, in order. */
const HURRIED_WEIGHTS = [1.5, 2.5, 4];

/**
 * For a puzzle too big to search for its shortest solution: the shortest found by searches
 * that hurry toward the goal, usually only a few moves over the best, and, if all of them
 * give up, by the best of a few seeded tries. Always the same answer for the same puzzle.
 * @returns {{ moves: number, proven: false } | null} null when nothing found a solution
 */
export function closeToShortest(start, board, maxNodes = 200_000) {
  let best = null;
  for (const weight of HURRIED_WEIGHTS) {
    const found = solveShortest(start, { board, maxNodes, weight });
    if (found && (best === null || found.length < best)) best = found.length;
  }
  const tries = bestOfTries(start, board, maxNodes);
  if (tries && (best === null || tries.moves < best)) best = tries.moves;
  return best === null ? null : { moves: best, proven: false };
}

/**
 * The shortest of a few solutions, each found with the moves tried in a different order.
 * The orders come from fixed seeds, so the same puzzle always gives the same answer, on
 * every device.
 * @returns {{ moves: number, proven: false } | null} null when no try found a solution
 */
export function bestOfTries(start, board, maxNodes = 200_000) {
  let best = null;
  for (let attempt = 0; attempt < SOLVE_TRIES; attempt++) {
    // The first try uses the usual order; the others shuffle it.
    const random = attempt === 0 ? null : createRandom(attempt);
    const found = solve(start, { board, maxNodes, random });
    if (found && (best === null || found.length < best)) best = found.length;
  }
  return best === null ? null : { moves: best, proven: false };
}

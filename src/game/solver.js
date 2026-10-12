import { Board, topRun } from './rules.js';

/**
 * Finds a sequence of moves that solves the puzzle with a depth-first search.
 *
 * Moves that can never help are skipped: pouring out of a complete tube, pouring a
 * single-colored tube into an empty one just like it, trying more than one empty tube of
 * the same kind as the target (they are interchangeable), and pouring a second color into a
 * one-way tube, which could then never become complete. Positions are compared regardless
 * of the order of interchangeable tubes (see Board#positionKey), so the same position reached
 * in a different arrangement is not searched twice.
 *
 * @param {number[][] | import('./rules.js').Position} start the tubes, or a position with
 *   the fills of cracked tubes
 * @param {{ board?: Board, maxNodes?: number, maxDepth?: number }} [options] the board's rules
 *   (plain tubes of the usual capacity when left out), and limits: stop searching after this
 *   many positions or this many moves deep; the search then reports no solution
 * @returns {Array<[number, number]> | null} `[from, to]` moves, or null when none was found
 */
export function solve(start, { board = new Board(), maxNodes = 200_000, maxDepth = 400 } = {}) {
  const visited = new Set();
  const path = [];
  let nodes = 0;

  function search(position) {
    if (board.isSolved(position)) return true;
    if (++nodes > maxNodes || path.length > maxDepth) return false;

    const key = board.positionKey(position);
    if (visited.has(key)) return false;
    visited.add(key);

    const { tubes, fills } = position;
    for (let from = 0; from < tubes.length; from++) {
      if (!board.canPourFrom(position, from)) continue;

      const source = tubes[from];
      const sourceIsSingleColor = topRun(source).count === source.length;
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
        if (board.oneWay.has(to) && tubes[to].length > 0 && tubes[to][0] !== topRun(source).color) {
          continue;
        }

        path.push([from, to]);
        if (search(board.pour(position, from, to).position)) return true;
        path.pop();
      }
    }
    return false;
  }

  const position = Array.isArray(start) ? board.start(start) : start;
  return search(position) ? path : null;
}

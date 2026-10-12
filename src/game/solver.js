import {
  applyPour,
  canPour,
  cloneTubes,
  isSolved,
  isTubeComplete,
  sizeOf,
  topRun,
  TUBE_CAPACITY
} from './rules.js';

/**
 * Finds a sequence of moves that solves the puzzle with a depth-first search.
 *
 * Moves that can never help are skipped: pouring out of a complete tube, pouring a
 * single-colored tube into an empty one, and trying more than one empty tube of the same
 * size as the target (they are interchangeable). Positions are compared regardless of the
 * order of same-sized tubes, so the same position reached in a different arrangement is not
 * searched twice.
 *
 * @param {number[][]} tubes
 * @param {{ capacity?: number, sizes?: number | number[], maxNodes?: number, maxDepth?: number }}
 *   [options] units of each color, units each tube holds (see rules.js), and limits: stop
 *   searching after this many positions or this many moves deep; the search then reports no
 *   solution
 * @returns {Array<[number, number]> | null} `[from, to]` moves, or null when none was found
 */
export function solve(
  tubes,
  { capacity = TUBE_CAPACITY, sizes = capacity, maxNodes = 200_000, maxDepth = 400 } = {}
) {
  const visited = new Set();
  const path = [];
  let nodes = 0;

  function search(state) {
    if (isSolved(state, capacity)) return true;
    if (++nodes > maxNodes || path.length > maxDepth) return false;

    const key = positionKey(state, sizes);
    if (visited.has(key)) return false;
    visited.add(key);

    for (let from = 0; from < state.length; from++) {
      const source = state[from];
      if (source.length === 0 || isTubeComplete(source, capacity)) continue;

      const sourceIsSingleColor = topRun(source).count === source.length;
      const triedEmptySizes = new Set();

      for (let to = 0; to < state.length; to++) {
        if (to === from) continue;
        if (state[to].length === 0) {
          const size = sizeOf(sizes, to);
          if (sourceIsSingleColor || triedEmptySizes.has(size)) continue;
          triedEmptySizes.add(size);
        }
        if (!canPour(state, from, to, sizes)) continue;

        path.push([from, to]);
        if (search(applyPour(state, from, to, sizes).tubes)) return true;
        path.pop();
      }
    }
    return false;
  }

  return search(cloneTubes(tubes)) ? path : null;
}

function positionKey(tubes, sizes) {
  // Tubes of different sizes are not interchangeable, so mixed sizes go into the key.
  const describe =
    typeof sizes === 'number'
      ? (tube) => tube.join(',')
      : (tube, index) => `${sizes[index]}:${tube.join(',')}`;
  return tubes.map(describe).sort().join('|');
}

import {
  applyPour,
  canPour,
  cloneTubes,
  isSolved,
  isTubeComplete,
  topRun,
  TUBE_CAPACITY
} from './rules.js';

/**
 * Finds a sequence of moves that solves the puzzle with a depth-first search.
 *
 * Moves that can never help are skipped: pouring out of a complete tube, pouring a
 * single-colored tube into an empty one, and trying more than one empty tube as the
 * target (empty tubes are interchangeable). Positions are compared regardless of tube
 * order, so the same position reached in a different arrangement is not searched twice.
 *
 * @param {number[][]} tubes
 * @param {{ capacity?: number, maxNodes?: number, maxDepth?: number }} [options] the units a
 *   tube holds, and limits: stop searching after this many positions or this many moves deep;
 *   the search then reports no solution
 * @returns {Array<[number, number]> | null} `[from, to]` moves, or null when none was found
 */
export function solve(
  tubes,
  { capacity = TUBE_CAPACITY, maxNodes = 200_000, maxDepth = 400 } = {}
) {
  const visited = new Set();
  const path = [];
  let nodes = 0;

  function search(state) {
    if (isSolved(state, capacity)) return true;
    if (++nodes > maxNodes || path.length > maxDepth) return false;

    const key = positionKey(state);
    if (visited.has(key)) return false;
    visited.add(key);

    for (let from = 0; from < state.length; from++) {
      const source = state[from];
      if (source.length === 0 || isTubeComplete(source, capacity)) continue;

      const sourceIsSingleColor = topRun(source).count === source.length;
      let triedEmptyTarget = false;

      for (let to = 0; to < state.length; to++) {
        if (to === from) continue;
        if (state[to].length === 0) {
          if (sourceIsSingleColor || triedEmptyTarget) continue;
          triedEmptyTarget = true;
        }
        if (!canPour(state, from, to, capacity)) continue;

        path.push([from, to]);
        if (search(applyPour(state, from, to, capacity).tubes)) return true;
        path.pop();
      }
    }
    return false;
  }

  return search(cloneTubes(tubes)) ? path : null;
}

function positionKey(tubes) {
  return tubes
    .map((tube) => tube.join(','))
    .sort()
    .join('|');
}

import { fewestMovesOfPuzzle } from './puzzleFewest.js';

/**
 * Works out the fewest moves of a puzzle away from the page, so the search never makes the
 * game stutter. Boards do not survive being posted, so the worker deals the puzzle again from
 * its level number or date (dealing is deterministic, so it gets the very same board), or
 * builds it from a custom puzzle's plain data.
 *
 * Message in: { id, puzzle: { level } | { day } | { custom } }; message out: { id, fewest }.
 */
self.addEventListener('message', ({ data: { id, puzzle } }) => {
  self.postMessage({ id, fewest: fewestMovesOfPuzzle(puzzle) });
});

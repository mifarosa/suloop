import { createDailyPuzzle, createLevelPuzzle } from './levels.js';
import { fewestMoves } from './shortest.js';

/**
 * Works out the fewest moves of a puzzle away from the page, so the search never makes the
 * game stutter. Boards do not survive being posted, so the worker deals the puzzle again from
 * its level number or date; dealing is deterministic, so it gets the very same board.
 *
 * Message in: { id, puzzle: { level } | { day } }; message out: { id, fewest }.
 */
self.addEventListener('message', ({ data: { id, puzzle } }) => {
  const { tubes, board } =
    puzzle.level !== undefined ? createLevelPuzzle(puzzle.level) : createDailyPuzzle(puzzle.day);
  self.postMessage({ id, fewest: fewestMoves(tubes, { board }) });
});

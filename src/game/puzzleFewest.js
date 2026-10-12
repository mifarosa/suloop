import { fewestMovesOf } from './customPuzzle.js';
import { createDailyPuzzle, createLevelPuzzle } from './levels.js';
import { fewestMoves } from './shortest.js';

/**
 * The fewest moves of a puzzle named by its level number, its date, or a custom puzzle's
 * plain data: what the worker answers, and the page works out itself when it has no worker.
 * @param {{ level: number } | { day: string } | { custom: import('./customPuzzle.js').CustomPuzzle }} puzzle
 * @returns {{ moves: number, proven: boolean } | null}
 */
export function fewestMovesOfPuzzle(puzzle) {
  if (puzzle.custom) return fewestMovesOf(puzzle.custom);
  const { tubes, board } =
    puzzle.level !== undefined ? createLevelPuzzle(puzzle.level) : createDailyPuzzle(puzzle.day);
  return fewestMoves(tubes, { board });
}

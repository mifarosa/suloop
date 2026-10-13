import { fewestMovesOf } from './customPuzzle.js';
import { FEWEST_MOVES } from './fewestTable.js';
import { createDailyPuzzle, createLevelPuzzle } from './levels.js';
import { fewestMoves } from './shortest.js';

/**
 * The fewest moves of a puzzle named by its level number, its date, or a custom puzzle's
 * plain data: what the worker answers, and the page works out itself when it has no worker.
 *
 * The ready-made levels (1 to 260) look theirs up in a table worked out beforehand, so every
 * player sees the same number at once. The daily puzzle, the master levels and custom puzzles
 * are searched for here: first for the shortest solution, and when that is too big, the
 * best of a few tries with fixed seeds, so the same puzzle gives the same number everywhere.
 * @param {{ level: number } | { day: string } | { custom: import('./customPuzzle.js').CustomPuzzle }} puzzle
 * @returns {{ moves: number, proven: boolean } | null}
 */
export function fewestMovesOfPuzzle(puzzle) {
  if (puzzle.custom) return fewestMovesOf(puzzle.custom);
  const baked = puzzle.level !== undefined ? FEWEST_MOVES[puzzle.level - 1] : undefined;
  if (baked !== undefined) return { moves: baked, proven: true };
  const { tubes, board } =
    puzzle.level !== undefined ? createLevelPuzzle(puzzle.level) : createDailyPuzzle(puzzle.day);
  return fewestMoves(tubes, { board });
}

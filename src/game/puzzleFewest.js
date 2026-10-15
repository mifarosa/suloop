import { fewestMovesOf } from './customPuzzle.js';
import { FEWEST_MOVES } from './fewestTable.js';
import { createDailyPuzzle, createLevelPuzzle } from './levels.js';
import { fewestMoves, solveShortest } from './shortest.js';

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

/**
 * A shortest solution of a numbered level, as the moves to play. The ready-made levels are
 * rated against their shortest solution, so playing this one earns every star; a level too big
 * to search for it gets the shortest the hurried searches find.
 * @param {{ level: number }} puzzle
 * @returns {Array<[number, number]> | null} null when nothing found a solution
 */
export function solutionOfPuzzle({ level }) {
  const { tubes, board } = createLevelPuzzle(level);
  for (const weight of [1, 1.5, 2.5, 4]) {
    const found = solveShortest(tubes, { board, maxNodes: 250_000, weight });
    if (found) return found;
  }
  return null;
}

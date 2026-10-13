import { describe, expect, it } from 'vitest';
import { FEWEST_MOVES } from '../src/game/fewestTable.js';
import { createDailyPuzzle, createLevelPuzzle, STAGE_LEVEL_COUNT } from '../src/game/levels.js';
import { fewestMovesOfPuzzle } from '../src/game/puzzleFewest.js';
import { bestOfTries, fewestMoves, SOLVE_TRIES, solveShortest } from '../src/game/shortest.js';
import { solve } from '../src/game/solver.js';

describe('the table of fewest moves', () => {
  it('has a number for every ready-made level', () => {
    expect(FEWEST_MOVES).toHaveLength(STAGE_LEVEL_COUNT);
    expect(FEWEST_MOVES.every((moves) => Number.isInteger(moves) && moves > 0)).toBe(true);
  });

  // If this fails, the levels changed: run `npm run bake` and commit the new table.
  it('matches what the search finds, level by level', () => {
    for (let level = 1; level <= STAGE_LEVEL_COUNT; level++) {
      const { tubes, board } = createLevelPuzzle(level);
      expect(solveShortest(tubes, { board, maxNodes: 2_000_000 })?.length, `level ${level}`).toBe(
        FEWEST_MOVES[level - 1]
      );
    }
  });

  it('answers ready-made levels from the table, and the others by searching', () => {
    expect(fewestMovesOfPuzzle({ level: 20 })).toEqual({ moves: FEWEST_MOVES[19], proven: true });

    const { tubes, board } = createLevelPuzzle(262);
    expect(fewestMovesOfPuzzle({ level: 262 })).toEqual(fewestMoves(tubes, { board }));
    const daily = createDailyPuzzle('2026-10-13');
    expect(fewestMovesOfPuzzle({ day: '2026-10-13' })).toEqual(
      fewestMoves(daily.tubes, { board: daily.board })
    );
  });
});

describe('best of a few tries', () => {
  const { tubes, board } = createLevelPuzzle(120);

  it('never does worse than the first try, and gives the same answer every time', () => {
    const first = solve(tubes, { board }).length;
    const tries = bestOfTries(tubes, board);
    expect(SOLVE_TRIES).toBeGreaterThanOrEqual(3);
    expect(tries.proven).toBe(false);
    expect(tries.moves).toBeLessThanOrEqual(first);
    expect(bestOfTries(tubes, board)).toEqual(tries);
  });

  it('is what a puzzle too big for the shortest search gets', () => {
    expect(fewestMoves(tubes, { board, maxNodes: 5 })).toEqual(bestOfTries(tubes, board));
  });

  it('has nothing to say about a puzzle without a solution', () => {
    expect(
      bestOfTries(
        [
          [0, 1, 0, 1],
          [1, 0, 1, 0]
        ],
        undefined
      )
    ).toBeNull();
  });
});

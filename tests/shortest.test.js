import { describe, expect, it } from 'vitest';
import { createLevelPuzzle } from '../src/game/levels.js';
import { Board } from '../src/game/rules.js';
import { fewestMoves, solveShortest } from '../src/game/shortest.js';
import { MAX_STARS, starsFor, twoStarLimit } from '../src/game/stars.js';

/** Fewest moves by brute force: a breadth-first search over every legal pour. */
function bruteForceFewest(tubes, board) {
  let layer = [board.start(tubes)];
  const seen = new Set([board.positionKey(layer[0])]);
  for (let moves = 0; layer.length > 0; moves++) {
    if (layer.some((position) => board.isSolved(position))) return moves;
    const next = [];
    for (const position of layer) {
      for (let from = 0; from < tubes.length; from++) {
        if (!board.canPourFrom(position, from)) continue;
        for (let to = 0; to < tubes.length; to++) {
          if (!board.canPour(position, from, to)) continue;
          const after = board.pour(position, from, to).position;
          const key = board.positionKey(after);
          if (seen.has(key)) continue;
          seen.add(key);
          next.push(after);
        }
      }
    }
    layer = next;
  }
  return null;
}

/** Plays the moves and says whether they solve the puzzle. */
function solves(tubes, board, moves) {
  let position = board.start(tubes);
  for (const [from, to] of moves) {
    if (!board.canPourFrom(position, from)) return false;
    const { position: after, amount } = board.pour(position, from, to);
    if (amount === 0) return false;
    position = after;
  }
  return board.isSolved(position);
}

describe('solveShortest', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8, 16, 61, 91, 126, 166, 211])(
    'finds as few moves as a brute-force search for level %i',
    (level) => {
      const { tubes, board } = createLevelPuzzle(level);
      const moves = solveShortest(tubes, { board });
      expect(solves(tubes, board, moves)).toBe(true);
      expect(moves.length).toBe(bruteForceFewest(tubes, board));
    }
  );

  it('solves a board that has oil and a one-way tube', () => {
    const board = new Board({ oilColors: [2], oneWay: [4] });
    const tubes = [[0, 1, 2], [1, 0, 2], [0, 1, 2, 2], [0, 1], []];
    const moves = solveShortest(tubes, { board });
    expect(solves(tubes, board, moves)).toBe(true);
    expect(moves.length).toBe(bruteForceFewest(tubes, board));
  });

  it('has nothing to say about a puzzle without a solution', () => {
    expect(
      solveShortest([
        [0, 1, 0, 1],
        [1, 0, 1, 0]
      ])
    ).toBeNull();
  });

  it('gives up after its node budget', () => {
    const { tubes, board } = createLevelPuzzle(33);
    expect(solveShortest(tubes, { board, maxNodes: 5 })).toBeNull();
  });
});

describe('fewestMoves', () => {
  it('is proven when the shortest search finishes', () => {
    const { tubes, board } = createLevelPuzzle(5);
    expect(fewestMoves(tubes, { board })).toEqual({
      moves: solveShortest(tubes, { board }).length,
      proven: true
    });
  });

  it('falls back to any solution when the shortest search gives up', () => {
    const { tubes, board } = createLevelPuzzle(33);
    const { moves, proven } = fewestMoves(tubes, { board, maxNodes: 5 });
    expect(proven).toBe(false);
    expect(moves).toBeGreaterThanOrEqual(fewestMoves(tubes, { board }).moves);
  });

  it.each([45, 120, 200, 262])('works out level %i quickly', (level) => {
    const { tubes, board } = createLevelPuzzle(level);
    expect(fewestMoves(tubes, { board }).proven).toBe(true);
  });
});

describe('stars', () => {
  it('gives every star for the fewest moves, or fewer still', () => {
    expect(starsFor(21, 21)).toBe(MAX_STARS);
    expect(starsFor(20, 21)).toBe(MAX_STARS);
  });

  it('gives two stars a few moves over, and one star beyond', () => {
    expect(twoStarLimit(9)).toBe(11);
    expect(twoStarLimit(21)).toBe(26);
    expect(starsFor(26, 21)).toBe(2);
    expect(starsFor(27, 21)).toBe(1);
    expect(starsFor(10, 9)).toBe(2);
    expect(starsFor(12, 9)).toBe(1);
  });
});

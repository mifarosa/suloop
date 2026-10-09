import { describe, expect, it } from 'vitest';
import { applyPour, isSolved } from '../src/game/rules.js';
import { solve } from '../src/game/solver.js';

function replay(tubes, moves) {
  return moves.reduce((board, [from, to]) => applyPour(board, from, to).tubes, tubes);
}

describe('solve', () => {
  it('returns moves that actually solve the puzzle', () => {
    const tubes = [[1, 0, 1, 2], [0, 2, 1, 2], [1, 0, 0, 2], [], []];
    const moves = solve(tubes);

    expect(moves).not.toBeNull();
    expect(isSolved(replay(tubes, moves))).toBe(true);
  });

  it('needs no moves for a solved board', () => {
    expect(solve([[0, 0, 0, 0], []])).toEqual([]);
  });

  it('reports a dead end', () => {
    expect(
      solve([
        [0, 1, 0, 1],
        [1, 0, 1, 0]
      ])
    ).toBeNull();
  });

  it('gives up when the search limit is reached', () => {
    const tubes = [[1, 0, 1, 2], [0, 2, 1, 2], [1, 0, 0, 2], [], []];
    expect(solve(tubes, { maxNodes: 1 })).toBeNull();
  });

  it('does not change the board it is given', () => {
    const tubes = [[1, 0, 1, 2], [0, 2, 1, 2], [1, 0, 0, 2], [], []];
    const copy = structuredClone(tubes);
    solve(tubes);
    expect(tubes).toEqual(copy);
  });
});

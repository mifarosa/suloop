import { describe, expect, it } from 'vitest';
import { Board } from '../src/game/rules.js';
import { solve } from '../src/game/solver.js';

function replay(board, tubes, moves) {
  return moves.reduce(
    (position, [from, to]) => board.pour(position, from, to).position,
    board.start(tubes)
  );
}

describe('solve', () => {
  it('returns moves that actually solve the puzzle', () => {
    const tubes = [[1, 0, 1, 2], [0, 2, 1, 2], [1, 0, 0, 2], [], []];
    const moves = solve(tubes);
    const board = new Board();

    expect(moves).not.toBeNull();
    expect(board.isSolved(replay(board, tubes, moves))).toBe(true);
  });

  it('follows the special rules of a board', () => {
    // Color 1 is oil, tube 3 is one-way, tube 4 is cracked and tube 2 opens once 0 is complete.
    const board = new Board({ oilColors: [1], oneWay: [3], cracked: { 4: 2 }, locks: { 2: 0 } });
    const tubes = [[0, 2, 1], [2, 0, 1], [2, 2, 1, 1], [], [], [0, 0]];
    const moves = solve(tubes, { board });

    expect(moves).not.toBeNull();
    expect(board.isSolved(replay(board, tubes, moves))).toBe(true);
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

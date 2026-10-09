import { describe, expect, it } from 'vitest';
import {
  applyPour,
  canPour,
  isSolved,
  isTubeComplete,
  pourAmount,
  topRun,
  TUBE_CAPACITY
} from '../src/game/rules.js';

describe('topRun', () => {
  it('reports nothing for an empty tube', () => {
    expect(topRun([])).toEqual({ color: null, count: 0 });
  });

  it('counts the matching units at the top only', () => {
    expect(topRun([1, 2, 2])).toEqual({ color: 2, count: 2 });
    expect(topRun([2, 1, 2])).toEqual({ color: 2, count: 1 });
  });
});

describe('isTubeComplete', () => {
  it('needs a full tube of a single color', () => {
    expect(isTubeComplete([3, 3, 3, 3])).toBe(true);
    expect(isTubeComplete([3, 3, 3])).toBe(false);
    expect(isTubeComplete([3, 3, 1, 3])).toBe(false);
    expect(isTubeComplete([])).toBe(false);
  });
});

describe('isSolved', () => {
  it('accepts boards with only empty and complete tubes', () => {
    expect(isSolved([[0, 0, 0, 0], [], [1, 1, 1, 1]])).toBe(true);
    expect(isSolved([[0, 0, 0], [0], [1, 1, 1, 1]])).toBe(false);
  });
});

describe('canPour', () => {
  const tubes = [[0, 1], [2, 1], [1, 1, 1, 1], [], [0, 2, 0, 2]];

  it('allows pouring onto the same color or into an empty tube', () => {
    expect(canPour(tubes, 0, 1)).toBe(true);
    expect(canPour(tubes, 0, 3)).toBe(true);
  });

  it('refuses mismatched colors, full targets, empty sources and the same tube', () => {
    expect(canPour(tubes, 4, 0)).toBe(false);
    expect(canPour(tubes, 0, 2)).toBe(false);
    expect(canPour(tubes, 3, 0)).toBe(false);
    expect(canPour(tubes, 0, 0)).toBe(false);
  });

  it('refuses tube indexes that do not exist', () => {
    expect(canPour(tubes, 0, 9)).toBe(false);
  });
});

describe('pourAmount', () => {
  it('moves the whole top run when there is room', () => {
    expect(pourAmount([[0, 1, 1], []], 0, 1)).toBe(2);
  });

  it('moves only as much as fits', () => {
    const target = [0, 0, 1];
    const freeSpace = TUBE_CAPACITY - target.length;
    expect(pourAmount([[1, 1, 1], target], 0, 1)).toBe(freeSpace);
  });

  it('is zero when the pour is not allowed', () => {
    expect(pourAmount([[0], [1]], 0, 1)).toBe(0);
  });
});

describe('applyPour', () => {
  it('returns a new board and leaves the original untouched', () => {
    const tubes = [[0, 1, 1], [1]];
    const result = applyPour(tubes, 0, 1);

    expect(result).toEqual({ tubes: [[0], [1, 1, 1]], amount: 2 });
    expect(tubes).toEqual([[0, 1, 1], [1]]);
  });

  it('returns the same board when nothing can move', () => {
    const tubes = [[0], [1]];
    expect(applyPour(tubes, 0, 1)).toEqual({ tubes, amount: 0 });
  });
});

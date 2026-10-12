import { describe, expect, it } from 'vitest';
import { Board, topRun, TUBE_CAPACITY } from '../src/game/rules.js';

const plain = new Board();
const at = (tubes, board = plain) => board.start(tubes);

describe('topRun', () => {
  it('reports nothing for an empty tube', () => {
    expect(topRun([])).toEqual({ color: null, count: 0 });
  });

  it('counts the matching units at the top only', () => {
    expect(topRun([1, 2, 2])).toEqual({ color: 2, count: 2 });
    expect(topRun([2, 1, 2])).toEqual({ color: 2, count: 1 });
  });
});

describe('isComplete', () => {
  it('needs a full tube of a single color', () => {
    expect(plain.isComplete([3, 3, 3, 3])).toBe(true);
    expect(plain.isComplete([3, 3, 3])).toBe(false);
    expect(plain.isComplete([3, 3, 1, 3])).toBe(false);
    expect(plain.isComplete([])).toBe(false);
  });

  it('needs every unit of the color, also in a tall tube', () => {
    const tall = new Board({ capacity: 5 });
    expect(tall.isComplete([3, 3, 3, 3])).toBe(false);
    expect(tall.isComplete([3, 3, 3, 3, 3])).toBe(true);
  });
});

describe('isSolved', () => {
  it('accepts boards with only empty and complete tubes', () => {
    expect(plain.isSolved(at([[0, 0, 0, 0], [], [1, 1, 1, 1]]))).toBe(true);
    expect(plain.isSolved(at([[0, 0, 0], [0], [1, 1, 1, 1]]))).toBe(false);
  });
});

describe('canPour', () => {
  const position = at([[0, 1], [2, 1], [1, 1, 1, 1], [], [0, 2, 0, 2]]);

  it('allows pouring onto the same color or into an empty tube', () => {
    expect(plain.canPour(position, 0, 1)).toBe(true);
    expect(plain.canPour(position, 0, 3)).toBe(true);
  });

  it('refuses mismatched colors, full targets, empty sources and the same tube', () => {
    expect(plain.canPour(position, 4, 0)).toBe(false);
    expect(plain.canPour(position, 0, 2)).toBe(false);
    expect(plain.canPour(position, 3, 0)).toBe(false);
    expect(plain.canPour(position, 0, 0)).toBe(false);
  });

  it('refuses tube indexes that do not exist', () => {
    expect(plain.canPour(position, 0, 9)).toBe(false);
  });
});

describe('pourAmount', () => {
  it('moves the whole top run when there is room', () => {
    expect(plain.pourAmount(at([[0, 1, 1], []]), 0, 1)).toBe(2);
  });

  it('moves only as much as fits', () => {
    const target = [0, 0, 1];
    const freeSpace = TUBE_CAPACITY - target.length;
    expect(plain.pourAmount(at([[1, 1, 1], target]), 0, 1)).toBe(freeSpace);
  });

  it('is zero when the pour is not allowed', () => {
    expect(plain.pourAmount(at([[0], [1]]), 0, 1)).toBe(0);
  });
});

describe('pour', () => {
  it('returns a new position and leaves the original untouched', () => {
    const position = at([[0, 1, 1], [1]]);
    const result = plain.pour(position, 0, 1);

    expect(result.amount).toBe(2);
    expect(result.position.tubes).toEqual([[0], [1, 1, 1]]);
    expect(position.tubes).toEqual([[0, 1, 1], [1]]);
  });

  it('returns the same position when nothing can move', () => {
    const position = at([[0], [1]]);
    expect(plain.pour(position, 0, 1)).toEqual({ position, amount: 0 });
  });
});

describe('half tubes', () => {
  const board = new Board({ sizes: [4, 4, 2] });

  it('take only as much as they hold', () => {
    expect(board.pourAmount(at([[0, 1, 1, 1], [], []], board), 0, 2)).toBe(2);
  });
});

describe('oil', () => {
  // Color 5 is oil.
  const board = new Board({ oilColors: [5] });

  it('settles on top of water of any color', () => {
    const position = at(
      [
        [1, 5],
        [2, 3]
      ],
      board
    );
    expect(board.canPour(position, 0, 1)).toBe(true);
    expect(board.pour(position, 0, 1).position.tubes[1]).toEqual([2, 3, 5]);
  });

  it('only meets the same oil', () => {
    const twoOils = new Board({ oilColors: [5, 6] });
    expect(
      twoOils.canPour(
        at(
          [
            [1, 5],
            [2, 6]
          ],
          twoOils
        ),
        0,
        1
      )
    ).toBe(false);
    expect(
      twoOils.pourAmount(
        at(
          [
            [1, 5],
            [2, 5]
          ],
          twoOils
        ),
        0,
        1
      )
    ).toBe(1);
  });

  it('lets water sink under it to meet the same water', () => {
    const position = at(
      [
        [0, 2],
        [3, 2, 5],
        [3, 1]
      ],
      board
    );
    expect(board.canPour(position, 0, 1)).toBe(true);
    expect(board.pour(position, 0, 1).position.tubes[1]).toEqual([3, 2, 2, 5]);
    expect(board.canPour(position, 2, 1)).toBe(false);
  });

  it('keeps the water under it from being poured out', () => {
    const position = at([[0, 5], []], board);
    expect(board.pour(position, 0, 1).position.tubes).toEqual([[0], [5]]);
  });
});

describe('one-way tubes', () => {
  const board = new Board({ oneWay: [1] });

  it('take liquid but never give it back', () => {
    const position = at([[0, 1], [1]], board);
    expect(board.canPour(position, 0, 1)).toBe(true);
    expect(board.canPour(position, 1, 0)).toBe(false);
    expect(board.canPourFrom(position, 1)).toBe(false);
  });
});

describe('cracked tubes', () => {
  const board = new Board({ cracked: { 1: 2 } });

  it('can be poured into only so many times, and poured out of any time', () => {
    let position = at([[0, 1], [], [1], [1]], board);
    expect(position.fills).toEqual([null, 2, null, null]);

    position = board.pour(position, 0, 1).position;
    position = board.pour(position, 1, 2).position;
    position = board.pour(position, 2, 1).position;
    expect(position.tubes[1]).toEqual([1, 1]);
    expect(position.fills[1]).toBe(0);
    expect(board.canPour(position, 3, 1)).toBe(false);
    expect(board.canPour(position, 1, 3)).toBe(true);
  });

  it('tells positions apart by the fills that are left', () => {
    const fresh = at([[0, 0, 1, 1], [], [1, 1, 0, 0]], board);
    const used = { ...fresh, fills: [null, 1, null] };
    expect(board.positionKey(fresh)).not.toBe(board.positionKey(used));
  });
});

describe('locked tubes', () => {
  // Tube 2 opens once some tube is complete with color 0.
  const board = new Board({ locks: { 2: 0 } });

  it('cannot be used until their key color is complete', () => {
    const position = at([[0, 0, 0], [0], [1, 1, 1, 1], []], board);
    expect(board.isLocked(position, 2)).toBe(true);
    expect(board.canPourFrom(position, 2)).toBe(false);
    expect(board.canPour(position, 3, 2)).toBe(false);

    const opened = board.pour(position, 1, 0).position;
    expect(board.isLocked(opened, 2)).toBe(false);
  });
});

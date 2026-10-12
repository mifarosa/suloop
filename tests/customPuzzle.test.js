import { describe, expect, it } from 'vitest';
import {
  boardOf,
  decodePuzzle,
  emptyPuzzle,
  encodePuzzle,
  MAX_TUBES,
  problemsOf,
  rulesOf,
  withCapacity,
  withLockToggled,
  withOilToggled,
  withRandomFill,
  withTubeAdded,
  withTubeRemoved,
  withUnitAdded,
  withUnitRemoved
} from '../src/game/customPuzzle.js';
import { createRandom } from '../src/game/random.js';
import { solve } from '../src/game/solver.js';

/** Builds a puzzle from tubes of colors, all plain unless `kinds` says otherwise. */
function puzzleOf(colors, { kinds = [], ...rest } = {}) {
  return {
    ...emptyPuzzle(0),
    tubes: colors.map((tube, i) => ({ kind: kinds[i] ?? 'plain', colors: tube, lock: null })),
    ...rest
  };
}

describe('editing a custom puzzle', () => {
  it('adds units on top, and water under any oil', () => {
    let puzzle = puzzleOf([[0, 2], []], { oil: [2] });
    puzzle = withUnitAdded(puzzle, 0, 1);
    expect(puzzle.tubes[0].colors).toEqual([0, 1, 2]);
    puzzle = withUnitAdded(puzzle, 0, 2);
    expect(puzzle.tubes[0].colors).toEqual([0, 1, 2, 2]);
    expect(withUnitAdded(puzzle, 0, 3)).toBeNull();
    expect(withUnitRemoved(puzzle, 0).tubes[0].colors).toEqual([0, 1, 2]);
    expect(withUnitRemoved(puzzle, 1)).toBeNull();
  });

  it('fills a half tube with two units only', () => {
    const puzzle = withUnitAdded(withUnitAdded(puzzleOf([[]], { kinds: ['half'] }), 0, 1), 0, 1);
    expect(withUnitAdded(puzzle, 0, 1)).toBeNull();
  });

  it('floats oil to the top when a color becomes oil', () => {
    const puzzle = withOilToggled(puzzleOf([[1, 0, 1, 2]]), 1);
    expect(puzzle.oil).toEqual([1]);
    expect(puzzle.tubes[0].colors).toEqual([0, 2, 1, 1]);
    expect(withOilToggled(puzzle, 1).oil).toEqual([]);
  });

  it('locks plain tubes only, and unlocks with the same key', () => {
    const puzzle = puzzleOf([[0], []], { kinds: ['plain', 'cracked'] });
    const locked = withLockToggled(puzzle, 0, 3);
    expect(locked.tubes[0].lock).toBe(3);
    expect(withLockToggled(locked, 0, 3).tubes[0].lock).toBeNull();
    expect(withLockToggled(locked, 0, 4).tubes[0].lock).toBe(4);
    expect(withLockToggled(puzzle, 1, 3)).toBeNull();
  });

  it('adds and removes tubes within the limits', () => {
    let puzzle = emptyPuzzle(2);
    expect(withTubeRemoved(puzzle, 0)).toBeNull();
    for (let i = 2; i < MAX_TUBES; i++) puzzle = withTubeAdded(puzzle, 'oneWay');
    expect(puzzle.tubes).toHaveLength(MAX_TUBES);
    expect(withTubeAdded(puzzle, 'plain')).toBeNull();
    expect(withTubeRemoved(puzzle, 3).tubes).toHaveLength(MAX_TUBES - 1);
  });

  it('drops what no longer fits when tall tubes become regular', () => {
    const puzzle = withCapacity(puzzleOf([[0, 0, 0, 0, 0]], { capacity: 5 }), 4);
    expect(puzzle.tubes[0].colors).toEqual([0, 0, 0, 0]);
  });

  it('deals colors at random with two tubes to spare, none of them complete', () => {
    const puzzle = withRandomFill(emptyPuzzle(3), 5, createRandom(1));
    expect(puzzle.tubes).toHaveLength(7);
    expect(puzzle.tubes.filter((tube) => tube.colors.length === 4)).toHaveLength(5);
    expect(problemsOf(puzzle)).toEqual([]);
    const { tubes, board } = boardOf(puzzle);
    expect(solve(tubes, { board })).not.toBeNull();
  });
});

describe('checking a custom puzzle', () => {
  it('needs every color in full, two colors at least, and a key that can be completed', () => {
    expect(problemsOf(puzzleOf([[0, 0, 0, 0], []]))).toEqual([{ code: 'tooFewColors' }]);
    expect(
      problemsOf(
        puzzleOf([
          [0, 1, 0],
          [1, 1, 1, 0]
        ])
      )
    ).toEqual([{ code: 'colorCount', color: 0, count: 3 }]);

    const locked = puzzleOf([[0, 1, 0, 1], [1, 0, 1, 0], []]);
    locked.tubes[0].lock = 0;
    locked.tubes[1].lock = 5;
    expect(problemsOf(locked)).toEqual([
      { code: 'lockKeyInside', tube: 0 },
      { code: 'lockKeyMissing', tube: 1 }
    ]);
  });

  it('turns down a puzzle that is solved already', () => {
    expect(problemsOf(puzzleOf([[0, 0, 0, 0], [1, 1, 1, 1], []]))).toEqual([
      { code: 'alreadySolved' }
    ]);
  });

  it('becomes a board with every rule it uses', () => {
    const puzzle = puzzleOf([[0, 1, 0, 1], [1, 0, 1, 0], [], [], []], {
      kinds: ['plain', 'plain', 'oneWay', 'cracked', 'half'],
      oil: [1],
      hidden: true,
      undoLimit: 3
    });
    puzzle.tubes[1].lock = 0;
    const { tubes, board } = boardOf(withOilToggled(withOilToggled(puzzle, 1), 1));
    expect(tubes[0]).toEqual([0, 0, 1, 1]);
    expect(board.sizes).toEqual([4, 4, 4, 4, 2]);
    expect([...board.oneWay]).toEqual([2]);
    expect(board.cracked.get(3)).toBe(3);
    expect(board.locks.get(1)).toBe(0);
    expect(rulesOf(puzzle)).toEqual([
      'limitedUndo',
      'oneWayTube',
      'hiddenColors',
      'crackedTube',
      'lockedTube',
      'halfTube',
      'oil'
    ]);
  });
});

describe('puzzle codes', () => {
  const sample = () => {
    const puzzle = puzzleOf([[0, 1, 2, 3, 4], [4, 3, 2, 1, 0], [], [], []], {
      kinds: ['plain', 'plain', 'half', 'oneWay', 'cracked'],
      capacity: 5,
      oil: [3],
      hidden: true,
      undoLimit: 2
    });
    puzzle.tubes[1].lock = 9;
    return withOilToggled(withOilToggled(puzzle, 3), 3);
  };

  it('carries a puzzle exactly, in a code safe for links', () => {
    const code = encodePuzzle(sample());
    expect(code).toMatch(/^[\w-]+$/);
    expect(decodePuzzle(code)).toEqual(sample());
  });

  it('reads a code from a link or as plain JSON', () => {
    const code = encodePuzzle(sample());
    expect(decodePuzzle(`https://mifarosa.com/suloop/#bulmaca=${code}`)).toEqual(sample());
    const json = JSON.stringify({ v: 1, c: 4, t: ['0101', '1010', ''], k: 'ppp' });
    expect(decodePuzzle(json).tubes.map((tube) => tube.colors)).toEqual([
      [0, 1, 0, 1],
      [1, 0, 1, 0],
      []
    ]);
  });

  it('turns down anything that is not a sound puzzle', () => {
    const bad = [
      '',
      'not a code',
      JSON.stringify({ v: 2, c: 4, t: ['0', '1'], k: 'pp' }),
      JSON.stringify({ v: 1, c: 6, t: ['0', '1'], k: 'pp' }),
      JSON.stringify({ v: 1, c: 4, t: ['01010', '1'], k: 'pp' }),
      JSON.stringify({ v: 1, c: 4, t: ['0', '1'], k: 'px' }),
      JSON.stringify({ v: 1, c: 4, t: ['0', 'z'], k: 'pp' }),
      JSON.stringify({ v: 1, c: 4, t: ['0', '1'], k: 'pp', l: { 1: 99 } }),
      JSON.stringify({ v: 1, c: 4, t: ['0', '1'], k: 'ph', l: { 1: 0 } }),
      JSON.stringify({ v: 1, c: 4, t: ['0', '1'], k: 'pp', u: 9 }),
      JSON.stringify({ v: 1, c: 4, t: Array(17).fill(''), k: 'p'.repeat(17) })
    ];
    for (const text of bad) expect(decodePuzzle(text), text).toBeNull();
  });
});

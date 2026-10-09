import { describe, expect, it } from 'vitest';
import { generatePuzzle } from '../src/game/generator.js';
import {
  colorCountForLevel,
  createDailyPuzzle,
  createLevelPuzzle,
  DAILY_COLOR_COUNT,
  MAX_COLOR_COUNT
} from '../src/game/levels.js';
import { createRandom, hashString } from '../src/game/random.js';
import { topRun, TUBE_CAPACITY } from '../src/game/rules.js';
import { solve } from '../src/game/solver.js';

function countUnits(tubes) {
  const counts = new Map();
  for (const color of tubes.flat()) counts.set(color, (counts.get(color) ?? 0) + 1);
  return counts;
}

describe('random', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = createRandom(42);
    const b = createRandom(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('stays within [0, 1)', () => {
    const random = createRandom(7);
    for (let i = 0; i < 1000; i++) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('hashes text to a stable 32-bit seed', () => {
    expect(hashString('level-1')).toBe(2877856819);
  });
});

describe('colorCountForLevel', () => {
  it('starts with three colors and adds one every two levels', () => {
    expect([1, 2, 3, 4, 5].map(colorCountForLevel)).toEqual([3, 3, 4, 4, 5]);
  });

  it('stops at the maximum', () => {
    expect(colorCountForLevel(500)).toBe(MAX_COLOR_COUNT);
  });
});

describe('generatePuzzle', () => {
  it('deals the same puzzle for the same seed', () => {
    expect(generatePuzzle(123, 5)).toEqual(generatePuzzle(123, 5));
  });

  it('deals full tubes of every color plus two empty ones', () => {
    const tubes = generatePuzzle(99, 6);

    expect(tubes).toHaveLength(8);
    expect(tubes.slice(6)).toEqual([[], []]);
    expect([...countUnits(tubes).values()]).toEqual(Array(6).fill(TUBE_CAPACITY));
  });

  it('deals only solvable puzzles that do not start half sorted', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const tubes = generatePuzzle(seed, 4);
      expect(solve(tubes)).not.toBeNull();
      expect(tubes.every((tube) => topRun(tube).count < 3)).toBe(true);
    }
  });
});

describe('level and daily puzzles', () => {
  // Players share and compare levels, so a release must never change an existing level.
  it('keeps level layouts stable across releases', () => {
    expect(createLevelPuzzle(1)).toEqual([[1, 0, 1, 2], [0, 2, 1, 2], [1, 0, 0, 2], [], []]);
    expect(createLevelPuzzle(5)).toEqual([
      [2, 4, 2, 1],
      [4, 2, 4, 1],
      [4, 0, 3, 3],
      [1, 2, 3, 1],
      [0, 0, 0, 3],
      [],
      []
    ]);
  });

  it('keeps daily layouts stable across releases', () => {
    expect(createDailyPuzzle('2026-10-09')).toEqual([
      [4, 0, 6, 5],
      [2, 2, 3, 3],
      [0, 2, 1, 3],
      [1, 6, 5, 4],
      [4, 6, 5, 1],
      [0, 3, 4, 0],
      [6, 2, 1, 5],
      [],
      []
    ]);
  });

  it('uses a fixed number of colors for the daily puzzle', () => {
    expect(countUnits(createDailyPuzzle('2026-01-01')).size).toBe(DAILY_COLOR_COUNT);
  });
});

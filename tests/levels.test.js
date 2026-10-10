import { describe, expect, it } from 'vitest';
import { generatePuzzle } from '../src/game/generator.js';
import {
  chapterIndexOfLevel,
  CHAPTERS,
  createDailyPuzzle,
  createLevelPuzzle,
  DAILY_COLOR_COUNT,
  LEVEL_COUNT,
  levelSettings,
  LEVELS_PER_CHAPTER,
  MAX_COLOR_COUNT
} from '../src/game/levels.js';
import { createRandom, hashString } from '../src/game/random.js';
import { topRun, TUBE_CAPACITY } from '../src/game/rules.js';
import { solve } from '../src/game/solver.js';

// The first expert level, written out by hand so a change to the dealing shows up here.
const PINNED_LEVEL_46 = [
  [2, 4, 2, 5],
  [0, 1, 1, 4],
  [0, 2, 2, 1],
  [3, 0, 5, 4],
  [5, 3, 0, 1],
  [3, 5, 4, 3],
  []
];

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

describe('levelSettings', () => {
  const colorsOf = (levels) => levels.map((level) => levelSettings(level).colorCount);

  it('raises the color count in equal steps within a chapter', () => {
    expect(colorsOf([1, 5, 6, 10, 11, 15])).toEqual([3, 3, 4, 4, 5, 5]);
    expect(colorsOf([31, 38, 39, 45])).toEqual([9, 9, 10, 10]);
  });

  it('starts every chapter at its lowest color count and ends at its highest', () => {
    CHAPTERS.forEach((chapter, index) => {
      const first = index * LEVELS_PER_CHAPTER + 1;
      const last = first + LEVELS_PER_CHAPTER - 1;
      expect(colorsOf([first, last])).toEqual([chapter.minColors, chapter.maxColors]);
      expect(levelSettings(last).emptyTubeCount).toBe(chapter.emptyTubeCount);
    });
  });

  it('leaves a single empty tube only in the expert chapter', () => {
    expect(levelSettings(45).emptyTubeCount).toBe(2);
    expect(levelSettings(46).emptyTubeCount).toBe(1);
  });

  it('never needs more colors than the maximum', () => {
    for (let level = 1; level <= LEVEL_COUNT; level++) {
      expect(levelSettings(level).colorCount).toBeLessThanOrEqual(MAX_COLOR_COUNT);
    }
  });
});

describe('chapterIndexOfLevel', () => {
  it('groups the levels in chapters', () => {
    expect([1, 15, 16, 30, 46, LEVEL_COUNT].map(chapterIndexOfLevel)).toEqual([0, 0, 1, 1, 3, 3]);
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
    expect(createLevelPuzzle(46)).toEqual(PINNED_LEVEL_46);
  });

  it('deals every level with its settings, and every level can be solved', () => {
    for (let level = 1; level <= LEVEL_COUNT; level++) {
      const tubes = createLevelPuzzle(level);
      const { colorCount, emptyTubeCount } = levelSettings(level);
      expect(countUnits(tubes).size).toBe(colorCount);
      expect(tubes.filter((tube) => tube.length === 0)).toHaveLength(emptyTubeCount);
      expect(solve(tubes)).not.toBeNull();
    }
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

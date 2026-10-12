import { describe, expect, it } from 'vitest';
import { generatePuzzle, tubeSizes } from '../src/game/generator.js';
import {
  CHAPTER_LEVEL_COUNT,
  chapterIdOfLevel,
  CHAPTERS,
  createDailyPuzzle,
  createLevelPuzzle,
  DAILY_COLOR_COUNT,
  levelSettings,
  LEVELS_PER_CHAPTER,
  MASTER_SETTINGS,
  MAX_COLOR_COUNT,
  rulesFirstUsedAt
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

// The first master level.
const PINNED_LEVEL_61 = [
  [8, 2, 7, 6],
  [6, 7, 3, 1],
  [5, 5, 0, 8],
  [1, 8, 4, 0],
  [1, 3, 7, 2],
  [2, 0, 7, 3],
  [0, 6, 8, 3],
  [1, 5, 5, 2],
  [4, 4, 4, 6],
  [],
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

  it('cycles through the hardest settings after the chapters, forever', () => {
    const afterChapters = (offset) => levelSettings(CHAPTER_LEVEL_COUNT + offset);
    expect(MASTER_SETTINGS.map((_, i) => afterChapters(i + 1))).toEqual(MASTER_SETTINGS);
    expect(afterChapters(MASTER_SETTINGS.length + 1)).toEqual(MASTER_SETTINGS[0]);
    expect(levelSettings(100_000)).toEqual(
      MASTER_SETTINGS[(100_000 - 61) % MASTER_SETTINGS.length]
    );
  });

  it('keeps the first master settings, so the master levels already played stay the same', () => {
    expect(
      MASTER_SETTINGS.slice(0, 4).map(({ colorCount, emptyTubeCount }) => [
        colorCount,
        emptyTubeCount
      ])
    ).toEqual([
      [9, 2],
      [6, 1],
      [10, 2],
      [7, 1]
    ]);
  });

  it('keeps the special rules to the master levels', () => {
    for (let level = 1; level <= CHAPTER_LEVEL_COUNT; level++) {
      expect(levelSettings(level)).toMatchObject({
        capacity: 4,
        hiddenColors: false,
        halfTubeCount: 0,
        undoLimit: null
      });
    }
    expect(MASTER_SETTINGS.some((settings) => settings.hiddenColors)).toBe(true);
    expect(MASTER_SETTINGS.some((settings) => settings.capacity === 5)).toBe(true);
    expect(MASTER_SETTINGS.some((settings) => settings.halfTubeCount === 1)).toBe(true);
    expect(MASTER_SETTINGS.every((settings) => settings.undoLimit === 3)).toBe(true);
  });

  it('never hides colors on a board with oil', () => {
    // Water sinking under oil would move units that are still hidden.
    expect(MASTER_SETTINGS.some((s) => s.oilColorCount > 0 && s.hiddenColors)).toBe(false);
  });

  it('never needs more colors than the maximum', () => {
    for (let level = 1; level <= CHAPTER_LEVEL_COUNT + MASTER_SETTINGS.length; level++) {
      expect(levelSettings(level).colorCount).toBeLessThanOrEqual(MAX_COLOR_COUNT);
    }
  });
});

describe('rulesFirstUsedAt', () => {
  it('names the special rules at the first level that uses them', () => {
    expect(rulesFirstUsedAt(61)).toEqual(['limitedUndo']);
    expect(rulesFirstUsedAt(65)).toEqual(['hiddenColors']);
    expect(rulesFirstUsedAt(66)).toEqual(['tallTubes']);
    expect(rulesFirstUsedAt(67)).toEqual(['halfTube']);
    expect(rulesFirstUsedAt(73)).toEqual(['oneWayTube']);
    expect(rulesFirstUsedAt(74)).toEqual(['crackedTube']);
    expect(rulesFirstUsedAt(75)).toEqual(['lockedTube']);
    expect(rulesFirstUsedAt(76)).toEqual(['oil']);
    for (const level of [1, 60, 62, 68, 70, 72, 77, 79, 81, 93]) {
      expect(rulesFirstUsedAt(level)).toEqual([]);
    }
  });
});

describe('chapterIdOfLevel', () => {
  it('groups the levels in chapters, then master levels', () => {
    expect([1, 15, 16, 30, 46, 60, 61, 5000].map(chapterIdOfLevel)).toEqual([
      'easy',
      'easy',
      'medium',
      'medium',
      'expert',
      'expert',
      'master',
      'master'
    ]);
  });
});

describe('generatePuzzle', () => {
  it('deals the same puzzle for the same seed', () => {
    expect(generatePuzzle(123, { colorCount: 5 }).tubes).toEqual(
      generatePuzzle(123, { colorCount: 5 }).tubes
    );
  });

  it('deals full tubes of every color plus two empty ones', () => {
    const { tubes } = generatePuzzle(99, { colorCount: 6 });

    expect(tubes).toHaveLength(8);
    expect(tubes.slice(6)).toEqual([[], []]);
    expect([...countUnits(tubes).values()]).toEqual(Array(6).fill(TUBE_CAPACITY));
  });

  it('deals only solvable puzzles that do not start half sorted', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { tubes } = generatePuzzle(seed, { colorCount: 4 });
      expect(solve(tubes)).not.toBeNull();
      expect(tubes.every((tube) => topRun(tube).count < 3)).toBe(true);
    }
  });
});

describe('level and daily puzzles', () => {
  // Players share and compare levels, so a release must never change an existing level.
  it('keeps level layouts stable across releases', () => {
    expect(createLevelPuzzle(1).tubes).toEqual([[1, 0, 1, 2], [0, 2, 1, 2], [1, 0, 0, 2], [], []]);
    expect(createLevelPuzzle(46).tubes).toEqual(PINNED_LEVEL_46);
    expect(createLevelPuzzle(61).tubes).toEqual(PINNED_LEVEL_61);
  });

  it('deals every level with its settings, and every level can be solved', () => {
    // All chapter levels and the first few blocks of master levels.
    for (let level = 1; level <= CHAPTER_LEVEL_COUNT + 40; level++) {
      const { tubes, board } = createLevelPuzzle(level);
      const settings = levelSettings(level);
      const { colorCount, emptyTubeCount, halfTubeCount, capacity } = settings;
      const emptyCount =
        emptyTubeCount + halfTubeCount + settings.oneWayTubeCount + settings.crackedTubeCount;
      expect(countUnits(tubes).size).toBe(colorCount);
      expect(new Set(countUnits(tubes).values())).toEqual(new Set([capacity]));
      expect(tubes.filter((tube) => tube.length === 0)).toHaveLength(emptyCount);
      expect(tubes.map((_, i) => board.sizeOf(i))).toEqual(tubeSizes(settings));
      expect(solve(tubes, { board })).not.toBeNull();
    }
  });

  it("moves on to another seed when a level's own seed deals no solvable puzzle", () => {
    // Level 924 has seven colors and one empty tube, and its own seed deals no solvable board.
    const settings = levelSettings(924);
    expect(settings).toMatchObject({ colorCount: 7, emptyTubeCount: 1, capacity: 4 });
    expect(generatePuzzle(hashString('level-924'), settings)).toBeNull();

    const { tubes } = createLevelPuzzle(924);
    expect(tubes).toEqual(createLevelPuzzle(924).tubes);
    expect(countUnits(tubes).size).toBe(7);
    expect(solve(tubes)).not.toBeNull();
  });

  it('keeps daily layouts stable across releases', () => {
    expect(createDailyPuzzle('2026-10-09').tubes).toEqual([
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
    expect(countUnits(createDailyPuzzle('2026-01-01').tubes).size).toBe(DAILY_COLOR_COUNT);
  });
});

import { describe, expect, it } from 'vitest';
import { generatePuzzle, tubeSizes } from '../src/game/generator.js';
import {
  BOARD_RULES,
  createDailyPuzzle,
  createLevelPuzzle,
  dailySettings,
  dealPuzzle,
  isMasterLevel,
  levelCountOf,
  levelSettings,
  LEVEL_COUNT,
  MASTER_STAGE,
  MAX_COLOR_COUNT,
  rulesFirstUsedAt,
  specialRules,
  STAGE_LEVEL_COUNT,
  STAGE_STARTS,
  stageOfLevel,
  STAGES
} from '../src/game/levels.js';
import { createRandom, hashString } from '../src/game/random.js';
import { topRun, TUBE_CAPACITY } from '../src/game/rules.js';
import { solve } from '../src/game/solver.js';

// The first one-way level and the first master level, written out by hand so a change to the
// dealing shows up here.
const PINNED_LEVEL_16 = [
  [0, 2, 3, 1],
  [1, 3, 4, 2],
  [3, 1, 0, 0],
  [1, 2, 3, 4],
  [2, 0, 4, 4],
  [],
  []
];
const PINNED_LEVEL_261 = [
  [1, 2, 3, 2, 0],
  [1, 4, 3, 0, 0],
  [2, 3, 4, 1, 0],
  [2, 3, 4, 1, 0],
  [3, 4, 1, 4, 2],
  [],
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

describe('stages', () => {
  const settingsOf = (levels) => levels.map(levelSettings);
  const rulesOf = (level) => specialRules(levelSettings(level));

  it('follow the plan: where each stage starts, and its undo limit', () => {
    expect(STAGES.map((stage) => stage.id)).toEqual([
      'easy',
      'oneWay',
      'tall',
      'hidden',
      'cracked',
      'locked',
      'half',
      'oil'
    ]);
    expect(STAGE_STARTS).toEqual([1, 16, 36, 61, 91, 126, 166, 211]);
    expect(STAGE_LEVEL_COUNT).toBe(260);
    expect(STAGES.map((stage) => stage.undoLimit)).toEqual([null, 4, 4, 3, 3, 3, 3, 3]);
    expect(levelSettings(261).undoLimit).toBe(3);
    expect(stageOfLevel(260).id).toBe('oil');
    expect(stageOfLevel(261)).toBe(MASTER_STAGE);
  });

  it('keep the easy stage plain, with three colors and then four and five', () => {
    expect(settingsOf([1, 5, 6, 10, 11, 15]).map((s) => s.colorCount)).toEqual([3, 3, 4, 4, 5, 5]);
    for (let level = 1; level <= 15; level++) expect(rulesOf(level)).toEqual([]);
  });

  it('bring in each stage rule on its own for the first five levels', () => {
    STAGES.slice(1).forEach((stage, i) => {
      const first = STAGE_STARTS[i + 1];
      for (let level = first; level < first + 5; level++) {
        expect(rulesOf(level)).toEqual(['limitedUndo', stage.rule]);
      }
    });
  });

  it('use the stage rule in every level of the stage', () => {
    for (let level = 16; level <= STAGE_LEVEL_COUNT; level++) {
      expect(rulesOf(level)).toContain(stageOfLevel(level).rule);
    }
  });

  it('mix in only rules of earlier stages', () => {
    for (let level = 16; level <= STAGE_LEVEL_COUNT; level++) {
      const stageRank = BOARD_RULES.indexOf(stageOfLevel(level).rule);
      for (const rule of rulesOf(level).filter((r) => r !== 'limitedUndo')) {
        expect(BOARD_RULES.indexOf(rule)).toBeLessThanOrEqual(stageRank);
      }
    }
  });

  it('follow the parts of the plan', () => {
    // 41–50: tall tubes with one-way tubes; 76–90: hidden with both earlier rules.
    expect(rulesOf(45)).toEqual(['limitedUndo', 'oneWayTube', 'tallTubes']);
    expect(rulesOf(80)).toEqual(['limitedUndo', 'oneWayTube', 'tallTubes', 'hiddenColors']);
    // 146–165: two locks.
    expect(levelSettings(150).lockedTubeCount).toBe(2);
    // 171–190: half tubes with tall tubes.
    expect(rulesOf(180)).toEqual(['limitedUndo', 'tallTubes', 'halfTube']);
    // 236–260: oil with two or three earlier rules.
    for (let level = 236; level <= 260; level++) {
      expect(rulesOf(level).length - 2).toBeGreaterThanOrEqual(2);
    }
  });

  it('has 300 levels, the last 40 of them master levels', () => {
    expect(LEVEL_COUNT).toBe(300);
    expect(levelCountOf(MASTER_STAGE)).toBe(40);
    expect(isMasterLevel(260)).toBe(false);
    expect(isMasterLevel(300)).toBe(true);
  });

  it('mix three or four rules into every master level, the same for everyone', () => {
    for (let level = 261; level <= LEVEL_COUNT; level++) {
      const count = rulesOf(level).filter((rule) => rule !== 'limitedUndo').length;
      expect(count).toBeGreaterThanOrEqual(3);
      expect(count).toBeLessThanOrEqual(4);
    }
    expect(levelSettings(5000)).toEqual(levelSettings(5000));
  });

  it('keep two spare tubes, and one plain empty tube next to a lock or oil', () => {
    for (let level = 1; level <= LEVEL_COUNT; level++) {
      const s = levelSettings(level);
      const spare = s.emptyTubeCount + s.oneWayTubeCount + s.crackedTubeCount + s.halfTubeCount;
      expect(spare).toBeGreaterThanOrEqual(2);
      if (s.lockedTubeCount > 0 || s.oilColorCount > 0) {
        expect(s.emptyTubeCount).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('never need more colors than the maximum', () => {
    for (let level = 1; level <= LEVEL_COUNT; level++) {
      expect(levelSettings(level).colorCount).toBeLessThanOrEqual(MAX_COLOR_COUNT);
    }
  });
});

describe('rulesFirstUsedAt', () => {
  it('names the stage rule and a new undo limit at the first level of a stage, and only there', () => {
    expect(rulesFirstUsedAt(16)).toEqual(['limitedUndo', 'oneWayTube']);
    expect(rulesFirstUsedAt(36)).toEqual(['tallTubes']);
    expect(rulesFirstUsedAt(61)).toEqual(['limitedUndo', 'hiddenColors']);
    expect(rulesFirstUsedAt(211)).toEqual(['oil']);
    for (const level of [1, 2, 17, 60, 62, 260, 261, 300]) {
      expect(rulesFirstUsedAt(level)).toEqual([]);
    }
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
    expect(createLevelPuzzle(16).tubes).toEqual(PINNED_LEVEL_16);
    expect(createLevelPuzzle(261).tubes).toEqual(PINNED_LEVEL_261);
  });

  it('deals every level with its settings, and every level can be solved', () => {
    // Every stage level and the first few blocks of master levels.
    for (let level = 1; level <= STAGE_LEVEL_COUNT + 40; level++) {
      const { tubes, board } = createLevelPuzzle(level);
      const settings = levelSettings(level);
      const { colorCount, emptyTubeCount, halfTubeCount, capacity } = settings;
      const emptyCount =
        emptyTubeCount + halfTubeCount + settings.oneWayTubeCount + settings.crackedTubeCount;
      expect(countUnits(tubes).size).toBe(colorCount);
      expect(new Set(countUnits(tubes).values())).toEqual(new Set([capacity]));
      expect(tubes.filter((tube) => tube.length === 0)).toHaveLength(emptyCount);
      expect(tubes.map((_, i) => board.sizeOf(i))).toEqual(tubeSizes(settings));
      expect(board.oneWay.size).toBe(settings.oneWayTubeCount);
      expect(board.cracked.size).toBe(settings.crackedTubeCount);
      expect(board.locks.size).toBe(settings.lockedTubeCount);
      expect(board.oilColors.size).toBe(settings.oilColorCount);
      expect(solve(tubes, { board })).not.toBeNull();
    }
  });

  it("moves on to another seed when a key's own seed deals no solvable puzzle", () => {
    // Seven colors and one empty tube from the seed of "level-924" never make a solvable board.
    const settings = { ...levelSettings(1), colorCount: 7, emptyTubeCount: 1 };
    expect(generatePuzzle(hashString('level-924'), settings)).toBeNull();

    const { tubes } = dealPuzzle('level-924', settings);
    expect(tubes).toEqual(dealPuzzle('level-924', settings).tubes);
    expect(countUnits(tubes).size).toBe(7);
    expect(solve(tubes)).not.toBeNull();
  });

  it('keeps daily layouts stable across releases', () => {
    // The daily puzzle has dealt with rules since 2026-10-25; this one is a tall-tube day.
    expect(createDailyPuzzle('2026-10-09').tubes).toEqual([
      [2, 4, 0, 3, 2],
      [1, 4, 2, 5, 2],
      [0, 1, 3, 4, 3],
      [3, 0, 4, 5, 5],
      [5, 1, 0, 2, 3],
      [0, 5, 1, 1, 4],
      [],
      []
    ]);
  });

  it('deals every daily puzzle with one or two rules, the same on every device', () => {
    for (let day = 0; day < 400; day++) {
      const key = new Date(Date.UTC(2026, 9, 25 + day)).toISOString().slice(0, 10);
      const rules = specialRules(dailySettings(key)).filter((rule) => rule !== 'limitedUndo');
      expect(rules.length).toBeGreaterThanOrEqual(1);
      expect(rules.length).toBeLessThanOrEqual(2);
      expect(dailySettings(key).colorCount).toBeGreaterThanOrEqual(5);
      const { tubes } = createDailyPuzzle(key);
      expect(countUnits(tubes).size).toBe(dailySettings(key).colorCount);
      expect(createDailyPuzzle(key).tubes).toEqual(tubes);
    }
  });
});

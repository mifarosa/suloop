import { describe, expect, it } from 'vitest';
import { localDateKey } from '../src/app/calendar.js';
import { INITIAL_HINTS } from '../src/app/economy.js';
import {
  INITIAL_PROGRESS,
  lastOpenLevel,
  loadProgress,
  normalizeProgress,
  saveProgress
} from '../src/app/progress.js';

function memoryStorage() {
  const items = new Map();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, String(value))
  };
}

describe('normalizeProgress', () => {
  it('keeps valid progress', () => {
    const progress = {
      mode: 'daily',
      solved: 7,
      current: 3,
      dailyDone: '2026-10-09',
      hints: 0,
      spareUndos: 4,
      records: {
        3: {
          best: 3,
          attempts: [
            { moves: 14, stars: 2 },
            { moves: 12, stars: 3 }
          ]
        }
      }
    };
    expect(normalizeProgress(progress)).toEqual(progress);
  });

  it('gives saves from before hints were counted the hints of a new player', () => {
    expect(normalizeProgress({ solved: 40, current: 41 })).toMatchObject({
      hints: INITIAL_HINTS,
      spareUndos: 0,
      records: {}
    });
  });

  it('trims a stock of spare undos saved before it had a limit', () => {
    expect(normalizeProgress({ spareUndos: 40 }).spareUndos).toBe(9);
  });

  it('drops records that make no sense', () => {
    const records = {
      0: { best: 3, attempts: [] },
      x: { best: 3, attempts: [] },
      2: {
        best: 9,
        attempts: [
          { moves: -1, stars: 2 },
          { moves: 20, stars: 2 }
        ]
      },
      5: { best: 0, attempts: [] },
      7: 'three stars',
      8: {
        best: 1,
        attempts: Array.from({ length: 8 }, (_, i) => ({ moves: 30 - i, stars: 1 }))
      }
    };
    expect(normalizeProgress({ records }).records).toEqual({
      2: { best: 2, attempts: [{ moves: 20, stars: 2 }] },
      8: { best: 1, attempts: [27, 26, 25, 24, 23].map((moves) => ({ moves, stars: 1 })) }
    });
  });

  it('replaces invalid fields with the initial values', () => {
    expect(normalizeProgress({ mode: 'race', solved: -2, current: 'x', dailyDone: 5 })).toEqual(
      INITIAL_PROGRESS
    );
    expect(normalizeProgress({ solved: 2.5 }).solved).toBe(0);
    expect(normalizeProgress(null)).toEqual(INITIAL_PROGRESS);
  });

  it('never lets the current level be a locked one', () => {
    expect(normalizeProgress({ solved: 4, current: 9 }).current).toBe(5);
    expect(normalizeProgress({ solved: 4, current: 0 }).current).toBe(1);
  });

  it('has no last level', () => {
    expect(normalizeProgress({ solved: 900, current: 901 })).toMatchObject({
      solved: 900,
      current: 901
    });
  });

  it('reads saves from before the level list, which kept only the next level', () => {
    expect(normalizeProgress({ mode: 'level', level: 7, dailyDone: null })).toEqual({
      ...INITIAL_PROGRESS,
      mode: 'level',
      solved: 6,
      current: 7,
      dailyDone: null
    });
  });
});

describe('lastOpenLevel', () => {
  it('opens one level past the solved ones', () => {
    expect(lastOpenLevel({ solved: 0 })).toBe(1);
    expect(lastOpenLevel({ solved: 120 })).toBe(121);
  });
});

describe('loadProgress and saveProgress', () => {
  it('round-trips progress through storage', () => {
    const storage = memoryStorage();
    const progress = {
      ...INITIAL_PROGRESS,
      solved: 12,
      current: 4,
      dailyDone: '2026-10-08',
      hints: 5,
      records: { 4: { best: 2, attempts: [{ moves: 19, stars: 2 }] } }
    };
    saveProgress(progress, storage);
    expect(loadProgress(storage)).toEqual(progress);
  });

  it('never lowers the solved levels another tab has saved', () => {
    const storage = memoryStorage();
    saveProgress({ mode: 'level', solved: 90, current: 91, dailyDone: null }, storage);
    // A tab that was opened earlier still thinks 79 levels are solved.
    saveProgress({ mode: 'level', solved: 79, current: 12, dailyDone: '2026-10-12' }, storage);

    expect(loadProgress(storage)).toEqual({
      ...INITIAL_PROGRESS,
      mode: 'level',
      solved: 90,
      current: 12,
      dailyDone: '2026-10-12'
    });
  });

  it('starts fresh when nothing or something unreadable is stored', () => {
    const storage = memoryStorage();
    expect(loadProgress(storage)).toEqual(INITIAL_PROGRESS);

    storage.setItem('suloop:progress:v1', '{not json');
    expect(loadProgress(storage)).toEqual(INITIAL_PROGRESS);
  });

  it('keeps working when storage is unavailable or throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      }
    };
    expect(loadProgress(null)).toEqual(INITIAL_PROGRESS);
    expect(loadProgress(broken)).toEqual(INITIAL_PROGRESS);
    expect(() => saveProgress(INITIAL_PROGRESS, broken)).not.toThrow();
  });
});

describe('localDateKey', () => {
  it('formats the local date with zero padding', () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

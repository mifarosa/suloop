import { describe, expect, it } from 'vitest';
import { localDateKey } from '../src/app/calendar.js';
import {
  INITIAL_PROGRESS,
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
    const progress = { mode: 'daily', level: 7, dailyDone: '2026-10-09' };
    expect(normalizeProgress(progress)).toEqual(progress);
  });

  it('replaces invalid fields with the initial values', () => {
    expect(normalizeProgress({ mode: 'race', level: -2, dailyDone: 5 })).toEqual(INITIAL_PROGRESS);
    expect(normalizeProgress({ level: 2.5 }).level).toBe(1);
    expect(normalizeProgress(null)).toEqual(INITIAL_PROGRESS);
  });
});

describe('loadProgress and saveProgress', () => {
  it('round-trips progress through storage', () => {
    const storage = memoryStorage();
    saveProgress({ mode: 'level', level: 12, dailyDone: '2026-10-08' }, storage);
    expect(loadProgress(storage)).toEqual({ mode: 'level', level: 12, dailyDone: '2026-10-08' });
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

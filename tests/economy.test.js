import { describe, expect, it } from 'vitest';
import {
  MAX_SPARE_UNDOS,
  recordDailyWin,
  recordLevelWin,
  spendHint,
  spendSpareUndo
} from '../src/app/economy.js';
import { INITIAL_PROGRESS } from '../src/app/progress.js';

const start = () => ({ ...INITIAL_PROGRESS });
const limited = { limitedUndo: true };

describe('hints', () => {
  it('starts with two and costs one each', () => {
    let progress = start();
    expect(progress.hints).toBe(2);
    progress = spendHint(progress);
    progress = spendHint(progress);
    expect(progress.hints).toBe(0);
    expect(spendHint(progress)).toBeNull();
  });

  it('earns one for the daily puzzle, once a day', () => {
    let { progress, earnedHint } = recordDailyWin(start(), '2026-10-12');
    expect(earnedHint).toBe(true);
    expect(progress).toMatchObject({ hints: 3, dailyDone: '2026-10-12' });

    ({ progress, earnedHint } = recordDailyWin(progress, '2026-10-12'));
    expect(earnedHint).toBe(false);
    expect(progress.hints).toBe(3);

    ({ progress, earnedHint } = recordDailyWin(progress, '2026-10-13'));
    expect(earnedHint).toBe(true);
    expect(progress.hints).toBe(4);
  });
});

describe('level records', () => {
  it('keeps the best stars and the last five solutions', () => {
    let progress = start();
    for (const [moves, stars] of [
      [30, 1],
      [24, 2],
      [21, 3],
      [26, 2],
      [33, 1],
      [28, 1]
    ]) {
      ({ progress } = recordLevelWin(progress, 7, { moves, stars }, limited));
    }
    expect(progress.records[7]).toEqual({
      best: 3,
      attempts: [
        { moves: 24, stars: 2 },
        { moves: 21, stars: 3 },
        { moves: 26, stars: 2 },
        { moves: 33, stars: 1 },
        { moves: 28, stars: 1 }
      ]
    });
  });

  it('earns a spare undo for the first three-star solution of a level only', () => {
    let { progress, earnedUndo } = recordLevelWin(start(), 4, { moves: 15, stars: 2 }, limited);
    expect(earnedUndo).toBe(false);

    ({ progress, earnedUndo } = recordLevelWin(progress, 4, { moves: 12, stars: 3 }, limited));
    expect(earnedUndo).toBe(true);
    expect(progress.spareUndos).toBe(1);

    ({ progress, earnedUndo } = recordLevelWin(progress, 4, { moves: 12, stars: 3 }, limited));
    expect(earnedUndo).toBe(false);
    expect(progress.spareUndos).toBe(1);

    ({ progress, earnedUndo } = recordLevelWin(progress, 5, { moves: 9, stars: 3 }, limited));
    expect(earnedUndo).toBe(true);
    expect(progress.spareUndos).toBe(2);
  });

  it('earns no spare undo where undos are unlimited, though it keeps the record', () => {
    const { progress, earnedUndo } = recordLevelWin(
      start(),
      3,
      { moves: 9, stars: 3 },
      { limitedUndo: false }
    );
    expect(earnedUndo).toBe(false);
    expect(progress.spareUndos).toBe(0);
    expect(progress.records[3]).toEqual({ best: 3, attempts: [{ moves: 9, stars: 3 }] });
  });

  it('keeps at most five spare undos', () => {
    const full = { ...start(), spareUndos: MAX_SPARE_UNDOS };
    const { progress, earnedUndo } = recordLevelWin(full, 8, { moves: 12, stars: 3 }, limited);
    expect(MAX_SPARE_UNDOS).toBe(5);
    expect(earnedUndo).toBe(false);
    expect(progress.spareUndos).toBe(5);
    expect(progress.records[8].best).toBe(3);
  });

  it('spends spare undos one at a time', () => {
    const progress = { ...start(), spareUndos: 1 };
    expect(spendSpareUndo(progress).spareUndos).toBe(0);
    expect(spendSpareUndo(spendSpareUndo(progress))).toBeNull();
  });
});

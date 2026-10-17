import { describe, expect, it } from 'vitest';
import { docToState, mergeProgress, stateToDoc } from '../src/app/cloudProgress.js';
import { INITIAL_PROGRESS } from '../src/app/progress.js';

const progress = (changes = {}) => ({ ...INITIAL_PROGRESS, ...changes });
const state = (changes = {}, daily = {}) => ({ progress: progress(changes), daily });
const attempts = (...stars) => stars.map((s, i) => ({ moves: 10 + i, stars: s }));

const far = () =>
  state(
    {
      solved: 130,
      current: 131,
      dailyDone: '2026-10-12',
      hints: 7,
      spareUndos: 3,
      records: {
        1: { best: 3, attempts: attempts(1, 2, 3) },
        2: { best: 1, attempts: attempts(1) },
        130: { best: 3, attempts: attempts(3) }
      }
    },
    {
      '2026-10-11': { moves: 30, seconds: 210, stars: 1 },
      '2026-10-12': { moves: 23, seconds: 95, stars: 2 }
    }
  );

describe('the progress document', () => {
  it('carries where the player is, their stock, the records and the daily results', () => {
    const doc = stateToDoc(far());
    expect(doc).toMatchObject({
      solved: 130,
      current: 131,
      hints: 7,
      spareUndos: 3,
      dailyDone: '2026-10-12'
    });
    expect(doc.records[1]).toEqual({ best: 3, attempts: attempts(1, 2, 3) });
    expect(doc.daily['2026-10-12']).toEqual({ moves: 23, seconds: 95, stars: 2 });
  });

  it('keeps the last five solutions of a level and the last sixty days', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ moves: 10 + i, stars: 2 }));
    const days = {};
    for (let i = 0; i < 70; i++) {
      days[
        `2026-${String(1 + Math.floor(i / 28)).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`
      ] = { moves: 5, seconds: 5, stars: 3 };
    }
    const doc = stateToDoc(state({ solved: 1, records: { 1: { best: 2, attempts: many } } }, days));
    expect(doc.records[1].attempts).toEqual(many.slice(-5));
    expect(Object.keys(doc.daily)).toHaveLength(60);
  });

  it('drops the marks of the device a daily result carries', () => {
    const doc = stateToDoc(
      state({}, { '2026-10-12': { moves: 9, seconds: 40, stars: 3, shared: true } })
    );
    expect(doc.daily['2026-10-12']).toEqual({ moves: 9, seconds: 40, stars: 3 });
  });

  it('reads back what was stored, and nothing when there is no document', () => {
    expect(docToState(null)).toBeNull();
    const read = docToState(stateToDoc(far()));
    expect(read.progress).toMatchObject({ solved: 130, current: 131, hints: 7, mode: 'level' });
    expect(read.progress.records[1].attempts).toHaveLength(3);
    expect(read.daily['2026-10-11']).toEqual({ moves: 30, seconds: 210, stars: 1 });
  });

  it('turns down damaged fields instead of breaking the game', () => {
    const read = docToState({
      solved: 'many',
      hints: -4,
      records: { 3: { best: 9, attempts: 'x' } },
      daily: { 'not a day': { moves: 1, seconds: 1, stars: 1 }, '2026-10-12': { moves: 0 } }
    });
    expect(read.progress.solved).toBe(0);
    expect(read.progress.hints).toBeGreaterThanOrEqual(0);
    expect(read.daily).toEqual({});
  });
});

describe('merging this device and the account', () => {
  it('takes everything on a device that has nothing', () => {
    const merged = mergeProgress(state(), far());
    expect(merged.changed).toBe(true);
    expect(merged.progress).toMatchObject({
      solved: 130,
      current: 131,
      hints: 7,
      spareUndos: 3,
      dailyDone: '2026-10-12',
      mode: 'level'
    });
    expect(merged.progress.records[130].best).toBe(3);
    expect(merged.daily['2026-10-11']).toBeDefined();
  });

  it('never lowers anything on a device that is further along, but adds what it lacks', () => {
    const local = state(
      {
        solved: 200,
        current: 150,
        hints: 0,
        spareUndos: 0,
        dailyDone: '2026-10-13',
        records: { 1: { best: 2, attempts: attempts(2) } }
      },
      { '2026-10-12': { moves: 20, seconds: 50, stars: 3, shared: true } }
    );
    const merged = mergeProgress(local, far());

    expect(merged.progress).toMatchObject({ solved: 200, current: 150, hints: 0, spareUndos: 0 });
    expect(merged.progress.dailyDone).toBe('2026-10-13');
    // The better stars come in; of the solutions the longer list stays.
    expect(merged.progress.records[1]).toEqual({ best: 3, attempts: attempts(1, 2, 3) });
    expect(merged.progress.records[130].best).toBe(3);
    // This device's own result of a day wins, with its marks.
    expect(merged.daily['2026-10-12']).toEqual(local.daily['2026-10-12']);
    expect(merged.daily['2026-10-11']).toBeDefined();
  });

  it('keeps this device’s own solutions of a level when it has as many', () => {
    const local = state({ solved: 5, records: { 2: { best: 1, attempts: attempts(1) } } });
    const remote = state({ solved: 5, records: { 2: { best: 1, attempts: attempts(1) } } });
    expect(mergeProgress(local, remote).changed).toBe(false);
  });

  it('reports no change when the account adds nothing', () => {
    const local = far();
    expect(mergeProgress(local, far()).changed).toBe(false);
    expect(mergeProgress(local, null)).toMatchObject({ changed: false });
  });

  it('leaves the daily puzzle for the levels only when the account is further along', () => {
    const daily = state({ mode: 'daily', solved: 3, current: 4 });
    expect(mergeProgress(daily, state({ solved: 3 })).progress.mode).toBe('daily');
    expect(mergeProgress(daily, far()).progress.mode).toBe('level');
  });
});

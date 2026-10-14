import { describe, expect, it } from 'vitest';
import { INITIAL_PROGRESS } from '../src/app/progress.js';
import { decodeSnapshot, encodeSnapshot, mergeSnapshot } from '../src/app/progressSnapshot.js';

const progress = (changes = {}) => ({ ...INITIAL_PROGRESS, ...changes });
const sample = () =>
  progress({
    solved: 130,
    current: 131,
    dailyDone: '2026-10-12',
    hints: 7,
    spareUndos: 3,
    records: {
      1: { best: 3, attempts: [] },
      2: { best: 1, attempts: [] },
      129: { best: 2, attempts: [] },
      130: { best: 3, attempts: [] }
    }
  });
const dailyResults = () => ({
  '2026-10-11': { moves: 30, seconds: 210, stars: 1 },
  '2026-10-12': { moves: 23, seconds: 95, stars: 2 }
});

describe('progress snapshots', () => {
  it('carry the solved levels, stars, hints, spare undos and daily results exactly', () => {
    const snapshot = decodeSnapshot(encodeSnapshot(sample(), dailyResults()));
    expect(snapshot).toMatchObject({
      solved: 130,
      hints: 7,
      spareUndos: 3,
      dailyDone: '2026-10-12',
      daily: dailyResults()
    });
    expect(snapshot.bests).toHaveLength(130);
    expect(snapshot.bests[0]).toBe(3);
    expect(snapshot.bests[1]).toBe(1);
    expect(snapshot.bests[2]).toBe(0);
    expect(snapshot.bests.slice(128)).toEqual([2, 3]);
  });

  it('fit in a link a few hundred characters long', () => {
    expect(encodeSnapshot(sample(), dailyResults()).length).toBeLessThan(150);
    expect(encodeSnapshot(progress({ solved: 300 }), {}).length).toBeLessThan(150);
  });

  it('are read from a whole link too', () => {
    const code = encodeSnapshot(sample(), dailyResults());
    expect(decodeSnapshot(`https://mifarosa.com/suloop/#ilerleme=${code}`)?.solved).toBe(130);
  });

  it('turn down anything that was mistyped or made up', () => {
    const code = encodeSnapshot(sample(), dailyResults());
    const flipped = `${code.slice(0, 10)}${code[10] === 'A' ? 'B' : 'A'}${code.slice(11)}`;
    for (const text of ['', '2FQ7M', 'not a code!', code.slice(0, -2), flipped, `${code}AA`]) {
      expect(decodeSnapshot(text), text).toBeNull();
    }
  });

  it('keep at most the spare undos a player may have', () => {
    const code = encodeSnapshot(progress({ solved: 5, spareUndos: 80 }), {});
    expect(decodeSnapshot(code).spareUndos).toBe(5);
  });
});

describe('taking a snapshot into progress', () => {
  const snapshot = () => decodeSnapshot(encodeSnapshot(sample(), dailyResults()));

  it('restores everything on a device that lost its data', () => {
    const { progress: merged, daily, changed } = mergeSnapshot(progress(), {}, snapshot());
    expect(changed).toBe(true);
    expect(merged).toMatchObject({
      solved: 130,
      current: 131,
      hints: 7,
      spareUndos: 3,
      dailyDone: '2026-10-12',
      mode: 'level'
    });
    expect(merged.records[130].best).toBe(3);
    expect(merged.records[2].best).toBe(1);
    expect(daily).toEqual(dailyResults());
  });

  it('never lowers anything on a device that is further along, but adds what it lacks', () => {
    const local = progress({
      solved: 200,
      current: 150,
      hints: 0,
      spareUndos: 0,
      dailyDone: '2026-10-13',
      records: { 1: { best: 2, attempts: [{ moves: 9, stars: 2 }] } }
    });
    const localDaily = { '2026-10-12': { moves: 20, seconds: 50, stars: 3, shared: true } };
    const { progress: merged, daily } = mergeSnapshot(local, localDaily, snapshot());

    expect(merged).toMatchObject({ solved: 200, current: 150, hints: 0, spareUndos: 0 });
    expect(merged.dailyDone).toBe('2026-10-13');
    // The better stars come in, and the attempts stay.
    expect(merged.records[1]).toEqual({ best: 3, attempts: [{ moves: 9, stars: 2 }] });
    expect(merged.records[130].best).toBe(3);
    // This device's own result of a day wins over the other one's.
    expect(daily['2026-10-12']).toEqual(localDaily['2026-10-12']);
    expect(daily['2026-10-11']).toEqual(dailyResults()['2026-10-11']);
  });

  it('reports no change for a snapshot that adds nothing', () => {
    const local = sample();
    const { changed } = mergeSnapshot(local, dailyResults(), snapshot());
    expect(changed).toBe(false);
  });

  it('takes a short code, which carries only the solved levels', () => {
    const shortCode = {
      solved: 40,
      hints: null,
      spareUndos: null,
      bests: [],
      dailyDone: null,
      daily: {}
    };
    const { progress: merged } = mergeSnapshot(progress({ hints: 1 }), {}, shortCode);
    expect(merged).toMatchObject({ solved: 40, current: 41, hints: 1 });
  });
});

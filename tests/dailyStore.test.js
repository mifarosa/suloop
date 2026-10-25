import { describe, expect, it, vi } from 'vitest';
import { createDailyStore } from '../src/cloud/dailyStore.js';
import { rankKey } from '../src/game/dailyScore.js';

function fakeLoad({ uid = 'u1', existing = false, rows = [], count = 0 } = {}) {
  const writes = [];
  const store = {
    collection: (db, ...parts) => ({ path: parts.join('/') }),
    doc: (db, ...parts) => ({ path: parts.join('/') }),
    getDoc: vi.fn(async () => ({
      exists: () => existing !== false,
      data: () => ({ v: existing === 'old' ? 1 : 2 })
    })),
    serverTimestamp: () => 'NOW',
    writeBatch: () => ({
      set: (ref, value) => writes.push([ref.path, value]),
      commit: vi.fn(async () => writes.push(['commit']))
    }),
    orderBy: (field, dir) => ({ orderBy: [field, dir] }),
    limit: (n) => ({ limit: n }),
    where: (field, op, value) => ({ where: [field, op, value] }),
    query: (source, ...parts) => ({ source, parts }),
    getDocs: vi.fn(async () => ({ docs: rows.map((row) => ({ data: () => row })) })),
    getCountFromServer: vi.fn(async () => ({ data: () => ({ count }) }))
  };
  const load = async () => ({ auth: { currentUser: uid ? { uid } : null }, db: {}, store });
  return { load, writes, store };
}

const entry = {
  day: '2026-10-12',
  name: 'ayse',
  moves: 21,
  seconds: 95,
  stars: 3,
  score: 990,
  hints: 0,
  log: [[0, 1]]
};

describe('daily store', () => {
  it('writes the score with its rank key, and the moves beside it', async () => {
    const { load, writes } = fakeLoad();
    await createDailyStore({ load }).submit(entry);
    expect(writes[0]).toEqual([
      'daily/2026-10-12/scores/u1',
      {
        username: 'ayse',
        moves: 21,
        seconds: 95,
        stars: 3,
        score: 990,
        rank: rankKey(990, 95),
        createdAt: 'NOW',
        v: 2
      }
    ]);
    expect(writes[1][0]).toBe('dailyMoves/2026-10-12_u1');
    expect(writes[1][1]).toMatchObject({ moves: [[0, 1]], hints: 0 });
  });

  it('sends nothing when the score is there already, and needs a signed in player', async () => {
    const there = fakeLoad({ existing: true });
    await createDailyStore({ load: there.load }).submit(entry);
    expect(there.writes).toEqual([]);

    const out = fakeLoad({ uid: null });
    await expect(createDailyStore({ load: out.load }).submit(entry)).rejects.toMatchObject({
      code: 'not-signed-in'
    });
  });

  it('replaces a score of the puzzle before it had rules', async () => {
    const { load, writes } = fakeLoad({ existing: 'old' });
    await createDailyStore({ load }).submit(entry);
    expect(writes[0][1]).toMatchObject({ v: 2 });
  });

  it('leaves out old scores of the days that have rules', async () => {
    const row = { username: 'a', moves: 21, seconds: 95, stars: 3, score: 990 };
    const { load } = fakeLoad({ rows: [row, { ...row, username: 'b', v: 2 }] });
    const top = await createDailyStore({ load }).top('2026-10-25', 20);
    expect(top.map((r) => r.name)).toEqual(['b']);
  });

  it('reads the best first and drops broken rows', async () => {
    const good = { username: 'ayse', moves: 21, seconds: 95, stars: 3, score: 990 };
    const { load } = fakeLoad({ rows: [good, { username: 'x', moves: '?' }] });
    expect(await createDailyStore({ load }).top('2026-10-12', 20)).toEqual([
      { name: 'ayse', moves: 21, seconds: 95, stars: 3, score: 990 }
    ]);
  });

  it('counts the better scores to find a place', async () => {
    const { load } = fakeLoad({ count: 4 });
    expect(await createDailyStore({ load }).rank('2026-10-12', 900, 60)).toBe(5);
  });
});

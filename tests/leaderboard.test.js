import { describe, expect, it, vi } from 'vitest';
import { DailyBoard } from '../src/app/dailyBoard.js';
import {
  cleanName,
  normalizeDailyRecord,
  recordDailyResult,
  streak
} from '../src/app/dailyResults.js';
import { createLeaderboard } from '../src/app/leaderboard.js';

const emptyRecord = () => normalizeDailyRecord(null, () => 'player-0001');
const result = (moves, seconds = 60, stars = 2) => ({ moves, seconds, stars });

describe('daily results', () => {
  it('keeps the first solution of a day only', () => {
    let { record, first } = recordDailyResult(emptyRecord(), '2026-10-12', result(30));
    expect(first).toBe(true);
    ({ record, first } = recordDailyResult(record, '2026-10-12', result(20)));
    expect(first).toBe(false);
    expect(record.results['2026-10-12']).toEqual({ ...result(30), shared: false });
  });

  it('counts the days in a row up to today, or up to yesterday before today is solved', () => {
    let record = emptyRecord();
    for (const day of ['2026-10-08', '2026-10-10', '2026-10-11']) {
      ({ record } = recordDailyResult(record, day, result(25)));
    }
    expect(streak(record, new Date(2026, 9, 12, 9))).toBe(2);
    ({ record } = recordDailyResult(record, '2026-10-12', result(25)));
    expect(streak(record, new Date(2026, 9, 12, 9))).toBe(3);
    expect(streak(record, new Date(2026, 9, 14, 9))).toBe(0);
  });

  it('cleans names and drops what makes no sense from a saved record', () => {
    expect(cleanName('  Ayşe\u0000  K.  ')).toBe('Ayşe K.');
    expect(cleanName('x'.repeat(40))).toHaveLength(20);
    expect(cleanName('   ')).toBeNull();

    const record = normalizeDailyRecord(
      {
        name: 5,
        playerId: 'abc',
        results: {
          '2026-10-12': { moves: 22, seconds: 80, stars: 3, shared: true },
          '2026-10-11': { moves: 0, seconds: 80, stars: 3 },
          yesterday: { moves: 22, seconds: 80, stars: 3 }
        }
      },
      () => 'new-player-id'
    );
    expect(record).toEqual({
      name: null,
      playerId: 'new-player-id',
      results: { '2026-10-12': { moves: 22, seconds: 80, stars: 3, shared: true } }
    });
  });
});

describe('Supabase leaderboard', () => {
  const config = { url: 'https://example.supabase.co/', anonKey: 'public-key' };

  it('is off without a configured project', () => {
    expect(createLeaderboard({}, vi.fn())).toBeNull();
    expect(createLeaderboard({ url: config.url }, vi.fn())).toBeNull();
  });

  it('adds a score once per player and day, with the public key', async () => {
    const fetch = vi.fn(async () => ({ ok: true }));
    const service = createLeaderboard(config, fetch);
    await service.submit({
      day: '2026-10-12',
      playerId: 'p1',
      name: 'Ayşe',
      moves: 21,
      seconds: 95,
      stars: 3
    });

    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('https://example.supabase.co/rest/v1/daily_scores?on_conflict=day,player_id');
    expect(options.method).toBe('POST');
    expect(options.headers).toMatchObject({
      apikey: 'public-key',
      Authorization: 'Bearer public-key',
      Prefer: 'resolution=ignore-duplicates,return=minimal'
    });
    expect(JSON.parse(options.body)).toEqual({
      day: '2026-10-12',
      player_id: 'p1',
      name: 'Ayşe',
      moves: 21,
      seconds: 95,
      stars: 3
    });
  });

  it('reads the best scores of a day, fewest moves first, and drops broken rows', async () => {
    const rows = [
      { name: 'Ayşe', moves: 21, seconds: 95, stars: 3 },
      { name: 'Can', moves: '?', seconds: 1, stars: 1 }
    ];
    const fetch = vi.fn(async () => ({ ok: true, json: async () => rows }));
    const top = await createLeaderboard(config, fetch).top('2026-10-12', 20);

    const url = new URL(fetch.mock.calls[0][0]);
    expect(url.pathname).toBe('/rest/v1/daily_scores');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      day: 'eq.2026-10-12',
      select: 'name,moves,seconds,stars',
      order: 'moves.asc,seconds.asc',
      limit: '20'
    });
    expect(top).toEqual([rows[0]]);
  });

  it('reports a failed request', async () => {
    const service = createLeaderboard(config, async () => ({ ok: false, status: 500 }));
    await expect(service.top('2026-10-12', 5)).rejects.toThrow('500');
  });
});

describe('DailyBoard', () => {
  const today = new Date(2026, 9, 12, 20);
  const fakeService = () => ({ submit: vi.fn(async () => {}), top: vi.fn(async () => []) });

  it('keeps results on the device when there is no leaderboard', async () => {
    const save = vi.fn();
    const board = new DailyBoard({ record: emptyRecord(), save, service: null });
    await board.record('2026-10-12', result(24, 70, 2));

    const view = await board.view(today);
    expect(view).toMatchObject({
      online: false,
      today: { moves: 24, seconds: 70, stars: 2 },
      streak: 1,
      top: null
    });
    expect(view.history).toHaveLength(1);
    expect(save).toHaveBeenCalled();
  });

  it('sums up today and the streak without asking the leaderboard', async () => {
    const service = fakeService();
    const board = new DailyBoard({ record: emptyRecord(), save: () => {}, service });
    expect(board.summary(today)).toEqual({ today: null, streak: 0 });
    await board.record('2026-10-11', result(30));
    await board.record('2026-10-12', result(24, 70, 3));
    expect(board.summary(today)).toEqual({
      today: { moves: 24, seconds: 70, stars: 3, shared: false },
      streak: 2
    });
    expect(service.top).not.toHaveBeenCalled();
  });

  it('shares a result once the player has a name, and only the first of the day', async () => {
    const service = fakeService();
    const board = new DailyBoard({ record: emptyRecord(), save: () => {}, service });
    await board.record('2026-10-12', result(24));
    expect(service.submit).not.toHaveBeenCalled();

    expect(await board.setName('  ', today)).toBe(false);
    expect(await board.setName('Ayşe', today)).toBe(true);
    expect(service.submit).toHaveBeenCalledWith(
      expect.objectContaining({ day: '2026-10-12', name: 'Ayşe', playerId: 'player-0001' })
    );

    await board.record('2026-10-12', result(18));
    await board.view(today);
    expect(service.submit).toHaveBeenCalledOnce();
  });

  it('tries again later when sharing fails, and says when the scores cannot be read', async () => {
    const service = fakeService();
    service.submit.mockRejectedValueOnce(new Error('offline'));
    service.top.mockRejectedValueOnce(new Error('offline'));
    const board = new DailyBoard({
      record: { ...emptyRecord(), name: 'Can' },
      save: () => {},
      service
    });
    await board.record('2026-10-12', result(24));
    const view = await board.view(today);

    expect(service.submit).toHaveBeenCalledTimes(2);
    expect(view).toMatchObject({ online: true, failed: true, top: null });
  });
});

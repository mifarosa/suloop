import { describe, expect, it } from 'vitest';
import { MAX_SECONDS, dailyScore, rankKey } from '../src/game/dailyScore.js';

describe('daily score', () => {
  it('gives 1000 for the fewest moves, less for more moves', () => {
    expect(dailyScore({ moves: 20, fewest: 20, seconds: 30 })).toBe(1000);
    expect(dailyScore({ moves: 40, fewest: 20, seconds: 30 })).toBe(500);
  });

  it('takes 5 points per full minute, at most 150', () => {
    expect(dailyScore({ moves: 20, fewest: 20, seconds: 125 })).toBe(990);
    expect(dailyScore({ moves: 20, fewest: 20, seconds: MAX_SECONDS })).toBe(850);
  });

  it('ranks by points first and then by the faster time', () => {
    expect(rankKey(900, 50)).toBeGreaterThan(rankKey(899, 1));
    expect(rankKey(900, 50)).toBeGreaterThan(rankKey(900, 51));
  });
});

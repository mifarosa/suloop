import { localDateKey } from './calendar.js';
import { MAX_SECONDS } from '../game/dailyScore.js';
import {
  cleanName,
  markShared,
  normalizeDailyRecord,
  recordDailyResult,
  streak
} from './dailyResults.js';

const TOP_COUNT = 20;
const HISTORY_DAYS = 7;

/**
 * Where daily puzzle scores are shared with other players; the game talks to it through this
 * small interface (see cloud/dailyStore.js for the one that uses Firebase).
 *
 * @typedef {object} LeaderboardService
 * @property {(entry: Entry) => Promise<void>} submit adds a player's score for a day; a second
 *   score of the same player on the same day is ignored
 * @property {(day: string, limit: number) => Promise<PublicScore[]>} top the best scores of a
 *   day: most points first, then the fastest
 * @property {(day: string, score: number, seconds: number) => Promise<number>} [rank] the
 *   place a score has on the day's list (1 for the best)
 *
 * @typedef {{ day: string, name: string, moves: number, seconds: number, stars: number,
 *   score: number, hints: number, log: Array<[number, number]> | undefined }} Entry
 * @typedef {{ name: string, moves: number, seconds: number, stars: number, score: number }}
 *   PublicScore
 */

/**
 * The daily puzzle's results: the player's own, kept on the device, and the shared
 * leaderboard when there is one. A result waits on the device until it can be shared: until
 * the player picks a name, or the network is back.
 */
export class DailyBoard {
  #record;
  #save;
  #service;

  /**
   * @param {object} options
   * @param {import('./dailyResults.js').DailyRecord} options.record
   * @param {(record: import('./dailyResults.js').DailyRecord) => void} options.save
   * @param {LeaderboardService | null} options.service
   */
  constructor({ record, save, service }) {
    this.#record = record;
    this.#save = save;
    this.#service = service;
  }

  /** Whether scores are shared with other players. */
  get online() {
    return this.#service !== null;
  }

  /**
   * Notes a solution of the daily puzzle of `day`, and shares it when it is the first.
   * @param {string} day
   * @param {{ moves: number, seconds: number, stars: number, score?: number, hints?: number,
   *   log?: Array<[number, number]> }} result
   */
  async record(day, result) {
    const { record, first } = recordDailyResult(this.#record, day, result);
    if (!first) return;
    this.#update(record);
    await this.#share(day);
  }

  /** Sets the name shown on the leaderboard, and shares what waited for one. */
  async setName(name, today) {
    const cleaned = cleanName(name);
    if (!cleaned) return false;
    this.#update({ ...this.#record, name: cleaned });
    await this.#shareWaiting(today);
    return true;
  }

  /** The daily results kept on this device, by date key. */
  results() {
    return this.#record.results;
  }

  /**
   * Takes in daily results from another device; results already here stay as they are.
   * @param {Record<string, { moves: number, seconds: number, stars: number }>} incoming
   */
  mergeResults(incoming) {
    const results = { ...this.#record.results };
    for (const [day, result] of Object.entries(incoming)) {
      results[day] ??= { ...result, shared: false };
    }
    this.#update(normalizeDailyRecord({ ...this.#record, results }, () => this.#record.playerId));
  }

  /**
   * Today's result and the streak, from the device alone.
   * @param {Date} today
   * @returns {{ today: import('./dailyResults.js').DailyResult | null, streak: number }}
   */
  summary(today) {
    return {
      today: this.#record.results[localDateKey(today)] ?? null,
      streak: streak(this.#record, today)
    };
  }

  /**
   * Everything the leaderboard dialog shows for `today`.
   * @param {Date} today
   */
  async view(today) {
    const day = localDateKey(today);
    let top = null;
    let failed = false;
    let rank = null;
    if (this.online) {
      await this.#shareWaiting(today);
      try {
        top = await this.#service.top(day, TOP_COUNT);
      } catch {
        failed = true;
      }
      const mine = this.#record.results[day];
      if (!failed && mine?.shared && mine.score !== undefined && this.#service.rank) {
        rank = await this.#service.rank(day, mine.score, mine.seconds).catch(() => null);
      }
    }
    const { name, results } = this.#record;
    const history = Object.keys(results)
      .sort()
      .reverse()
      .slice(0, HISTORY_DAYS)
      .map((key) => ({ day: key, ...results[key] }));
    return {
      online: this.online,
      name,
      today: results[day] ?? null,
      streak: streak(this.#record, today),
      history,
      top,
      rank,
      failed
    };
  }

  /** Shares today's and yesterday's results if they still wait; the leaderboard takes no older. */
  async #shareWaiting(today) {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    for (const day of [localDateKey(yesterday), localDateKey(today)]) {
      const result = this.#record.results[day];
      if (result && !result.shared) await this.#share(day);
    }
  }

  async #share(day) {
    const { name, results } = this.#record;
    const result = results[day];
    // A result from before there were points cannot be ranked.
    if (!this.#service || !name || !result || result.score === undefined) return;
    try {
      await this.#service.submit({
        day,
        name,
        moves: result.moves,
        seconds: Math.min(result.seconds, MAX_SECONDS),
        stars: result.stars,
        score: result.score,
        hints: result.hints ?? 0,
        log: result.log
      });
      this.#update(markShared(this.#record, day));
    } catch {
      // It waits on the device and is tried again later.
    }
  }

  #update(record) {
    this.#record = record;
    this.#save(record);
  }
}

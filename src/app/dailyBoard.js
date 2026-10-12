import { localDateKey } from './calendar.js';
import { cleanName, markShared, recordDailyResult, streak } from './dailyResults.js';

const TOP_COUNT = 20;
const HISTORY_DAYS = 7;

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
   * @param {import('./leaderboard.js').LeaderboardService | null} options.service
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
   * @param {{ moves: number, seconds: number, stars: number }} result
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

  /**
   * Everything the leaderboard dialog shows for `today`.
   * @param {Date} today
   */
  async view(today) {
    const day = localDateKey(today);
    let top = null;
    let failed = false;
    if (this.online) {
      await this.#shareWaiting(today);
      try {
        top = await this.#service.top(day, TOP_COUNT);
      } catch {
        failed = true;
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
    const { name, playerId, results } = this.#record;
    const result = results[day];
    if (!this.#service || !name || !result) return;
    try {
      await this.#service.submit({
        day,
        playerId,
        name,
        moves: result.moves,
        seconds: Math.min(result.seconds, 86400),
        stars: result.stars
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

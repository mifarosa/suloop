import { localDateKey } from './calendar.js';

/**
 * The player's own daily puzzle results, kept on this device: the first solution of each
 * day counts (a replay can be better, but the first try is the fair one), and the days in a
 * row the player has solved make a streak. Also the name they go by on the leaderboard, and
 * a random id that tells their scores apart from someone else's with the same name.
 *
 * @typedef {object} DailyResult
 * @property {number} moves
 * @property {number} seconds from the start of the puzzle to its solution
 * @property {number} stars
 * @property {number} [score] the points (see game/dailyScore.js); results from before there
 *   were points have none and are never shared
 * @property {number} [hints] hints taken, counted in the moves
 * @property {Array<[number, number]>} [log] the moves played, kept until the result is shared
 * @property {boolean} shared whether the leaderboard has it
 *
 * @typedef {object} DailyRecord
 * @property {string | null} name
 * @property {string} playerId
 * @property {Record<string, DailyResult>} results by date key
 */

const STORAGE_KEY = 'suloop:daily:v1';
/** How many days of results are kept. */
export const DAYS_KEPT = 60;
export const NAME_MAX_LENGTH = 20;
/** The most moves a stored log may have; far more than any puzzle needs. */
const MAX_LOG = 400;

/** @returns {DailyRecord} */
export function normalizeDailyRecord(saved, makeId = randomId) {
  const data = saved && typeof saved === 'object' ? saved : {};
  const results = {};
  if (data.results && typeof data.results === 'object') {
    for (const [day, result] of Object.entries(data.results)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !result || typeof result !== 'object') continue;
      const { moves, seconds, stars, shared, score, hints, log } = result;
      if (!isCount(moves) || moves === 0 || !isCount(seconds) || ![1, 2, 3].includes(stars)) {
        continue;
      }
      results[day] = { moves, seconds, stars, shared: shared === true };
      if (isCount(score) && score <= 1000) results[day].score = score;
      if (isCount(hints)) results[day].hints = hints;
      if (shared !== true && isLog(log)) results[day].log = log;
    }
  }
  return {
    name: cleanName(data.name),
    playerId:
      typeof data.playerId === 'string' && data.playerId.length >= 8 ? data.playerId : makeId(),
    results: keepRecent(results)
  };
}

/**
 * Notes a solution of the daily puzzle; only the first of the day counts.
 * @param {DailyRecord} record
 * @param {string} day
 * @param {{ moves: number, seconds: number, stars: number, score?: number, hints?: number,
 *   log?: Array<[number, number]> }} result
 * @returns {{ record: DailyRecord, first: boolean }}
 */
export function recordDailyResult(record, day, { moves, seconds, stars, score, hints, log }) {
  if (record.results[day]) return { record, first: false };
  const result = { moves, seconds, stars, shared: false };
  if (isCount(score)) result.score = score;
  if (isCount(hints)) result.hints = hints;
  if (isLog(log)) result.log = log;
  const results = keepRecent({ ...record.results, [day]: result });
  return { record: { ...record, results }, first: true };
}

/** Marks the result of `day` as on the leaderboard; the moves are not needed here any more. */
export function markShared(record, day) {
  const result = record.results[day];
  if (!result) return record;
  const shared = { ...result, shared: true };
  delete shared.log;
  return { ...record, results: { ...record.results, [day]: shared } };
}

/** How many days in a row, up to today (or yesterday, if today is not solved yet), are solved. */
export function streak({ results }, today) {
  const day = new Date(today);
  if (!results[localDateKey(day)]) day.setDate(day.getDate() - 1);
  let count = 0;
  while (results[localDateKey(day)]) {
    count++;
    day.setDate(day.getDate() - 1);
  }
  return count;
}

/**
 * A name fit to show to others: trimmed, without control characters, not too long.
 * @returns {string | null} null when nothing is left
 */
export function cleanName(name) {
  if (typeof name !== 'string') return null;
  const cleaned = name
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX_LENGTH);
  return cleaned || null;
}

export function loadDailyRecord(storage = browserStorage()) {
  try {
    return normalizeDailyRecord(JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null'));
  } catch {
    return normalizeDailyRecord(null);
  }
}

export function saveDailyRecord(record, storage = browserStorage()) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Storage can be blocked; the results then last for this visit only.
  }
}

function keepRecent(results) {
  const days = Object.keys(results).sort().slice(-DAYS_KEPT);
  return Object.fromEntries(days.map((day) => [day, results[day]]));
}

function isCount(value) {
  return Number.isInteger(value) && value >= 0;
}

/** A list of [from, to] tube numbers, short enough to be a real game. */
function isLog(value) {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= MAX_LOG &&
    value.every((move) => Array.isArray(move) && move.length === 2 && move.every(isCount))
  );
}

function randomId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return Array.from({ length: 4 }, () => Math.random().toString(16).slice(2, 10)).join('-');
}

function browserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

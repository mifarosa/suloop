import { ATTEMPTS_KEPT } from './economy.js';
import { DAYS_KEPT, RESULT_VERSION, isCurrentResult } from './dailyResults.js';
import { normalizeProgress } from './progress.js';
import { MAX_STARS } from '../game/stars.js';

/**
 * The player's progress as the account keeps it, and how this device's progress and the
 * account's come together. Nothing here talks to the network.
 *
 * @typedef {Record<string, { moves: number, seconds: number, stars: number }>} DailyResults
 * @typedef {{ progress: import('./progress.js').Progress, daily: DailyResults }} State
 */

/**
 * The document the account stores: where the player is, their stock, the best stars and the
 * last few solutions of each level, and the recent results of the daily puzzle.
 * @param {State} state
 */
export function stateToDoc({ progress, daily }) {
  const records = {};
  for (const [level, record] of Object.entries(progress.records)) {
    if (record.best > 0) {
      records[level] = { best: record.best, attempts: record.attempts.slice(-ATTEMPTS_KEPT) };
    }
  }
  const days = Object.keys(daily).sort().slice(-DAYS_KEPT);
  return {
    solved: progress.solved,
    current: progress.current,
    hints: progress.hints,
    spareUndos: progress.spareUndos,
    records,
    dailyDone: progress.dailyDone,
    daily: Object.fromEntries(
      days.map((day) => {
        const { moves, seconds, stars, score, v } = daily[day];
        const entry = { moves, seconds, stars };
        if (score !== undefined) entry.score = score;
        if (v === RESULT_VERSION) entry.v = v;
        return [day, entry];
      })
    )
  };
}

/**
 * Reads a stored document back, field by field, so a damaged or hand-edited one can never
 * break the game.
 * @returns {State | null} null when there is no document
 */
export function docToState(doc) {
  if (!doc || typeof doc !== 'object') return null;
  const progress = { ...normalizeProgress({ ...doc, mode: 'level' }), mode: 'level' };
  return { progress, daily: cleanDaily(doc.daily) };
}

function cleanDaily(saved) {
  const daily = {};
  if (!saved || typeof saved !== 'object') return daily;
  for (const [day, result] of Object.entries(saved)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !result || typeof result !== 'object') continue;
    if (!isCurrentResult(day, result)) continue;
    const { moves, seconds, stars, score } = result;
    const count = (value) => Number.isInteger(value) && value >= 0;
    if (!count(moves) || moves === 0 || !count(seconds)) continue;
    if (!Number.isInteger(stars) || stars < 1 || stars > MAX_STARS) continue;
    daily[day] = { moves, seconds, stars };
    if (count(score) && score <= 1000) daily[day].score = score;
    if (result.v === RESULT_VERSION) daily[day].v = RESULT_VERSION;
  }
  return daily;
}

/**
 * Brings the account's state into this device's without ever lowering anything: levels
 * solved, best stars and daily results only grow. The hints, spare undos and the level to
 * play come over only when the account is further along, so what was spent here is not given
 * back; of the last solutions of a level the longer list stays.
 * @param {State} local
 * @param {State | null} remote
 * @returns {State & { changed: boolean }} changed: whether this device gains anything
 */
export function mergeProgress(local, remote) {
  if (!remote) return { ...local, changed: false };

  const ahead = remote.progress.solved > local.progress.solved;
  const records = { ...local.progress.records };
  for (const [key, theirs] of Object.entries(remote.progress.records)) {
    const level = Number(key);
    const mine = records[level];
    if (!mine) {
      records[level] = theirs;
      continue;
    }
    records[level] = {
      best: Math.max(mine.best, theirs.best),
      attempts: theirs.attempts.length > mine.attempts.length ? theirs.attempts : mine.attempts
    };
  }

  const progress = {
    ...local.progress,
    solved: Math.max(local.progress.solved, remote.progress.solved),
    current: ahead ? remote.progress.current : local.progress.current,
    mode: ahead ? 'level' : local.progress.mode,
    hints: ahead ? remote.progress.hints : local.progress.hints,
    spareUndos: ahead ? remote.progress.spareUndos : local.progress.spareUndos,
    dailyDone:
      [local.progress.dailyDone, remote.progress.dailyDone].filter(Boolean).sort().at(-1) ?? null,
    records
  };
  // This device's own result of a day wins over the account's.
  const daily = { ...remote.daily, ...local.daily };
  const changed =
    JSON.stringify(progress) !== JSON.stringify(local.progress) ||
    Object.keys(daily).length !== Object.keys(local.daily).length;
  return { progress, daily, changed };
}

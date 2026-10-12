import { MAX_STARS } from '../game/stars.js';

/**
 * What the player earns and spends besides levels, as pure changes to their progress:
 *
 * - Hints. A new player has a few; each hint costs one, and an undo does not give it back.
 *   Solving the daily puzzle earns one, once a day.
 * - Spare undos. Solving a level with every star for the first time earns one, on levels
 *   whose undos are limited; with unlimited undos there is nothing to spare, and those easy
 *   levels would hand out a pile of them. They are spent when the undos of a level run out.
 * - Records. Each level keeps its best stars and its last few solutions.
 */

export const INITIAL_HINTS = 2;
/** How many of a level's solutions its record keeps. */
export const ATTEMPTS_KEPT = 5;

/**
 * @param {import('./progress.js').Progress} progress
 * @returns {import('./progress.js').Progress | null} the progress with one hint less, or null
 *   when none is left
 */
export function spendHint(progress) {
  return progress.hints > 0 ? { ...progress, hints: progress.hints - 1 } : null;
}

/**
 * @param {import('./progress.js').Progress} progress
 * @returns {import('./progress.js').Progress | null} null when no spare undo is left
 */
export function spendSpareUndo(progress) {
  return progress.spareUndos > 0 ? { ...progress, spareUndos: progress.spareUndos - 1 } : null;
}

/**
 * Notes a solution of a level in its record.
 * @param {import('./progress.js').Progress} progress
 * @param {number} level
 * @param {{ moves: number, stars: number }} attempt
 * @param {{ limitedUndo: boolean }} level's rules: whether its undos are limited
 * @returns {{ progress: import('./progress.js').Progress, earnedUndo: boolean }} earnedUndo:
 *   a level with limited undos got every star for the first time, which earns a spare undo
 */
export function recordLevelWin(progress, level, { moves, stars }, { limitedUndo }) {
  const record = progress.records[level] ?? { best: 0, attempts: [] };
  const earnedUndo = limitedUndo && stars === MAX_STARS && record.best < MAX_STARS;
  const attempts = [...record.attempts, { moves, stars }].slice(-ATTEMPTS_KEPT);
  return {
    progress: {
      ...progress,
      records: { ...progress.records, [level]: { best: Math.max(record.best, stars), attempts } },
      spareUndos: progress.spareUndos + (earnedUndo ? 1 : 0)
    },
    earnedUndo
  };
}

/**
 * Notes the daily puzzle of `day` as solved.
 * @param {import('./progress.js').Progress} progress
 * @param {string} day date key of the puzzle
 * @returns {{ progress: import('./progress.js').Progress, earnedHint: boolean }} earnedHint:
 *   it was the first time that puzzle was solved
 */
export function recordDailyWin(progress, day) {
  const earnedHint = progress.dailyDone !== day;
  return {
    progress: { ...progress, dailyDone: day, hints: progress.hints + (earnedHint ? 1 : 0) },
    earnedHint
  };
}

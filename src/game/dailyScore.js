/**
 * The points of a daily puzzle: full marks for the fewest moves, less the more moves it took,
 * and a little off for a slow solution. The moves count most; time only separates players who
 * took the same moves, so it costs at most 150 points.
 *
 * @param {{ moves: number, fewest: number, seconds: number }} result moves include the hints
 *   taken; fewest is the fewest moves the puzzle can be solved in
 * @returns {number} a whole number from 0 to 1000
 */
export function dailyScore({ moves, fewest, seconds }) {
  const accuracy = Math.min(1, fewest / Math.max(1, moves));
  const slowness = Math.min(MAX_TIME_COST, TIME_COST_PER_MINUTE * Math.floor(seconds / 60));
  return Math.max(0, Math.round(1000 * accuracy) - slowness);
}

const TIME_COST_PER_MINUTE = 5;
const MAX_TIME_COST = 150;
/** The most seconds a result can carry (a day); it keeps the ranking key below in range. */
export const MAX_SECONDS = 86_400;
const KEY_RANGE = 100_000;

/**
 * One number that orders players: more points first, and of equal points the faster. A
 * database can sort by it alone (higher is better).
 */
export function rankKey(score, seconds) {
  return score * KEY_RANGE + (KEY_RANGE - 1 - Math.min(seconds, MAX_SECONDS));
}

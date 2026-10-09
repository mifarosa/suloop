import { generatePuzzle } from './generator.js';
import { hashString } from './random.js';

export const MAX_COLOR_COUNT = 10;
export const DAILY_COLOR_COUNT = 7;

/** Difficulty curve: three colors at level 1, one more every two levels, up to the maximum. */
export function colorCountForLevel(level) {
  return Math.min(3 + Math.floor((level - 1) / 2), MAX_COLOR_COUNT);
}

/**
 * The puzzle for a numbered level. Seeds are derived from the level number, so a level
 * looks the same on every device and after every release.
 */
export function createLevelPuzzle(level) {
  return generatePuzzle(hashString(`level-${level}`), colorCountForLevel(level));
}

/** The daily puzzle, shared by everyone on the same calendar date ("YYYY-MM-DD"). */
export function createDailyPuzzle(dateKey) {
  return generatePuzzle(hashString(`daily-${dateKey}`), DAILY_COLOR_COUNT);
}

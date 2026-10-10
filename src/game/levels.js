import { generatePuzzle } from './generator.js';
import { hashString } from './random.js';

export const DAILY_COLOR_COUNT = 7;

/**
 * The levels, easiest first, in chapters of LEVELS_PER_CHAPTER. Within a chapter the color
 * count rises in equal steps from `minColors` to `maxColors`.
 *
 * The order follows how often random play still solves a puzzle (from about 95% with three
 * colors down to about 6% with ten). A single empty tube makes a board much harder than more
 * colors do, so the last chapter uses fewer colors and one empty tube.
 */
export const CHAPTERS = Object.freeze([
  { id: 'easy', minColors: 3, maxColors: 5, emptyTubeCount: 2 },
  { id: 'medium', minColors: 6, maxColors: 8, emptyTubeCount: 2 },
  { id: 'hard', minColors: 9, maxColors: 10, emptyTubeCount: 2 },
  { id: 'expert', minColors: 6, maxColors: 7, emptyTubeCount: 1 }
]);

export const LEVELS_PER_CHAPTER = 15;
export const LEVEL_COUNT = CHAPTERS.length * LEVELS_PER_CHAPTER;
export const MAX_COLOR_COUNT = Math.max(
  DAILY_COLOR_COUNT,
  ...CHAPTERS.map((chapter) => chapter.maxColors)
);

/** Index into CHAPTERS of the chapter a level belongs to. */
export function chapterIndexOfLevel(level) {
  return Math.floor((level - 1) / LEVELS_PER_CHAPTER);
}

/**
 * How a level is dealt.
 * @param {number} level 1 to LEVEL_COUNT
 * @returns {{ colorCount: number, emptyTubeCount: number }}
 */
export function levelSettings(level) {
  const { minColors, maxColors, emptyTubeCount } = CHAPTERS[chapterIndexOfLevel(level)];
  const position = (level - 1) % LEVELS_PER_CHAPTER;
  const steps = maxColors - minColors + 1;
  const colorCount = minColors + Math.floor((position * steps) / LEVELS_PER_CHAPTER);
  return { colorCount, emptyTubeCount };
}

/**
 * The puzzle for a numbered level. Seeds are derived from the level number, so a level
 * looks the same on every device and after every release.
 */
export function createLevelPuzzle(level) {
  const { colorCount, emptyTubeCount } = levelSettings(level);
  return generatePuzzle(hashString(`level-${level}`), colorCount, emptyTubeCount);
}

/** The daily puzzle, shared by everyone on the same calendar date ("YYYY-MM-DD"). */
export function createDailyPuzzle(dateKey) {
  return generatePuzzle(hashString(`daily-${dateKey}`), DAILY_COLOR_COUNT);
}

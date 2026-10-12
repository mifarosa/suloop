import { generatePuzzle } from './generator.js';
import { hashString } from './random.js';

export const DAILY_COLOR_COUNT = 7;

/**
 * The first levels, easiest first, in chapters of LEVELS_PER_CHAPTER. Within a chapter the
 * color count rises in equal steps from `minColors` to `maxColors`.
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
/** Levels in the chapters; every level after them is a master level. */
export const CHAPTER_LEVEL_COUNT = CHAPTERS.length * LEVELS_PER_CHAPTER;

/**
 * Master levels go on forever. They no longer get harder: each one takes the next of the
 * hardest settings in turn. More colors would need tubes too small for a phone and colors
 * too alike to tell apart, and with eight colors a single empty tube is often unsolvable.
 */
export const MASTER_SETTINGS = Object.freeze([
  { colorCount: 9, emptyTubeCount: 2 },
  { colorCount: 6, emptyTubeCount: 1 },
  { colorCount: 10, emptyTubeCount: 2 },
  { colorCount: 7, emptyTubeCount: 1 }
]);

export const MAX_COLOR_COUNT = Math.max(
  DAILY_COLOR_COUNT,
  ...CHAPTERS.map((chapter) => chapter.maxColors),
  ...MASTER_SETTINGS.map((settings) => settings.colorCount)
);

/** Seeds to try for one puzzle. Almost every puzzle comes from the first one. */
const SEED_ATTEMPTS = 10;

export function isMasterLevel(level) {
  return level > CHAPTER_LEVEL_COUNT;
}

/** The id of a level's chapter: one of the CHAPTERS, or 'master' after them. */
export function chapterIdOfLevel(level) {
  return isMasterLevel(level) ? 'master' : CHAPTERS[chapterIndexOfLevel(level)].id;
}

/** Index into CHAPTERS of the chapter a level belongs to; only for levels in the chapters. */
function chapterIndexOfLevel(level) {
  return Math.floor((level - 1) / LEVELS_PER_CHAPTER);
}

/**
 * How a level is dealt.
 * @param {number} level 1 or more
 * @returns {{ colorCount: number, emptyTubeCount: number }}
 */
export function levelSettings(level) {
  if (isMasterLevel(level)) {
    return MASTER_SETTINGS[(level - CHAPTER_LEVEL_COUNT - 1) % MASTER_SETTINGS.length];
  }
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
  return dealPuzzle(`level-${level}`, colorCount, emptyTubeCount);
}

/** The daily puzzle, shared by everyone on the same calendar date ("YYYY-MM-DD"). */
export function createDailyPuzzle(dateKey) {
  return dealPuzzle(`daily-${dateKey}`, DAILY_COLOR_COUNT, 2);
}

/**
 * Deals from the seed of `key`, or, in the rare case that seed yields no solvable puzzle,
 * from the seeds of "key#1", "key#2" and so on.
 */
function dealPuzzle(key, colorCount, emptyTubeCount) {
  for (let attempt = 0; attempt < SEED_ATTEMPTS; attempt++) {
    const seedKey = attempt === 0 ? key : `${key}#${attempt}`;
    const tubes = generatePuzzle(hashString(seedKey), colorCount, emptyTubeCount);
    if (tubes) return tubes;
  }
  throw new Error(`Could not deal a solvable puzzle for ${key}`);
}

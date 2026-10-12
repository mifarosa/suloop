import { generatePuzzle } from './generator.js';
import { hashString } from './random.js';
import { TALL_TUBE_CAPACITY, TUBE_CAPACITY } from './rules.js';

/**
 * How a puzzle is dealt and played.
 * @typedef {object} PuzzleSettings
 * @property {number} colorCount
 * @property {number} emptyTubeCount
 * @property {number} capacity units each tube holds
 * @property {boolean} hiddenColors whether only the top unit of each tube shows at first
 */

const PLAIN = Object.freeze({ capacity: TUBE_CAPACITY, hiddenColors: false });

export const DAILY_COLOR_COUNT = 7;
/** @type {Readonly<PuzzleSettings>} */
export const DAILY_SETTINGS = Object.freeze({
  ...PLAIN,
  colorCount: DAILY_COLOR_COUNT,
  emptyTubeCount: 2
});

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
 * Master levels go on forever. They no longer get harder: each one takes the next of these
 * settings in turn. More colors would need tubes too small for a phone and colors too alike
 * to tell apart, and with eight colors a single empty tube is often unsolvable, so the other
 * ways to make a board hard are hidden colors and tall tubes. Eight colors in tall tubes are
 * about as hard for random play as ten colors in plain ones, with two tubes fewer.
 *
 * Only append to this list in pairs that keep the first four in place, or existing master
 * levels change.
 *
 * @type {ReadonlyArray<Readonly<PuzzleSettings>>}
 */
export const MASTER_SETTINGS = Object.freeze([
  { ...PLAIN, colorCount: 9, emptyTubeCount: 2 },
  { ...PLAIN, colorCount: 6, emptyTubeCount: 1 },
  { ...PLAIN, colorCount: 10, emptyTubeCount: 2 },
  { ...PLAIN, colorCount: 7, emptyTubeCount: 1 },
  { ...PLAIN, colorCount: 7, emptyTubeCount: 2, hiddenColors: true },
  { ...PLAIN, colorCount: 8, emptyTubeCount: 2, capacity: TALL_TUBE_CAPACITY },
  { ...PLAIN, colorCount: 8, emptyTubeCount: 2, hiddenColors: true },
  {
    colorCount: 7,
    emptyTubeCount: 2,
    capacity: TALL_TUBE_CAPACITY,
    hiddenColors: true
  }
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
 * How a level is dealt and played.
 * @param {number} level 1 or more
 * @returns {Readonly<PuzzleSettings>}
 */
export function levelSettings(level) {
  if (isMasterLevel(level)) {
    return MASTER_SETTINGS[(level - CHAPTER_LEVEL_COUNT - 1) % MASTER_SETTINGS.length];
  }
  const { minColors, maxColors, emptyTubeCount } = CHAPTERS[chapterIndexOfLevel(level)];
  const position = (level - 1) % LEVELS_PER_CHAPTER;
  const steps = maxColors - minColors + 1;
  const colorCount = minColors + Math.floor((position * steps) / LEVELS_PER_CHAPTER);
  return { ...PLAIN, colorCount, emptyTubeCount };
}

/**
 * The special rules in a puzzle's settings.
 * @param {PuzzleSettings} settings
 * @returns {Array<'hiddenColors' | 'tallTubes'>}
 */
export function specialRules({ hiddenColors, capacity }) {
  const rules = [];
  if (hiddenColors) rules.push('hiddenColors');
  if (capacity > TUBE_CAPACITY) rules.push('tallTubes');
  return rules;
}

/**
 * The special rules a level is the first to use, so the game can explain them there.
 * @returns {Array<'hiddenColors' | 'tallTubes'>}
 */
export function rulesFirstUsedAt(level) {
  const index = level - CHAPTER_LEVEL_COUNT - 1;
  if (index < 0 || index >= MASTER_SETTINGS.length) return [];

  const usedBefore = MASTER_SETTINGS.slice(0, index).flatMap(specialRules);
  return specialRules(MASTER_SETTINGS[index]).filter((rule) => !usedBefore.includes(rule));
}

/**
 * The puzzle for a numbered level. Seeds are derived from the level number, so a level
 * looks the same on every device and after every release.
 */
export function createLevelPuzzle(level) {
  return dealPuzzle(`level-${level}`, levelSettings(level));
}

/** The daily puzzle, shared by everyone on the same calendar date ("YYYY-MM-DD"). */
export function createDailyPuzzle(dateKey) {
  return dealPuzzle(`daily-${dateKey}`, DAILY_SETTINGS);
}

/**
 * Deals from the seed of `key`, or, in the rare case that seed yields no solvable puzzle,
 * from the seeds of "key#1", "key#2" and so on.
 * @param {string} key
 * @param {PuzzleSettings} settings
 */
function dealPuzzle(key, { colorCount, emptyTubeCount, capacity }) {
  for (let attempt = 0; attempt < SEED_ATTEMPTS; attempt++) {
    const seedKey = attempt === 0 ? key : `${key}#${attempt}`;
    const tubes = generatePuzzle(hashString(seedKey), colorCount, emptyTubeCount, capacity);
    if (tubes) return tubes;
  }
  throw new Error(`Could not deal a solvable puzzle for ${key}`);
}

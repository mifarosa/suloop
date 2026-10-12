import { generatePuzzle } from './generator.js';
import { hashString } from './random.js';
import { TALL_TUBE_CAPACITY, TUBE_CAPACITY } from './rules.js';

/**
 * How a puzzle is dealt and played.
 * @typedef {object} PuzzleSettings
 * @property {number} colorCount
 * @property {number} emptyTubeCount empty full-size tubes
 * @property {number} halfTubeCount empty tubes that hold only HALF_TUBE_SIZE units
 * @property {number} oneWayTubeCount empty tubes that take liquid but never give it back
 * @property {number} crackedTubeCount empty tubes that can be poured into only a few times
 * @property {number} lockedTubeCount filled tubes locked until their key color is complete
 * @property {number} oilColorCount colors that are oil and float on top of the water
 * @property {number} capacity units of each color, and what a full-size tube holds
 * @property {boolean} hiddenColors whether only the top unit of each tube shows at first
 * @property {number | null} undoLimit moves the player may take back; null for no limit
 */

const PLAIN = Object.freeze({
  halfTubeCount: 0,
  oneWayTubeCount: 0,
  crackedTubeCount: 0,
  lockedTubeCount: 0,
  oilColorCount: 0,
  capacity: TUBE_CAPACITY,
  hiddenColors: false,
  undoLimit: null
});

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

/** Moves a player may take back in a master level; a restart gives them all back. */
export const MASTER_UNDO_LIMIT = 3;
const MASTER = Object.freeze({ ...PLAIN, undoLimit: MASTER_UNDO_LIMIT });

/**
 * Master levels go on forever. They no longer get harder: each one takes the next of these
 * settings in turn, and all of them limit undo. More colors would need tubes too small for a
 * phone and colors too alike to tell apart, so other rules make a board hard:
 * - a single empty tube (with eight colors it is often unsolvable on its own),
 * - hidden colors, which take away what the player can plan with,
 * - tall tubes: eight colors in them are about as hard for random play as ten in plain ones
 *   (7% against 6% solved), with two tubes fewer,
 * - a half tube next to a single empty one: hardest of all (eight colors: 2.5%; nine: 1.5%),
 *   and it makes eight and nine colors with one free full-size tube solvable,
 * - a one-way tube as the second empty tube: random play barely notices it (nine colors:
 *   12%), but every pour into it is final,
 * - a cracked tube as the second empty tube (eight colors: 8%),
 * - a locked tube (eight colors: 10%); with a single empty tube it is often unsolvable,
 * - oil, the hardest for random play (six colors: 1.2%), because oil left on a tube keeps
 *   the water under it in place. Two oil colors are next to unsolvable, and oil is never
 *   combined with hidden colors.
 * Every new rule first appears on its own, then in pairs.
 *
 * The first four settings were the whole list once; they stay in place so those levels
 * keep their boards.
 *
 * @type {ReadonlyArray<Readonly<PuzzleSettings>>}
 */
export const MASTER_SETTINGS = Object.freeze([
  { ...MASTER, colorCount: 9, emptyTubeCount: 2 },
  { ...MASTER, colorCount: 6, emptyTubeCount: 1 },
  { ...MASTER, colorCount: 10, emptyTubeCount: 2 },
  { ...MASTER, colorCount: 7, emptyTubeCount: 1 },
  { ...MASTER, colorCount: 7, emptyTubeCount: 2, hiddenColors: true },
  { ...MASTER, colorCount: 8, emptyTubeCount: 2, capacity: TALL_TUBE_CAPACITY },
  { ...MASTER, colorCount: 8, emptyTubeCount: 1, halfTubeCount: 1 },
  {
    ...MASTER,
    colorCount: 7,
    emptyTubeCount: 2,
    capacity: TALL_TUBE_CAPACITY,
    hiddenColors: true
  },
  { ...MASTER, colorCount: 8, emptyTubeCount: 2, hiddenColors: true },
  {
    ...MASTER,
    colorCount: 6,
    emptyTubeCount: 1,
    halfTubeCount: 1,
    capacity: TALL_TUBE_CAPACITY
  },
  { ...MASTER, colorCount: 7, emptyTubeCount: 1, halfTubeCount: 1, hiddenColors: true },
  { ...MASTER, colorCount: 9, emptyTubeCount: 1, halfTubeCount: 1 },
  { ...MASTER, colorCount: 9, emptyTubeCount: 1, oneWayTubeCount: 1 },
  { ...MASTER, colorCount: 8, emptyTubeCount: 1, crackedTubeCount: 1 },
  { ...MASTER, colorCount: 8, emptyTubeCount: 2, lockedTubeCount: 1 },
  { ...MASTER, colorCount: 6, emptyTubeCount: 2, oilColorCount: 1 },
  { ...MASTER, colorCount: 7, emptyTubeCount: 1, oneWayTubeCount: 1, hiddenColors: true },
  {
    ...MASTER,
    colorCount: 8,
    emptyTubeCount: 2,
    lockedTubeCount: 1,
    capacity: TALL_TUBE_CAPACITY
  },
  {
    ...MASTER,
    colorCount: 7,
    emptyTubeCount: 1,
    crackedTubeCount: 1,
    capacity: TALL_TUBE_CAPACITY
  },
  { ...MASTER, colorCount: 5, emptyTubeCount: 2, oilColorCount: 1, capacity: TALL_TUBE_CAPACITY }
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
 * @typedef {'limitedUndo' | 'hiddenColors' | 'tallTubes' | 'halfTube' | 'oneWayTube'
 *   | 'crackedTube' | 'lockedTube' | 'oil'} SpecialRule
 */

/**
 * The special rules in a puzzle's settings.
 * @param {PuzzleSettings} settings
 * @returns {SpecialRule[]}
 */
export function specialRules(settings) {
  const rules = [];
  if (settings.undoLimit !== null) rules.push('limitedUndo');
  if (settings.hiddenColors) rules.push('hiddenColors');
  if (settings.capacity > TUBE_CAPACITY) rules.push('tallTubes');
  if (settings.halfTubeCount > 0) rules.push('halfTube');
  if (settings.oneWayTubeCount > 0) rules.push('oneWayTube');
  if (settings.crackedTubeCount > 0) rules.push('crackedTube');
  if (settings.lockedTubeCount > 0) rules.push('lockedTube');
  if (settings.oilColorCount > 0) rules.push('oil');
  return rules;
}

/**
 * The special rules a level is the first to use, so the game can explain them there.
 * @returns {SpecialRule[]}
 */
export function rulesFirstUsedAt(level) {
  const index = level - CHAPTER_LEVEL_COUNT - 1;
  if (index < 0 || index >= MASTER_SETTINGS.length) return [];

  const usedBefore = MASTER_SETTINGS.slice(0, index).flatMap(specialRules);
  return specialRules(MASTER_SETTINGS[index]).filter((rule) => !usedBefore.includes(rule));
}

/**
 * The puzzle for a numbered level: its tubes and the board's rules. Seeds are derived from
 * the level number, so a level looks the same on every device and after every release.
 * @returns {{ tubes: number[][], board: import('./rules.js').Board }}
 */
export function createLevelPuzzle(level) {
  return dealPuzzle(`level-${level}`, levelSettings(level));
}

/**
 * The daily puzzle, shared by everyone on the same calendar date ("YYYY-MM-DD").
 * @returns {{ tubes: number[][], board: import('./rules.js').Board }}
 */
export function createDailyPuzzle(dateKey) {
  return dealPuzzle(`daily-${dateKey}`, DAILY_SETTINGS);
}

/**
 * Deals from the seed of `key`, or, in the rare case that seed yields no solvable puzzle,
 * from the seeds of "key#1", "key#2" and so on.
 * @param {string} key
 * @param {PuzzleSettings} settings
 */
function dealPuzzle(key, settings) {
  for (let attempt = 0; attempt < SEED_ATTEMPTS; attempt++) {
    const seedKey = attempt === 0 ? key : `${key}#${attempt}`;
    const puzzle = generatePuzzle(hashString(seedKey), settings);
    if (puzzle) return puzzle;
  }
  throw new Error(`Could not deal a solvable puzzle for ${key}`);
}

/**
 * The player's progress, kept in the browser's localStorage.
 *
 * Levels unlock in order, so the solved levels are always 1 to `solved` and the next one
 * after them is the furthest the player can go.
 *
 * @typedef {object} Progress
 * @property {'level' | 'daily'} mode which puzzle is being played
 * @property {number} solved how many levels are solved
 * @property {number} current the level to play, at most one past the solved ones
 * @property {string | null} dailyDone date key of the last solved daily puzzle
 */

const STORAGE_KEY = 'suloop:progress:v1';

/** @type {Readonly<Progress>} */
export const INITIAL_PROGRESS = Object.freeze({
  mode: 'level',
  solved: 0,
  current: 1,
  dailyDone: null
});

/** The highest level the player may open. */
export function lastOpenLevel({ solved }) {
  return solved + 1;
}

/**
 * Turns whatever was stored into valid progress; anything unexpected falls back to the
 * initial value, so an old or edited save can never break the game.
 * @returns {Progress}
 */
export function normalizeProgress(saved) {
  const data = saved && typeof saved === 'object' ? saved : {};
  // Saves from before the level list only kept `level`, the next level to play.
  const legacyLevel = Number.isInteger(data.level) && data.level > 0 ? data.level : null;

  const solvedValue = Number.isInteger(data.solved) ? data.solved : (legacyLevel ?? 1) - 1;
  const solved = Math.max(solvedValue, 0);
  const currentValue = Number.isInteger(data.current) ? data.current : (legacyLevel ?? 1);
  return {
    mode: data.mode === 'daily' ? 'daily' : 'level',
    solved,
    current: clamp(currentValue, 1, lastOpenLevel({ solved })),
    dailyDone: typeof data.dailyDone === 'string' ? data.dailyDone : null
  };
}

/**
 * @param {Storage | null} [storage]
 * @returns {Progress}
 */
export function loadProgress(storage = browserStorage()) {
  try {
    return normalizeProgress(JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null'));
  } catch {
    return { ...INITIAL_PROGRESS };
  }
}

/**
 * @param {Progress} progress
 * @param {Storage | null} [storage]
 */
export function saveProgress(progress, storage = browserStorage()) {
  // Another tab of the game may have solved more levels meanwhile; never write fewer.
  const next = normalizeProgress(progress);
  const solved = Math.max(next.solved, loadProgress(storage).solved);
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify({ ...next, solved }));
  } catch {
    // Storage can be full or blocked (e.g. private browsing); progress then lasts for this visit only.
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/** Even reading `localStorage` throws when the browser blocks site data. */
function browserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

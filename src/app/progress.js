/**
 * The player's progress, kept in the browser's localStorage.
 *
 * @typedef {object} Progress
 * @property {'level' | 'daily'} mode which puzzle is being played
 * @property {number} level the next numbered level to play (1 or more)
 * @property {string | null} dailyDone date key of the last solved daily puzzle
 */

const STORAGE_KEY = 'suloop:progress:v1';

/** @type {Readonly<Progress>} */
export const INITIAL_PROGRESS = Object.freeze({ mode: 'level', level: 1, dailyDone: null });

/**
 * Turns whatever was stored into valid progress; anything unexpected falls back to the
 * initial value, so an old or edited save can never break the game.
 * @returns {Progress}
 */
export function normalizeProgress(saved) {
  const data = saved && typeof saved === 'object' ? saved : {};
  return {
    mode: data.mode === 'daily' ? 'daily' : 'level',
    level: Number.isInteger(data.level) && data.level > 0 ? data.level : INITIAL_PROGRESS.level,
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
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(normalizeProgress(progress)));
  } catch {
    // Storage can be full or blocked (e.g. private browsing); progress then lasts for this visit only.
  }
}

/** Even reading `localStorage` throws when the browser blocks site data. */
function browserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

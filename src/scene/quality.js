/**
 * Keeps the board smooth on slow phones by trading sharpness for speed. How fast a canvas
 * draws depends mostly on how many pixels it has, so when frames keep coming too slowly while
 * something moves, the resolution steps down a little, to a floor of one pixel per CSS pixel.
 * It never steps back up in the same visit: a screen that was too slow once will be again.
 */

/** Frames that are judged together; about a second of animation. */
const WINDOW_FRAMES = 40;
/** An average frame time above this (under about 45 frames a second) is too slow. */
const SLOW_FRAME_MS = 22;
const STEP = 0.25;
/** Frames this slow (about 30 a second or worse) take two steps at once. */
const VERY_SLOW_FRAME_MS = 33;
/** Gaps longer than this are pauses (a hidden tab, nothing moving), not slow frames. */
const MAX_FRAME_MS = 250;

export class QualityGovernor {
  #ratio;
  #min;
  #times = [];

  /**
   * @param {{ ratio: number, min?: number }} options the resolution to start at (device pixels
   *   per CSS pixel), and the lowest to go to
   */
  constructor({ ratio, min = 1 }) {
    this.#min = min;
    this.#ratio = Math.max(min, ratio);
  }

  get ratio() {
    return this.#ratio;
  }

  /**
   * Notes the time one frame took while something was moving.
   * @param {number} milliseconds since the frame before
   * @returns {number | null} the new resolution when it has to go down, otherwise null
   */
  record(milliseconds) {
    if (milliseconds > MAX_FRAME_MS || this.#ratio <= this.#min) return null;

    this.#times.push(milliseconds);
    if (this.#times.length < WINDOW_FRAMES) return null;

    const average = this.#times.reduce((sum, time) => sum + time, 0) / this.#times.length;
    this.#times = [];
    if (average <= SLOW_FRAME_MS) return null;

    const step = average > VERY_SLOW_FRAME_MS ? STEP * 2 : STEP;
    this.#ratio = Math.max(this.#min, this.#ratio - step);
    return this.#ratio;
  }
}

const STORAGE_KEY = 'suloop:resolution:v1';

/** The resolution a slow screen was brought down to on an earlier visit, if it was. */
export function loadSavedRatio(storage = browserStorage()) {
  try {
    const value = Number(storage?.getItem(STORAGE_KEY));
    return value >= 1 && value <= 4 ? value : null;
  } catch {
    return null;
  }
}

export function saveRatio(ratio, storage = browserStorage()) {
  try {
    storage?.setItem(STORAGE_KEY, String(ratio));
  } catch {
    // Storage can be blocked; the screen is then measured again next time.
  }
}

function browserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

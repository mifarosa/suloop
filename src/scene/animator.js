export const linear = (t) => t;
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
/** Runs a little past the end and settles back, like something pressed into place. */
export const easeOutBack = (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;

/**
 * Time-based tweens, advanced once per rendered frame.
 *
 * Every tween has a key. Starting a tween under a key that is already running ends the
 * old one, so an object never has two tweens fighting over the same property.
 */
export class Animator {
  #tweens = new Map();
  #nextId = 0;
  #onStart;

  /** @param {() => void} [onStart] called whenever a tween starts, e.g. to wake the render loop */
  constructor(onStart = () => {}) {
    this.#onStart = onStart;
  }

  get isRunning() {
    return this.#tweens.size > 0;
  }

  /**
   * Calls `update` with the eased progress (0 to 1) on every frame for `duration` ms.
   * @param {number} duration
   * @param {(progress: number) => void} update
   * @param {{ ease?: (t: number) => number, key?: string }} [options]
   * @returns {Promise<void>} resolves when the tween finishes or is replaced
   */
  run(duration, update, { ease = easeInOutCubic, key = `tween-${this.#nextId++}` } = {}) {
    this.#tweens.get(key)?.resolve();
    const finished = new Promise((resolve) => {
      this.#tweens.set(key, { start: performance.now(), duration, update, ease, resolve });
    });
    this.#onStart();
    return finished;
  }

  /** Advances every tween to `now`. */
  tick(now = performance.now()) {
    for (const [key, tween] of this.#tweens) {
      const progress = Math.min(1, (now - tween.start) / tween.duration);
      tween.update(tween.ease(progress));
      if (progress >= 1) {
        this.#tweens.delete(key);
        tween.resolve();
      }
    }
  }

  /** Stops the tween under `key` where it is, if one runs; its promise resolves. */
  stop(key) {
    const tween = this.#tweens.get(key);
    if (!tween) return;
    this.#tweens.delete(key);
    tween.resolve();
  }

  /** Stops every tween where it is; their promises resolve. */
  stopAll() {
    for (const tween of this.#tweens.values()) tween.resolve();
    this.#tweens.clear();
  }
}

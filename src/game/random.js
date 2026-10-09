/**
 * Seeded randomness, so the same level number or date always produces the same puzzle.
 */

/**
 * Mulberry32: a small, fast pseudo-random generator.
 * @param {number} seed 32-bit unsigned integer
 * @returns {() => number} Returns floats in [0, 1); the same seed yields the same sequence.
 */
export function createRandom(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * FNV-1a hash, used to turn a text key such as "level-12" into a seed.
 * @param {string} text
 * @returns {number} 32-bit unsigned integer
 */
export function hashString(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

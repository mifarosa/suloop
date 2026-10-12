import { createRandom } from './random.js';
import { TUBE_CAPACITY, topRun } from './rules.js';
import { solve } from './solver.js';

const MAX_ATTEMPTS = 100;

// A tube that starts with this many matching units on top is already half sorted.
const TOO_EASY_TOP_RUN = 3;

/**
 * Deals a random, solvable puzzle. The same seed always deals the same puzzle.
 *
 * @param {number} seed
 * @param {number} colorCount number of colors, and so the number of filled tubes
 * @param {number} [emptyTubeCount]
 * @param {number} [capacity] units in each tube
 * @returns {number[][] | null} null when no solvable deal turned up, which happens now and then
 *   with a single empty tube
 */
export function generatePuzzle(seed, colorCount, emptyTubeCount = 2, capacity = TUBE_CAPACITY) {
  const random = createRandom(seed);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const tubes = dealFilledTubes(random, colorCount, capacity);
    for (let i = 0; i < emptyTubeCount; i++) tubes.push([]);

    if (!tubes.some(startsTooEasy) && solve(tubes, { capacity })) return tubes;
  }
  return null;
}

/** Shuffles `capacity` units of every color and splits them into full tubes. */
function dealFilledTubes(random, colorCount, capacity) {
  const units = [];
  for (let color = 0; color < colorCount; color++) {
    for (let i = 0; i < capacity; i++) units.push(color);
  }
  shuffle(units, random);

  const tubes = [];
  for (let i = 0; i < colorCount; i++) {
    tubes.push(units.slice(i * capacity, (i + 1) * capacity));
  }
  return tubes;
}

/** Fisher–Yates shuffle, in place. */
function shuffle(items, random) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

function startsTooEasy(tube) {
  return tube.length > 0 && topRun(tube).count >= TOO_EASY_TOP_RUN;
}

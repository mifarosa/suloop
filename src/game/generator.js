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
 * @returns {number[][]}
 */
export function generatePuzzle(seed, colorCount, emptyTubeCount = 2) {
  const random = createRandom(seed);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const tubes = dealFilledTubes(random, colorCount);
    for (let i = 0; i < emptyTubeCount; i++) tubes.push([]);

    if (!tubes.some(startsTooEasy) && solve(tubes)) return tubes;
  }
  throw new Error(`Could not generate a solvable puzzle (seed ${seed})`);
}

/** Shuffles TUBE_CAPACITY units of every color and splits them into full tubes. */
function dealFilledTubes(random, colorCount) {
  const units = [];
  for (let color = 0; color < colorCount; color++) {
    for (let i = 0; i < TUBE_CAPACITY; i++) units.push(color);
  }
  shuffle(units, random);

  const tubes = [];
  for (let i = 0; i < colorCount; i++) {
    tubes.push(units.slice(i * TUBE_CAPACITY, (i + 1) * TUBE_CAPACITY));
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

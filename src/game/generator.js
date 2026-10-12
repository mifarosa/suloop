import { createRandom } from './random.js';
import { Board, HALF_TUBE_SIZE, TUBE_CAPACITY, topRun } from './rules.js';
import { solve } from './solver.js';

const MAX_ATTEMPTS = 100;

// A tube that starts with this many matching units on top is already half sorted.
const TOO_EASY_TOP_RUN = 3;

/** How many times a cracked tube can be poured into. */
export const CRACKED_TUBE_FILLS = 3;

/**
 * The shape of a board. The tubes come in this order: the filled ones, then the empty ones,
 * half, one-way and cracked.
 * @typedef {object} BoardShape
 * @property {number} colorCount number of colors, and so the number of filled tubes
 * @property {number} [emptyTubeCount] empty full-size tubes
 * @property {number} [halfTubeCount] empty half tubes
 * @property {number} [oneWayTubeCount] empty full-size tubes that never give liquid back
 * @property {number} [crackedTubeCount] empty full-size tubes that can be poured into only
 *   CRACKED_TUBE_FILLS times
 * @property {number} [lockedTubeCount] filled tubes that stay locked until their key color
 *   is complete (0 or 1)
 * @property {number} [oilColorCount] colors that are oil
 * @property {number} [capacity] units of each color, and what a full-size tube holds
 */

/**
 * Units each tube of a board holds, in the order the tubes are dealt.
 * @param {BoardShape} shape
 * @returns {number[]}
 */
export function tubeSizes(shape) {
  const { colorCount, emptyTubeCount = 2, halfTubeCount = 0, capacity = TUBE_CAPACITY } = shape;
  const { oneWayTubeCount = 0, crackedTubeCount = 0 } = shape;
  return [
    ...Array(colorCount + emptyTubeCount).fill(capacity),
    ...Array(halfTubeCount).fill(HALF_TUBE_SIZE),
    ...Array(oneWayTubeCount + crackedTubeCount).fill(capacity)
  ];
}

/**
 * Deals a random, solvable puzzle. The same seed always deals the same puzzle.
 *
 * @param {number} seed
 * @param {BoardShape} shape
 * @returns {{ tubes: number[][], board: Board } | null} null when no solvable deal turned up,
 *   which happens now and then with a single empty tube
 */
export function generatePuzzle(seed, shape) {
  const { colorCount, capacity = TUBE_CAPACITY, lockedTubeCount = 0 } = shape;
  const { oilColorCount = 0 } = shape;
  const tubeCount = tubeSizes(shape).length;
  const random = createRandom(seed);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const tubes = dealFilledTubes(random, colorCount, capacity);
    while (tubes.length < tubeCount) tubes.push([]);

    // Only boards with special rules draw these, so plain boards deal as they always have.
    const oilColors = oilColorCount > 0 ? pick(random, range(colorCount), oilColorCount) : [];
    const locks = lockedTubeCount > 0 ? pickLocks(random, tubes, colorCount, lockedTubeCount) : [];
    const board = createBoard(shape, oilColors, locks);
    if (oilColors.length > 0) floatOil(tubes, board);

    if (!tubes.some(startsTooEasy) && solve(tubes, { board })) return { tubes, board };
  }
  return null;
}

/** The rules for a shape, with the oil colors and the locks that were drawn for it. */
function createBoard(shape, oilColors, locks) {
  const sizes = tubeSizes(shape);
  const { colorCount, emptyTubeCount = 2, halfTubeCount = 0, capacity = TUBE_CAPACITY } = shape;
  const { oneWayTubeCount = 0, crackedTubeCount = 0 } = shape;
  const firstOneWay = colorCount + emptyTubeCount + halfTubeCount;
  const firstCracked = firstOneWay + oneWayTubeCount;

  return new Board({
    capacity,
    // A board of full-size tubes only needs no sizes, which keeps the solver on its faster path.
    sizes: halfTubeCount > 0 ? sizes : null,
    oilColors,
    oneWay: range(oneWayTubeCount).map((i) => firstOneWay + i),
    cracked: Object.fromEntries(
      range(crackedTubeCount).map((i) => [firstCracked + i, CRACKED_TUBE_FILLS])
    ),
    locks: Object.fromEntries(locks.map(({ tube, key }) => [tube, key]))
  });
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

/** Lets the oil in every tube rise above the water, keeping the order within each. */
function floatOil(tubes, board) {
  for (const tube of tubes) {
    const water = tube.filter((color) => !board.isOil(color));
    const oil = tube.filter((color) => board.isOil(color));
    tube.splice(0, tube.length, ...water, ...oil);
  }
}

/**
 * Locks `count` filled tubes, each with a key color that has no unit inside it; otherwise the
 * key could never be completed. Two locks never hold each other's key, which would lock both
 * for good.
 */
function pickLocks(random, tubes, colorCount, count) {
  const locks = [];
  // Gives up after a while and makes do with fewer locks; with six colors or more it never has to.
  for (let tries = 0; locks.length < count && tries < 50; tries++) {
    const tube = Math.floor(random() * colorCount);
    const keys = range(colorCount).filter((color) => !tubes[tube].includes(color));
    const key = keys[Math.floor(random() * keys.length)];
    const clashes = locks.some(
      (lock) =>
        lock.tube === tube || (tubes[lock.tube].includes(key) && tubes[tube].includes(lock.key))
    );
    if (!clashes) locks.push({ tube, key });
  }
  return locks;
}

function pick(random, items, count) {
  const shuffled = items.slice();
  shuffle(shuffled, random);
  return shuffled.slice(0, count).sort((a, b) => a - b);
}

function range(count) {
  return Array.from({ length: count }, (_, i) => i);
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

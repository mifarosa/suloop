/**
 * The rules of the puzzle.
 *
 * A tube is an array of color ids listed bottom to top; `tubes` is the whole board. Liquid can
 * be poured onto an empty tube or onto the same color, and a pour moves the whole same-colored
 * run from the top of the source, as far as the target has room. The puzzle is solved when
 * every tube is empty or complete: full of a single color.
 *
 * A board has `capacity` units of each color, and a full-size tube holds exactly that many.
 * A Board can also have:
 * - half tubes, which hold fewer units, so they can never hold a whole color;
 * - oil colors. Oil floats: in every tube it sits above the water. Oil can be poured onto
 *   water of any color (it stays on top) and onto the same oil; water can be poured into a
 *   tube whose topmost water is the same color, and sinks under the oil there. Water under oil
 *   cannot be poured out until the oil is gone;
 * - one-way tubes, which take liquid but never give it back;
 * - cracked tubes, which can be poured into only a few times. How many times are left is part
 *   of the position (`fills`), next to the tubes;
 * - locked tubes, which cannot be poured from or into until some tube is complete with their
 *   key color. A complete tube never changes again, so a lock that opened stays open.
 */

/** Units of each color, and what a full-size tube holds; tall tubes hold more. */
export const TUBE_CAPACITY = 4;
export const TALL_TUBE_CAPACITY = 5;
/** Units a half tube holds. It can never hold a whole color, so it ends up empty. */
export const HALF_TUBE_SIZE = 2;

/** Stands for a unit the player has not seen yet, in the board as it is shown. */
export const HIDDEN = -1;

/**
 * Where a game stands: the tubes, and for each cracked tube how many more times it can be
 * poured into (null for other tubes).
 * @typedef {{ tubes: number[][], fills: Array<number | null> }} Position
 */

/** @param {number[][]} tubes */
export function cloneTubes(tubes) {
  return tubes.map((tube) => tube.slice());
}

/** @param {number[]} tube */
function topColor(tube) {
  return tube[tube.length - 1];
}

/**
 * The same-colored run at the top of a tube.
 * @param {number[]} tube
 * @returns {{ color: number | null, count: number }}
 */
export function topRun(tube) {
  if (tube.length === 0) return { color: null, count: 0 };

  const color = topColor(tube);
  let count = 0;
  for (let i = tube.length - 1; i >= 0 && tube[i] === color; i--) count++;
  return { color, count };
}

/** The tubes of a board and the rules they follow. */
export class Board {
  /**
   * @param {object} [options]
   * @param {number} [options.capacity] units of each color
   * @param {number[]} [options.sizes] units each tube holds; every tube holds `capacity` when
   *   left out
   * @param {number[]} [options.oilColors] colors that are oil
   * @param {number[]} [options.oneWay] indexes of one-way tubes
   * @param {Record<number, number>} [options.cracked] for each cracked tube, how many times it
   *   can be poured into
   * @param {Record<number, number>} [options.locks] for each locked tube, its key color
   */
  constructor({
    capacity = TUBE_CAPACITY,
    sizes = null,
    oilColors = [],
    oneWay = [],
    cracked = {},
    locks = {}
  } = {}) {
    this.capacity = capacity;
    this.sizes = sizes;
    this.oilColors = new Set(oilColors);
    this.oneWay = new Set(oneWay);
    this.cracked = new Map(Object.entries(cracked).map(([index, fills]) => [+index, fills]));
    this.locks = new Map(Object.entries(locks).map(([index, key]) => [+index, key]));
    /** Whether tubes differ in more than their contents, so they are not interchangeable. */
    this.hasSpecialTubes =
      sizes !== null || this.oneWay.size > 0 || this.cracked.size > 0 || this.locks.size > 0;
  }

  /** The position a game starts from. @returns {Position} */
  start(tubes) {
    return {
      tubes: cloneTubes(tubes),
      fills: tubes.map((_, index) => this.cracked.get(index) ?? null)
    };
  }

  sizeOf(index) {
    return this.sizes ? this.sizes[index] : this.capacity;
  }

  isOil(color) {
    return this.oilColors.has(color);
  }

  /** A tube is complete when it holds every unit of a single color. */
  isComplete(tube) {
    return tube.length === this.capacity && tube.every((color) => color === tube[0]);
  }

  /** @param {Position} position */
  isSolved({ tubes }) {
    return tubes.every((tube) => tube.length === 0 || this.isComplete(tube));
  }

  /** @param {Position} position */
  isLocked({ tubes }, index) {
    const key = this.locks.get(index);
    return key !== undefined && !tubes.some((tube) => tube[0] === key && this.isComplete(tube));
  }

  /**
   * Whether a tube can be picked up to pour from: it has liquid, is not complete, and is
   * neither one-way nor locked.
   * @param {Position} position
   */
  canPourFrom(position, index) {
    const tube = position.tubes[index];
    return (
      tube.length > 0 &&
      !this.isComplete(tube) &&
      !this.oneWay.has(index) &&
      !this.isLocked(position, index)
    );
  }

  /**
   * @param {Position} position
   * @param {number} from index of the source tube
   * @param {number} to index of the target tube
   */
  canPour(position, from, to) {
    if (from === to) return false;

    const { tubes, fills } = position;
    const source = tubes[from];
    const target = tubes[to];
    if (!source || !target) return false;
    if (source.length === 0 || target.length >= this.sizeOf(to)) return false;
    if (this.oneWay.has(from) || fills[to] === 0) return false;
    if (this.isLocked(position, from) || this.isLocked(position, to)) return false;

    const color = topColor(source);
    // Oil settles on top of any water; water meets the topmost water under any oil.
    const meets = this.isOil(color) ? this.#topOil(target) : this.#topWater(target);
    return meets === undefined || meets === color;
  }

  /** How many units a pour would move; 0 when the pour is not allowed. */
  pourAmount(position, from, to) {
    if (!this.canPour(position, from, to)) return 0;
    return Math.min(
      topRun(position.tubes[from]).count,
      this.sizeOf(to) - position.tubes[to].length
    );
  }

  /**
   * Pours from one tube into another.
   * @param {Position} position
   * @returns {{ position: Position, amount: number }} the new position and the number of
   *   units moved; the original position comes back unchanged when the pour is not allowed
   */
  pour(position, from, to) {
    const amount = this.pourAmount(position, from, to);
    if (amount === 0) return { position, amount };

    const tubes = cloneTubes(position.tubes);
    const color = topColor(tubes[from]);
    tubes[from].length -= amount;
    const target = tubes[to];
    const insertAt = this.isOil(color) ? target.length : this.waterCount(target);
    target.splice(insertAt, 0, ...Array(amount).fill(color));

    const fills = position.fills.slice();
    if (fills[to] !== null) fills[to]--;
    return { position: { tubes, fills }, amount };
  }

  /**
   * A text that is the same for two positions exactly when they play the same, so a search
   * can skip positions it has seen: tubes that only differ in their contents are
   * interchangeable, so their order does not matter.
   * @param {Position} position
   */
  positionKey({ tubes, fills }) {
    const describe = this.hasSpecialTubes
      ? (tube, index) => `${this.traitsOf(index)}${fills[index] ?? ''}:${tube.join(',')}`
      : (tube) => tube.join(',');
    return tubes.map(describe).sort().join('|');
  }

  /** What sets a tube apart from others besides its contents: size, kind and key. */
  traitsOf(index) {
    let traits = String(this.sizeOf(index));
    if (this.oneWay.has(index)) traits += 'w';
    if (this.cracked.has(index)) traits += 'c';
    if (this.locks.has(index)) traits += `l${this.locks.get(index)}`;
    return traits;
  }

  /** How many units of a tube are water: everything under its oil. */
  waterCount(tube) {
    let count = tube.length;
    while (count > 0 && this.isOil(tube[count - 1])) count--;
    return count;
  }

  #topWater(tube) {
    const count = this.waterCount(tube);
    return count > 0 ? tube[count - 1] : undefined;
  }

  #topOil(tube) {
    const top = topColor(tube);
    return top !== undefined && this.isOil(top) ? top : undefined;
  }
}

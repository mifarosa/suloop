import { TUBE_CAPACITY } from '../game/rules.js';
import { tubeHeight } from './dimensions.js';

/**
 * What one tube looks like right now, in world units with y pointing up.
 *
 * The tube stands at (x, y), placed by the layout. Its body is lifted, shaken and tilted
 * on top of that; the body's origin is the mouth of the tube, so a pour tilts around it.
 * Liquid is a list of segments, each filled from 0 (empty) to 1 (full) so pours can
 * drain and fill them gradually; a segment's slot (0 = bottom) can be fractional while
 * water sinks under oil. A segment's color may be HIDDEN.
 */
export class TubeView {
  /**
   * @param {number} index position of the tube on the board
   * @param {number} [size] units the tube holds
   * @param {{ oneWay?: boolean, lockKey?: number | null, fills?: number | null }} [kind]
   *   oneWay: takes liquid but never gives it back; lockKey: the color that unlocks it;
   *   fills: how many more times a cracked tube can be poured into
   */
  constructor(index, size = TUBE_CAPACITY, { oneWay = false, lockKey = null, fills = null } = {}) {
    this.index = index;
    this.size = size;
    this.height = tubeHeight(size);
    this.x = 0;
    this.y = 0;
    this.body = { x: 0, y: this.height, tilt: 0 };
    /** 0 for plain glass, 1 for fully lit (used to point at hinted tubes) */
    this.glow = 0;
    /** @type {Array<{ color: number, slot: number, fill: number }>} bottom first */
    this.segments = [];
    /** @type {number[]} colors shown, bottom first */
    this.colors = [];
    this.oneWay = oneWay;
    this.lockKey = lockKey;
    /** How much ice covers a locked tube: 1 while locked, melting to 0 when it opens. */
    this.ice = lockKey === null ? 0 : 1;
    this.fills = fills;
    this.maxFills = fills;
  }

  get topColor() {
    return this.colors[this.colors.length - 1];
  }

  /** The liquid in the tube as layers, bottom first, counting partly filled segments. */
  get layers() {
    return this.segments
      .filter((segment) => segment.fill > 0)
      .sort((a, b) => a.slot - b.slot)
      .map((segment) => ({ color: segment.color, units: segment.fill }));
  }

  /** Shows `colors` (bottom first) as full segments. */
  showColors(colors) {
    this.segments = colors.map((color, slot) => ({ color, slot, fill: 1 }));
    this.colors = colors.slice();
  }

  /** Adds a full segment at the given slot (0 = bottom) and returns it. */
  addSegment(color, slot) {
    const segment = { color, slot, fill: 1 };
    this.segments.push(segment);
    return segment;
  }

  /** Puts the tube back upright in its resting place. */
  resetPose() {
    this.body.x = 0;
    this.body.y = this.height;
    this.body.tilt = 0;
  }

  setGlow(amount) {
    this.glow = amount;
  }
}

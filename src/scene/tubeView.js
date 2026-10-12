import { TUBE_CAPACITY } from '../game/rules.js';
import { tubeHeight } from './dimensions.js';

/**
 * What one tube looks like right now, in world units with y pointing up.
 *
 * The tube stands at (x, y), placed by the layout. Its body is lifted, shaken and tilted
 * on top of that; the body's origin is the mouth of the tube, so a pour tilts around it.
 * Liquid is a list of segments, each filled from 0 (empty) to 1 (full) so pours can
 * drain and fill them gradually. A segment's color may be HIDDEN.
 */
export class TubeView {
  /**
   * @param {number} index position of the tube on the board
   * @param {number} [capacity] units the tube holds
   */
  constructor(index, capacity = TUBE_CAPACITY) {
    this.index = index;
    this.height = tubeHeight(capacity);
    this.x = 0;
    this.y = 0;
    this.body = { x: 0, y: this.height, tilt: 0 };
    /** 0 for plain glass, 1 for fully lit (used to point at hinted tubes) */
    this.glow = 0;
    /** @type {Array<{ color: number, slot: number, fill: number }>} bottom first */
    this.segments = [];
    /** @type {number[]} colors shown, bottom first */
    this.colors = [];
  }

  get topColor() {
    return this.colors[this.colors.length - 1];
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

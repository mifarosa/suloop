import { LIQUID_FLOOR, LIQUID_RADIUS, SEGMENT_HEIGHT } from './dimensions.js';

/**
 * The shape of the liquid in a tilted tube.
 *
 * Liquid keeps its surface level whatever the tube does. So when a tube tilts, each layer of
 * liquid is the part of the tube's inside that lies below some level line, and the line sits
 * where that part holds the same amount as the layer did standing upright.
 *
 * Everything here is in tube coordinates: x across the tube, y up from its base, in world
 * units. A tube tilted by `tilt` (radians, counterclockwise) has the world's "up" at
 * `upInTube(tilt)`.
 */

// Points along the rounded bottom; enough for the eye, few enough to stay cheap.
const BOTTOM_STEPS = 12;
const SEARCH_STEPS = 24;

/** The world's up direction, in the coordinates of a tube tilted by `tilt`. */
export function upInTube(tilt) {
  return { x: Math.sin(tilt), y: Math.cos(tilt) };
}

/**
 * The inside of a tube as a polygon, counterclockwise: the rounded bottom, then up the right
 * wall to the mouth and back down the left wall.
 * @param {number} height of the tube
 * @returns {Array<{ x: number, y: number }>}
 */
export function tubeInside(height) {
  const r = LIQUID_RADIUS;
  const centerY = LIQUID_FLOOR + r;
  const points = [];
  for (let i = 0; i <= BOTTOM_STEPS; i++) {
    const angle = Math.PI + (Math.PI * i) / BOTTOM_STEPS;
    points.push({ x: r * Math.cos(angle), y: centerY + r * Math.sin(angle) });
  }
  points.push({ x: r, y: height }, { x: -r, y: height });
  return points;
}

/** The part of a polygon whose height along `up` is at most `level`. */
export function clipBelow(polygon, up, level) {
  const height = (p) => p.x * up.x + p.y * up.y - level;
  const clipped = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const ha = height(a);
    const hb = height(b);
    if (ha <= 0) clipped.push(a);
    if ((ha < 0 && hb > 0) || (ha > 0 && hb < 0)) {
      const t = ha / (ha - hb);
      clipped.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return clipped;
}

export function area(polygon) {
  let sum = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/** How much liquid `units` units are: the area they fill in an upright tube. */
export function unitsToArea(inside, units) {
  return area(clipBelow(inside, { x: 0, y: 1 }, LIQUID_FLOOR + units * SEGMENT_HEIGHT));
}

/** The level line below which the inside of the tube holds `liquidArea`, looking along `up`. */
export function levelForArea(inside, up, liquidArea) {
  const heights = inside.map((p) => p.x * up.x + p.y * up.y);
  let low = Math.min(...heights);
  let high = Math.max(...heights);
  for (let i = 0; i < SEARCH_STEPS; i++) {
    const middle = (low + high) / 2;
    if (area(clipBelow(inside, up, middle)) < liquidArea) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

/**
 * The layers of liquid in a tilted tube, top layer first, each as the region below its own
 * surface; drawing them in this order leaves every layer showing between its two surfaces.
 * @param {number} height of the tube
 * @param {Array<{ color: number, units: number }>} layers bottom first
 * @param {number} tilt
 * @returns {Array<{ color: number, polygon: Array<{ x: number, y: number }>, top: number, bottom: number }>}
 *   top and bottom: the layer's surfaces, as levels along the world's up
 */
export function tiltedLayers(height, layers, tilt) {
  const inside = tubeInside(height);
  const up = upInTube(tilt);
  const result = [];
  let units = 0;
  let bottom = levelForArea(inside, up, 0);
  for (const layer of layers) {
    units += layer.units;
    const top = levelForArea(inside, up, unitsToArea(inside, units));
    result.push({ color: layer.color, polygon: clipBelow(inside, up, top), top, bottom });
    bottom = top;
  }
  return result.reverse();
}

/**
 * How far a tube holding `units` units has to tilt for its liquid to reach the lip of the
 * mouth, so that it starts to pour. An empty tube needs to lie almost flat.
 * @param {number} height of the tube
 * @param {number} units
 * @returns {number} radians, positive
 */
export function tiltToPour(height, units) {
  const inside = tubeInside(height);
  const liquid = unitsToArea(inside, units);
  // At this tilt the left lip is the lowest point of the mouth.
  const lip = { x: -LIQUID_RADIUS, y: height };
  let low = 0;
  let high = Math.PI / 2;
  for (let i = 0; i < SEARCH_STEPS; i++) {
    const tilt = (low + high) / 2;
    const up = upInTube(tilt);
    const surface = levelForArea(inside, up, liquid);
    if (surface < lip.x * up.x + lip.y * up.y) low = tilt;
    else high = tilt;
  }
  return (low + high) / 2;
}

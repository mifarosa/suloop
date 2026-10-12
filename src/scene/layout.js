import { LIFT_HEIGHT, ROW_GAP, TUBE_HEIGHT, TUBE_RADIUS, TUBE_SPACING } from './dimensions.js';

/** Empty space kept around the tubes, in world units. */
const FRAME_MARGIN = 0.9;
/** Largest size of one world unit in pixels, so tubes do not get huge on big screens. */
const MAX_SCALE = 150;

/** Narrow screens get shorter rows, so the tubes stay large enough to tap. */
function maxTubesPerRow(aspect) {
  if (aspect < 0.75) return 4;
  if (aspect < 1.2) return 5;
  return 7;
}

/**
 * Arranges tubes in centered rows of equal length, the last row possibly shorter.
 * @param {number} count
 * @param {number} aspect width / height of the view
 * @param {number} [tubeHeight]
 * @returns {{ positions: Array<{ x: number, y: number }>, bounds: { width: number, top: number, bottom: number } }}
 */
export function arrangeTubes(count, aspect, tubeHeight = TUBE_HEIGHT) {
  const rows = Math.ceil(count / maxTubesPerRow(aspect));
  const perRow = Math.ceil(count / rows);
  const rowSpacing = tubeHeight + ROW_GAP;

  const positions = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / perRow);
    const column = i % perRow;
    const tubesInRow = Math.min(perRow, count - row * perRow);
    positions.push({ x: (column - (tubesInRow - 1) / 2) * TUBE_SPACING, y: -row * rowSpacing });
  }

  const bounds = {
    width: (perRow - 1) * TUBE_SPACING + TUBE_RADIUS * 2,
    top: tubeHeight + LIFT_HEIGHT,
    bottom: -(rows - 1) * rowSpacing
  };
  return { positions, bounds };
}

/**
 * Fits the arrangement into a view, centered in the area below the HUD.
 * @param {{ width: number, top: number, bottom: number }} bounds in world units
 * @param {number} width view size in pixels
 * @param {number} height
 * @param {number} [topInset] pixels at the top kept free for the HUD
 * @returns {{ scale: number, originX: number, originY: number }} pixels per world unit, and
 *   where the world origin lands on screen (screen y grows downwards, world y upwards)
 */
export function fitToView(bounds, width, height, topInset = 0) {
  const worldWidth = bounds.width + FRAME_MARGIN * 2;
  const worldHeight = bounds.top - bounds.bottom + FRAME_MARGIN * 2;
  const freeHeight = Math.max(1, height - topInset);
  const scale = Math.min(width / worldWidth, freeHeight / worldHeight, MAX_SCALE);
  const centerY = (bounds.top + bounds.bottom) / 2;

  return {
    scale,
    originX: width / 2,
    originY: topInset + freeHeight / 2 + centerY * scale
  };
}
